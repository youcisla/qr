#!/usr/bin/env bun
/**
 * Yopem QR — end-to-end scan verification harness.
 *
 * Pipeline: renderQrSvg() -> standalone HTML page -> headless Chrome PNG
 * screenshot -> pngjs pixels -> jsQR decode -> assert decoded payload equality.
 * A second class of cases asserts the scanability warnings emitted by the
 * renderer (low contrast, oversized logo, missing quiet zone, ...) without
 * claiming that a decoder succeeds.
 *
 * Usage:
 *   bun run scripts/verify-qr-scan.ts                 # full matrix, fast batch screenshots
 *   bun run scripts/verify-qr-scan.ts --quick         # core matrix only
 *   bun run scripts/verify-qr-scan.ts --filter=logo   # only matching case ids/groups
 *   bun run scripts/verify-qr-scan.ts --solo          # strict one-Chrome-launch-per-case mode
 *   bun run scripts/verify-qr-scan.ts --json          # machine-readable output only
 *   bun run scripts/verify-qr-scan.ts --dry-run       # render + warning checks, no browser
 *   bun run scripts/verify-qr-scan.ts --list          # list case ids
 *   bun run scripts/verify-qr-scan.ts --markdown      # markdown pass/fail table
 *
 * Exit codes: 0 = every required case passed, 1 = at least one required case failed
 * (or a harness/browser error occurred), 2 = fatal usage/environment error.
 *
 * Artifacts: .tmp/verify/runs/run-<timestamp>/ (HTML pages, screenshots, results)
 *            .tmp/verify/results.json (latest machine-readable results)
 *            .tmp/verify/chrome-profile (reusable headless Chrome profile)
 */
import { spawnSync } from "node:child_process"
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { arch as osArch, cpus, platform as osPlatform, release as osRelease } from "node:os"
import { join, relative, resolve } from "node:path"
import { pathToFileURL } from "node:url"

import jsQR from "jsqr"
import { PNG } from "pngjs"

import { renderQrSvg } from "../src/lib/qr/render"
import { templates } from "../src/lib/qr/templates"
import { DEFAULT_DESIGN } from "../src/lib/qr/types"
import type {
  ErrorCorrectionLevel,
  QrDesign,
  QrRenderResult,
  ScanWarning,
} from "../src/lib/qr/types"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROOT = resolve(import.meta.dir, "..")
const VERIFY_DIR = join(ROOT, ".tmp", "verify")
const RUNS_DIR = join(VERIFY_DIR, "runs")
const RESULTS_PATH = join(VERIFY_DIR, "results.json")
const DEFAULT_PROFILE = join(VERIFY_DIR, "chrome-profile")
const RUN_ID = formatRunId(new Date())

/** Rendered SVG width passed to renderQrSvg (the SVG itself stays vector). */
const RENDER_SIZE = 512

/** Solo mode: 720x720 page, SVG capped at 600px. */
const SOLO_PAGE = 720
const SOLO_SVG = 600

/** Batch mode: 4x4 grid of 520px cells inside a 2128x2120 page. */
const GRID_COLS = 4
const GRID_ROWS = 4
const GRID_CELL = 520
const GRID_GAP = 8
const GRID_PAD = 12
const GRID_SVG = GRID_CELL - 32
const GRID_PAGE_W = GRID_PAD * 2 + GRID_COLS * GRID_CELL + (GRID_COLS - 1) * GRID_GAP
const GRID_PAGE_H = GRID_PAD * 2 + GRID_ROWS * GRID_CELL + (GRID_ROWS - 1) * GRID_GAP

/** Dense payloads get their own larger page so jsQR sees enough pixels per module. */
const DENSE_COLS = 2
const DENSE_CELL = 760
const DENSE_GAP = 8
const DENSE_PAD = 12
const DENSE_SVG = DENSE_CELL - 32
const DENSE_PAGE_W = DENSE_PAD * 2 + DENSE_COLS * DENSE_CELL + (DENSE_COLS - 1) * DENSE_GAP

const DEFAULT_TIMEOUT_MS = 120_000
const KEEP_RUNS = 5

const SHORT_URL = "https://yopem.com/qr"
const LONG_URL =
  "https://yopem.com/qr/verify?utm_source=qa&utm_medium=matrix&utm_campaign=e2e-verification&sample=" +
  "abcdef0123456789".repeat(6) +
  "&checksum=8f3a"
const VCARD = [
  "BEGIN:VCARD",
  "VERSION:3.0",
  "N:Doe;Jane",
  "FN:Jane Doe",
  "ORG:Yopem",
  "TITLE:Head of Product",
  "TEL;TYPE=CELL:+15551234567",
  "EMAIL:jane@yopem.com",
  "END:VCARD",
].join("\n")

const DOT_STYLES = [
  "square",
  "rounded",
  "dots",
  "diamond",
  "star",
  "cross",
  "leaf",
  "classy",
  "hexagon",
  "squircle",
] as const

const EYE_FRAME_STYLES = ["square", "rounded", "circle", "leaf", "octagon", "squircle"] as const
const EYE_BALL_STYLES = ["square", "rounded", "dots", "leaf", "squircle"] as const
const EC_LEVELS: ErrorCorrectionLevel[] = ["L", "M", "Q", "H"]

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

interface CliOptions {
  quick: boolean
  filter: string | null
  json: boolean
  markdown: boolean
  dryRun: boolean
  list: boolean
  help: boolean
  backend: "batch" | "solo"
  keep: "all" | "failures" | "none"
  chrome: string | null
  profile: string
  timeoutMs: number
  screenshotSize: number
  retries: number
}

function parseCli(argv: string[]): CliOptions {
  const options: CliOptions = {
    quick: false,
    filter: null,
    json: false,
    markdown: false,
    dryRun: false,
    list: false,
    help: false,
    backend: "batch",
    keep: "all",
    chrome: null,
    profile: DEFAULT_PROFILE,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    screenshotSize: SOLO_PAGE,
    retries: 2,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const [flag, inline] = arg.includes("=") ? splitOnce(arg, "=") : [arg, undefined]
    const takeValue = (): string => {
      if (inline !== undefined) return inline
      if (i + 1 >= argv.length) fatal("Missing value for " + flag)
      i += 1
      return argv[i]
    }

    switch (flag) {
      case "--quick":
        options.quick = true
        break
      case "--filter":
        options.filter = takeValue()
        break
      case "--json":
        options.json = true
        break
      case "--markdown":
        options.markdown = true
        break
      case "--dry-run":
      case "--preflight":
        options.dryRun = true
        break
      case "--list":
        options.list = true
        break
      case "--solo":
        options.backend = "solo"
        break
      case "--batch":
        options.backend = "batch"
        break
      case "--backend": {
        const backend = takeValue()
        if (backend !== "batch" && backend !== "solo") fatal("--backend must be batch or solo")
        options.backend = backend
        break
      }
      case "--keep": {
        const keep = takeValue()
        if (keep !== "all" && keep !== "failures" && keep !== "none") {
          fatal("--keep must be all, failures or none")
        }
        options.keep = keep
        break
      }
      case "--chrome":
        options.chrome = takeValue()
        break
      case "--profile":
        options.profile = resolve(takeValue())
        break
      case "--timeout":
        options.timeoutMs = Number(takeValue())
        break
      case "--screenshot-size":
        options.screenshotSize = Number(takeValue())
        break
      case "--retries":
        options.retries = Number(takeValue())
        break
      case "--help":
      case "-h":
        options.help = true
        break
      default:
        fatal("Unknown flag: " + arg + "\nRun with --help for usage.")
    }
  }

  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs < 5_000) {
    fatal("--timeout must be a number >= 5000 (milliseconds)")
  }
  if (!Number.isFinite(options.screenshotSize) || options.screenshotSize < 320) {
    fatal("--screenshot-size must be a number >= 320")
  }
  return options
}

function splitOnce(value: string, separator: string): [string, string] {
  const index = value.indexOf(separator)
  return [value.slice(0, index), value.slice(index + separator.length)]
}

function fatal(message: string): never {
  console.error("verify-qr-scan: " + message)
  process.exit(2)
}

const HELP = [
  "Yopem QR end-to-end scan verification.",
  "",
  "Usage: bun run scripts/verify-qr-scan.ts [flags]",
  "",
  "Flags:",
  "  --quick                 core matrix only (safe baseline designs)",
  "  --filter=<substring>    only case ids/groups containing the substring",
  "  --json                  print machine-readable JSON results only",
  "  --markdown              print a markdown pass/fail table only",
  "  --dry-run               render + warning assertions only, no browser",
  "  --list                  list case ids and exit",
  "  --solo                  one headless Chrome launch per case (strict, slower)",
  "  --batch                 batch grid screenshots, few Chrome launches (default)",
  "  --keep=all|failures|none   which PNG/HTML artifacts to keep (default: all)",
  "  --chrome=<path>         Chrome/Edge executable (also QR_CHROME_PATH env var)",
  "  --profile=<path>        reusable Chrome profile dir (default: .tmp/verify/chrome-profile)",
  "  --timeout=<ms>          per-screenshot Chrome timeout (default: 120000)",
  "  --screenshot-size=<px>  solo-mode page size (default: 720)",
  "  --retries=<n>           screenshot retry attempts (default: 2)",
  "  -h, --help              show this help",
  "",
].join("\n")

// ---------------------------------------------------------------------------
// Case model
// ---------------------------------------------------------------------------

interface ExpectedWarning {
  code: ScanWarning["code"]
  level?: ScanWarning["level"]
}

interface VerifyCase {
  /** Stable, readable id used in reports and --filter. */
  id: string
  /** Matrix section (dot, eye-frame, fill, ...). */
  group: string
  /** Payload encoded by renderQrSvg. */
  data: string
  /** Partial design merged over DEFAULT_DESIGN by the engine. */
  design: Partial<QrDesign>
  /** Decode must equal the payload. Warning-only cases set false. */
  requireDecode?: boolean
  /** Required cases gate the process exit code (default true). */
  required?: boolean
  /** Warnings that must be emitted (code + optional level). */
  expectWarnings?: ExpectedWarning[]
  /** Warnings that must not be emitted. */
  forbidWarnings?: ScanWarning["code"][]
  /** renderQrSvg must degrade to this error code (data-too-long fallback). */
  expectedRenderError?: string
  /** Allow error-level warnings even though the case must decode. */
  allowErrorWarnings?: boolean
  /** Include in --quick runs. */
  quick?: boolean
  /** Decode at higher resolution (dedicated large-cell page). */
  dense?: boolean
  /** Free-form note stored in results/docs. */
  note?: string
  /** Explain why a non-required decode failure is a decoder limitation, not an engine bug. */
  knownLimitation?: string
  /** Attempt the decode but expect jsQR to fail (proves a documented limitation). */
  expectDecodeFailure?: boolean
}

function makeLogoDataUrl(): string {
  const size = 64
  const png = new PNG({ width: size, height: size })
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (size * y + x) << 2
      const dx = x - size / 2
      const dy = y - size / 2
      const inside = dx * dx + dy * dy < (size * 0.44) ** 2
      png.data[offset] = inside ? 37 : 255
      png.data[offset + 1] = inside ? 99 : 255
      png.data[offset + 2] = inside ? 235 : 255
      png.data[offset + 3] = 255
    }
  }
  return "data:image/png;base64," + PNG.sync.write(png).toString("base64")
}

const LOGO_SRC = makeLogoDataUrl()

type FrameStyle = "none" | "rounded" | "banner" | "badge"

function logoOptions(
  overrides: Partial<NonNullable<QrDesign["logo"]>> = {},
): NonNullable<QrDesign["logo"]> {
  return {
    src: LOGO_SRC,
    size: 0.18,
    padding: 0.16,
    radius: 0.18,
    backgroundColor: "#ffffff",
    clearModules: true,
    ...overrides,
  }
}

function frameOptions(style: FrameStyle, label: string): NonNullable<QrDesign["frame"]> {
  return {
    style,
    label,
    labelColor: "#ffffff",
    frameColor: "#0f172a",
    backgroundColor: "#ffffff",
    fontSize: 0.075,
  }
}

function templateDesign(id: string): Partial<QrDesign> {
  return templates.find((template) => template.id === id)?.design ?? {}
}

/** The full verification matrix. Order is stable and drives the report. */
function buildCases(): VerifyCase[] {
  const cases: VerifyCase[] = []

  // --- Every dot style (square = baseline) --------------------------------
  // Stylised module shapes remove coverage from each cell, so the engine's
  // guidance is EC H for the shaped styles. See known-limitation cases below
  // for what jsQR does at the default EC M.
  for (const dotStyle of DOT_STYLES) {
    cases.push({
      id: "dot:" + dotStyle,
      group: "dot",
      data: SHORT_URL,
      design: { dotStyle, errorCorrection: "H" },
      quick: dotStyle === "square" || dotStyle === "rounded" || dotStyle === "dots",
      // jsQR needs ~19px per module for the diamond shape; route it to the
      // high-resolution page instead of the 520px grid cell.
      dense: dotStyle === "diamond",
      note: dotStyle === "diamond" ? "decoded on the 760px dense page" : undefined,
    })
  }

  // --- Every finder frame style ------------------------------------------
  // jsQR rejects a square ball inside asymmetric frames (circle/leaf/octagon),
  // so the coverage case pairs shaped frames with a rounded ball: that verifies
  // the frame geometry itself. The rejected combo is a known-limitation case.
  for (const eyeFrameStyle of EYE_FRAME_STYLES) {
    cases.push({
      id: "eyeframe:" + eyeFrameStyle,
      group: "eye-frame",
      data: SHORT_URL,
      design: {
        eyeFrameStyle,
        eyeBallStyle: eyeFrameStyle === "square" ? "square" : "rounded",
        errorCorrection: "H",
      },
      quick: eyeFrameStyle === "square" || eyeFrameStyle === "rounded" || eyeFrameStyle === "circle",
    })
  }

  // --- Every finder ball style -------------------------------------------
  // The rounded frame is the jsQR-safe partner for every ball style (the
  // square-frame + dots/leaf combos are known-limitation cases below).
  for (const eyeBallStyle of EYE_BALL_STYLES) {
    cases.push({
      id: "eyeball:" + eyeBallStyle,
      group: "eye-ball",
      data: SHORT_URL,
      design: { eyeBallStyle, eyeFrameStyle: "rounded", errorCorrection: "H" },
      quick: eyeBallStyle === "square" || eyeBallStyle === "rounded",
    })
  }

  // --- Fills --------------------------------------------------------------
  cases.push({
    id: "fill:solid",
    group: "fill",
    data: SHORT_URL,
    design: { foreground: { type: "solid", color: "#0f172a" } },
    quick: true,
  })
  cases.push({
    id: "fill:linear-gradient",
    group: "fill",
    data: SHORT_URL,
    design: {
      foreground: {
        type: "gradient",
        gradient: {
          type: "linear",
          angle: 45,
          stops: [
            { color: "#4338ca", offset: 0 },
            { color: "#7c3aed", offset: 0.55 },
            { color: "#a855f7", offset: 1 },
          ],
        },
      },
    },
    quick: true,
  })
  cases.push({
    id: "fill:radial-gradient",
    group: "fill",
    data: SHORT_URL,
    design: {
      foreground: {
        type: "gradient",
        gradient: {
          type: "radial",
          stops: [
            { color: "#4338ca", offset: 0 },
            { color: "#0ea5e9", offset: 1 },
          ],
        },
      },
    },
  })

  // --- Background / inverted colours -------------------------------------
  cases.push({
    id: "background:transparent",
    group: "background",
    data: SHORT_URL,
    design: { transparentBackground: true },
    expectWarnings: [{ code: "transparent-background", level: "info" }],
  })
  cases.push({
    id: "color:inverted",
    group: "background",
    data: SHORT_URL,
    design: {
      foreground: { type: "solid", color: "#e2e8f0" },
      background: { type: "solid", color: "#111827" },
      quietZone: 5,
    },
    expectWarnings: [{ code: "inverted-colors", level: "warning" }],
    quick: true,
    note: "light modules on dark background; decoded with jsQR attemptBoth",
  })

  // --- Logo ---------------------------------------------------------------
  cases.push({
    id: "logo:png-h",
    group: "logo",
    data: SHORT_URL,
    design: { errorCorrection: "H", logo: logoOptions() },
    forbidWarnings: ["logo-too-large", "logo-without-error-correction", "external-logo"],
    quick: true,
  })

  // --- Frame styles -------------------------------------------------------
  for (const [style, label] of [
    ["none", "SCAN ME"],
    ["rounded", "SCAN FOR DETAILS"],
    ["banner", "SCAN ME"],
    ["badge", "SCAN ME"],
  ] as const) {
    cases.push({
      id: "frame:" + style,
      group: "frame",
      data: SHORT_URL,
      design: { frame: frameOptions(style, label) },
      quick: style === "banner",
    })
  }

  // --- Quiet zone ---------------------------------------------------------
  cases.push({
    id: "quietzone:2",
    group: "quiet-zone",
    data: SHORT_URL,
    design: { quietZone: 2 },
    expectWarnings: [{ code: "quiet-zone-small", level: "info" }],
  })
  cases.push({
    id: "quietzone:4",
    group: "quiet-zone",
    data: SHORT_URL,
    design: { quietZone: 4 },
    quick: true,
  })

  // --- Error correction levels -------------------------------------------
  for (const errorCorrection of EC_LEVELS) {
    cases.push({
      id: "ec:" + errorCorrection,
      group: "ec",
      data: SHORT_URL,
      design: { errorCorrection },
      quick: errorCorrection === "M",
    })
  }

  // --- Payload shapes -----------------------------------------------------
  cases.push({ id: "payload:short-url", group: "payload", data: SHORT_URL, design: {}, quick: true })
  cases.push({ id: "payload:long-url", group: "payload", data: LONG_URL, design: {}, dense: true })
  cases.push({ id: "payload:vcard", group: "payload", data: VCARD, design: {} })

  // --- Template presets ---------------------------------------------------
  for (const templateId of ["classic", "brand-gradient", "confetti", "print-frame"]) {
    cases.push({
      id: "template:" + templateId,
      group: "template",
      data: SHORT_URL,
      design: templateDesign(templateId),
      quick: templateId === "classic" || templateId === "brand-gradient",
    })
  }
  cases.push({
    id: "template:ocean",
    group: "template",
    data: SHORT_URL,
    design: templateDesign("ocean"),
    allowErrorWarnings: true,
    note: "gradient fill on a tinted background probes the low-contrast heuristic",
  })
  cases.push({
    id: "template:neon",
    group: "template",
    data: SHORT_URL,
    design: templateDesign("neon"),
    requireDecode: false,
    expectWarnings: [{ code: "inverted-colors", level: "warning" }],
    knownLimitation:
      "Inverted dot-style codes are marginal for jsQR: the same render decoded in one run (488px grid) and failed at 520-688px in another, so the harness asserts only the inverted-colors warning instead of a flaky decode. Phone scanning unverified.",
  })

  // --- Known decoder limitations (decode attempted, failure expected) -----
  // jsQR 1.4.0 is stricter than modern phone scanners. These cases still try
  // to decode: a KNOWN result means the documented limitation reproduced, and
  // an unexpected PASS means the limitation is stale (update docs/verification.md).
  cases.push({
    id: "limit:dot-star-ec-m",
    group: "limits",
    data: SHORT_URL,
    design: { dotStyle: "star" },
    expectDecodeFailure: true,
    quick: true,
    knownLimitation:
      "jsQR cannot decode star modules at the default EC M (the engine emits no low-module-density warning either); the same design decodes at EC H.",
  })
  cases.push({
    id: "limit:dot-hexagon-ec-m",
    group: "limits",
    data: SHORT_URL,
    design: { dotStyle: "hexagon" },
    expectDecodeFailure: true,
    quick: true,
    knownLimitation:
      "jsQR cannot decode hexagon modules at the default EC M (the engine emits no low-module-density warning either); the same design decodes at EC H.",
  })
  cases.push({
    id: "limit:dot-diamond-ec-m",
    group: "limits",
    data: SHORT_URL,
    design: { dotStyle: "diamond" },
    requireDecode: false,
    expectWarnings: [{ code: "low-module-density", level: "warning" }],
    knownLimitation:
      "Diamond at EC M is flagged by the engine. jsQR fails it on the 488px batch grid but decodes it on the 600-900px solo raster, so decoder margin (not broken output) is the limitation; the decode is not asserted so batch and solo report identical statuses.",
  })
  cases.push({
    id: "limit:square-frame-dots-ball",
    group: "limits",
    data: SHORT_URL,
    design: { eyeFrameStyle: "square", eyeBallStyle: "dots", errorCorrection: "H" },
    expectDecodeFailure: true,
    knownLimitation:
      "jsQR's finder-pattern locator rejects a circular ball inside a square frame at every EC level and resolution tried; the same ball decodes inside a rounded frame.",
  })
  cases.push({
    id: "limit:square-frame-leaf-ball",
    group: "limits",
    data: SHORT_URL,
    design: { eyeFrameStyle: "square", eyeBallStyle: "leaf", errorCorrection: "H" },
    expectDecodeFailure: true,
    knownLimitation:
      "jsQR's finder-pattern locator rejects a leaf ball inside a square frame at every EC level and resolution tried; the same ball decodes inside a rounded frame.",
  })
  cases.push({
    id: "limit:leaf-frame-square-ball",
    group: "limits",
    data: SHORT_URL,
    design: { eyeFrameStyle: "leaf", eyeBallStyle: "square", errorCorrection: "H" },
    expectDecodeFailure: true,
    knownLimitation:
      "jsQR rejects a square ball inside asymmetric frames (leaf, circle, octagon) at every EC level tried; the same frames decode with a rounded ball.",
  })

  // --- Warning-only negative cases (no browser needed) --------------------
  cases.push({
    id: "warning:low-contrast",
    group: "warning",
    data: SHORT_URL,
    design: { foreground: { type: "solid", color: "#d4d4d4" } },
    requireDecode: false,
    expectWarnings: [{ code: "low-contrast", level: "error" }],
    quick: true,
  })
  cases.push({
    id: "warning:huge-logo",
    group: "warning",
    data: SHORT_URL,
    design: { errorCorrection: "H", logo: logoOptions({ size: 0.45 }) },
    requireDecode: false,
    expectWarnings: [{ code: "logo-too-large", level: "error" }],
    quick: true,
  })
  cases.push({
    id: "warning:logo-without-ec",
    group: "warning",
    data: SHORT_URL,
    design: { errorCorrection: "M", logo: logoOptions() },
    requireDecode: false,
    expectWarnings: [{ code: "logo-without-error-correction", level: "warning" }],
  })
  cases.push({
    id: "warning:data-too-long",
    group: "warning",
    data: "x".repeat(4000),
    design: { errorCorrection: "H" },
    requireDecode: false,
    expectedRenderError: "data-too-long",
    expectWarnings: [{ code: "data-too-long", level: "error" }],
    quick: true,
  })
  cases.push({
    id: "warning:quiet-zone-zero",
    group: "warning",
    data: SHORT_URL,
    design: { quietZone: 0 },
    requireDecode: false,
    expectWarnings: [{ code: "quiet-zone-small", level: "warning" }],
  })
  cases.push({
    id: "warning:wide-module-gap",
    group: "warning",
    data: SHORT_URL,
    design: { dotStyle: "dots", moduleGap: 0.3 },
    requireDecode: false,
    expectWarnings: [{ code: "low-module-density", level: "warning" }],
  })
  cases.push({
    id: "warning:external-logo",
    group: "warning",
    data: SHORT_URL,
    design: {
      errorCorrection: "H",
      logo: logoOptions({ src: "https://example.com/logo.png" }),
    },
    requireDecode: false,
    expectWarnings: [{ code: "external-logo", level: "info" }],
  })
  cases.push({
    id: "warning:long-frame-caption",
    group: "warning",
    data: SHORT_URL,
    design: {
      frame: frameOptions("rounded", "SCAN THIS CODE FOR EVENT DETAILS AND DIRECTIONS"),
    },
    requireDecode: false,
    expectWarnings: [{ code: "frame-overlap", level: "info" }],
  })

  return cases
}

function selectCases(cases: VerifyCase[], options: CliOptions): VerifyCase[] {
  let selected = cases
  if (options.quick) selected = selected.filter((testCase) => testCase.quick)
  if (options.filter) {
    const needle = options.filter.toLowerCase()
    selected = selected.filter(
      (testCase) =>
        testCase.id.toLowerCase().includes(needle) ||
        testCase.group.toLowerCase().includes(needle),
    )
  }
  return selected
}

// ---------------------------------------------------------------------------
// Rendering + assertions
// ---------------------------------------------------------------------------

interface RenderRecord {
  case: VerifyCase
  result: QrRenderResult
  svg: string
  ms: number
}

type CaseStatus = "pass" | "fail" | "known-limitation" | "error"

interface CaseResult {
  id: string
  group: string
  required: boolean
  requireDecode: boolean
  payload: { length: number; preview: string }
  design: Partial<QrDesign>
  expected: {
    warnings: ExpectedWarning[]
    forbidWarnings: ScanWarning["code"][]
    renderError?: string
    knownLimitation?: string
  }
  render: {
    version: number
    size: number
    errorCorrection: ErrorCorrectionLevel
    width: number
    height: number
    svgBytes: number
    ms: number
    error?: string
    warnings: ScanWarning[]
  }
  decode: {
    attempted: boolean
    matched: boolean | null
    reason?: string
    decoded?: string | null
    firstDiffIndex?: number | null
    ms: number
  }
  assertions: string[]
  failures: string[]
  status: CaseStatus
  timings: { screenshotMs: number }
  artifacts: { html?: string; png?: string; gridPage?: string }
  note?: string
  knownLimitation?: string
}

function renderCase(testCase: VerifyCase): RenderRecord {
  const startedAt = performance.now()
  const result = renderQrSvg({
    data: testCase.data,
    design: { ...DEFAULT_DESIGN, ...testCase.design },
    size: RENDER_SIZE,
  })
  return { case: testCase, result, svg: result.svg, ms: performance.now() - startedAt }
}

function checkRenderAssertions(testCase: VerifyCase, result: QrRenderResult): string[] {
  const failures: string[] = []
  const resolved = { ...DEFAULT_DESIGN, ...testCase.design }

  if (testCase.expectedRenderError) {
    if (result.error !== testCase.expectedRenderError) {
      failures.push(
        "render.error expected \"" + testCase.expectedRenderError + "\", got " +
          (result.error ? "\"" + result.error + "\"" : "undefined"),
      )
    }
    if (!result.svg.startsWith("<svg")) failures.push("fallback svg is not an <svg> document")
  } else {
    if (result.error) failures.push("unexpected render error: " + result.error)
    if (!result.svg.startsWith("<svg")) failures.push("svg does not start with <svg")
    if (!result.svg.includes('role="img"')) failures.push('svg is missing role="img"')
    if (!(result.width > 0) || !(result.height > 0)) {
      failures.push("non-positive render size " + result.width + "x" + result.height)
    }
    const expectedSize = 17 + 4 * result.matrix.version
    if (result.matrix.size !== expectedSize) {
      failures.push(
        "matrix size " + result.matrix.size + " does not match version " +
          result.matrix.version + " (expected " + expectedSize + ")",
      )
    }
    if (result.matrix.modules.length !== result.matrix.size * result.matrix.size) {
      failures.push(
        "matrix.modules length " + result.matrix.modules.length +
          " != size^2 (" + result.matrix.size * result.matrix.size + ")",
      )
    }
    if (result.matrix.errorCorrectionLevel !== resolved.errorCorrection) {
      failures.push(
        "matrix error correction " + result.matrix.errorCorrectionLevel +
          " != design " + resolved.errorCorrection,
      )
    }
  }

  const codes = new Set(result.warnings.map((warning) => warning.code))
  if (!testCase.expectedRenderError && !testCase.allowErrorWarnings && testCase.requireDecode !== false) {
    for (const warning of result.warnings) {
      if (warning.level === "error" && warning.code !== "data-too-long") {
        failures.push("unexpected error-level warning " + warning.code + ": " + warning.message)
      }
    }
  }
  for (const expected of testCase.expectWarnings ?? []) {
    const match = result.warnings.find(
      (warning) =>
        warning.code === expected.code && (!expected.level || warning.level === expected.level),
    )
    if (!match) {
      const found = result.warnings
        .filter((warning) => warning.code === expected.code)
        .map((warning) => warning.level)
        .join(",")
      failures.push(
        "missing expected warning " + expected.code +
          (expected.level ? " (" + expected.level + ")" : "") +
          (found ? " — found level(s) " + found : " — not emitted"),
      )
    }
  }
  for (const forbidden of testCase.forbidWarnings ?? []) {
    if (codes.has(forbidden)) failures.push("unexpected warning " + forbidden)
  }
  return failures
}

function firstDiff(expected: string, actual: string | null | undefined): number | null {
  if (actual === null || actual === undefined) return null
  const max = Math.max(expected.length, actual.length)
  for (let index = 0; index < max; index += 1) {
    if (expected[index] !== actual[index]) return index
  }
  return null
}

/** Cases whose rendered QR must be screenshotted and fed to jsQR. */
function needsDecode(testCase: VerifyCase): boolean {
  return testCase.requireDecode !== false || testCase.expectDecodeFailure === true
}

function checkDecode(
  testCase: VerifyCase,
  decoded: string | null,
  decodeError?: string,
): { matched: boolean; reason?: string } {
  if (decodeError) return { matched: false, reason: "jsQR error: " + decodeError }
  if (decoded === testCase.data) return { matched: true }
  if (decoded === null) return { matched: false, reason: "jsQR returned no result" }
  return {
    matched: false,
    reason:
      "decoded payload differs at index " + firstDiff(testCase.data, decoded) +
      " (expected " + JSON.stringify(testCase.data.slice(0, 48)) +
      ", got " + JSON.stringify(decoded.slice(0, 48)) + ")",
  }
}

// ---------------------------------------------------------------------------
// Chrome
// ---------------------------------------------------------------------------

function findChrome(explicit: string | null): string {
  const candidates = [
    process.env.QR_CHROME_PATH,
    explicit,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter((candidate): candidate is string => Boolean(candidate))
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  fatal("No Chrome/Edge executable found. Pass --chrome=<path> or set QR_CHROME_PATH.")
}

function detectChromeVersion(chromePath: string): string {
  if (osPlatform() === "win32") {
    const script =
      "(Get-Item -LiteralPath '" + chromePath.replace(/'/g, "''") + "').VersionInfo.ProductVersion"
    const result = spawnSync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      { encoding: "utf8", windowsHide: true, timeout: 20_000 },
    )
    const match = (result.stdout ?? "").match(/\d+\.\d+\.\d+\.\d+/)
    if (match) return match[0]
  }
  const result = spawnSync(chromePath, ["--version"], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 20_000,
  })
  const match = (result.stdout ?? "").match(/(\d+\.\d+\.\d+\.\d+)/)
  return match ? match[1] : "unknown"
}

interface ScreenshotOutcome {
  ok: boolean
  ms: number
  attempts: number
  usedFallbackProfile: boolean
  error?: string
}

function capturePage(options: {
  chromePath: string
  profileDir: string
  fallbackProfileDir: string
  htmlPath: string
  pngPath: string
  width: number
  height: number
  timeoutMs: number
  retries: number
}): ScreenshotOutcome {
  const startedAt = performance.now()
  const attempts = Math.max(1, options.retries)
  let lastError = ""
  let usedFallback = false

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    // A stale/corrupt PNG from a previous attempt must never be decoded.
    if (existsSync(options.pngPath)) rmSync(options.pngPath, { force: true })
    const profile =
      attempt === attempts && attempts > 1 ? options.fallbackProfileDir : options.profileDir
    usedFallback = profile === options.fallbackProfileDir
    mkdirSync(profile, { recursive: true })

    const args = [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-sync",
      "--disable-default-apps",
      "--disable-domain-reliability",
      "--disable-client-side-phishing-detection",
      "--mute-audio",
      "--no-service-autorun",
      "--force-device-scale-factor=1",
      "--virtual-time-budget=1500",
      "--user-data-dir=" + profile,
      "--window-size=" + options.width + "," + options.height,
      "--screenshot=" + options.pngPath,
      pathToFileURL(options.htmlPath).href,
    ]

    const run = spawnSync(options.chromePath, args, {
      encoding: "utf8",
      timeout: options.timeoutMs,
      windowsHide: true,
      maxBuffer: 16 * 1024 * 1024,
    })

    if (run.error) {
      lastError = "spawn error: " + run.error.message
    } else if (!existsSync(options.pngPath)) {
      const stderr = (run.stderr ?? "").trim().split(/\r?\n/).slice(-3).join(" | ")
      lastError =
        "no screenshot written (exit " + String(run.status) + ")" +
        (stderr ? ": " + stderr.slice(0, 400) : "")
    } else {
      try {
        const png = PNG.sync.read(readFileSync(options.pngPath))
        if (png.width !== options.width || png.height !== options.height) {
          lastError =
            "screenshot is " + png.width + "x" + png.height + ", expected " +
            options.width + "x" + options.height
        } else {
          return {
            ok: true,
            ms: performance.now() - startedAt,
            attempts: attempt,
            usedFallbackProfile: usedFallback,
          }
        }
      } catch (error) {
        lastError = "screenshot is not a valid PNG: " + errorText(error)
      }
    }
  }

  return {
    ok: false,
    ms: performance.now() - startedAt,
    attempts,
    usedFallbackProfile: usedFallback,
    error: lastError,
  }
}

// ---------------------------------------------------------------------------
// Decoding
// ---------------------------------------------------------------------------

interface DecodeOutcome {
  data: string | null
  ms: number
  error?: string
}

function decodePng(png: PNG): DecodeOutcome {
  const startedAt = performance.now()
  try {
    // Always pass options explicitly: jsQR 1.4.0 mutates its shared default options object.
    const code = jsQR(new Uint8ClampedArray(png.data), png.width, png.height, {
      inversionAttempts: "attemptBoth",
    })
    return { data: code?.data ?? null, ms: performance.now() - startedAt }
  } catch (error) {
    return { data: null, ms: performance.now() - startedAt, error: errorText(error) }
  }
}

function cropPng(source: PNG, x: number, y: number, width: number, height: number): PNG {
  const target = new PNG({ width, height })
  for (let row = 0; row < height; row += 1) {
    const sourceStart = ((y + row) * source.width + x) * 4
    const targetStart = row * width * 4
    source.data.copy(target.data, targetStart, sourceStart, sourceStart + width * 4)
  }
  return target
}

// ---------------------------------------------------------------------------
// HTML pages
// ---------------------------------------------------------------------------

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

const BASE_STYLE =
  "html,body{margin:0;padding:0;background:#fff;overflow:hidden}" +
  "svg{display:block;width:auto;height:auto}"

function renderSoloPage(svg: string, pageSize: number, svgMax: number): string {
  return (
    '<!doctype html><html><head><meta charset="utf-8"><title>Yopem QR verification</title>' +
    "<style>" +
    BASE_STYLE +
    "html,body{width:" + pageSize + "px;height:" + pageSize + "px;display:flex;" +
    "align-items:center;justify-content:center}" +
    "svg{max-width:" + svgMax + "px;max-height:" + svgMax + "px}" +
    "</style></head><body>" + svg + "</body></html>\n"
  )
}

interface GridSpec {
  cols: number
  cell: number
  gap: number
  pad: number
  svgMax: number
  pageWidth: number
  pageHeight: number
  title: string
}

function renderGridPage(cases: RenderRecord[], options: GridSpec): string {
  const cells = cases
    .map((record, index) => {
      const column = index % options.cols
      const row = Math.floor(index / options.cols)
      const left = options.pad + column * (options.cell + options.gap)
      const top = options.pad + row * (options.cell + options.gap)
      return (
        '<div class="cell" data-case="' + escapeHtml(record.case.id) + '" style="left:' + left +
        "px;top:" + top + "px;width:" + options.cell + "px;height:" + options.cell + 'px">' +
        record.svg + "</div>"
      )
    })
    .join("\n")
  return (
    '<!doctype html><html><head><meta charset="utf-8"><title>' + escapeHtml(options.title) +
    "</title><style>" + BASE_STYLE +
    "html,body{width:" + options.pageWidth + "px;height:" + options.pageHeight + "px}" +
    ".cell{position:absolute;display:flex;align-items:center;justify-content:center;background:#fff;overflow:hidden}" +
    ".cell svg{max-width:" + options.svgMax + "px;max-height:" + options.svgMax + "px}" +
    "</style></head><body>\n" + cells + "\n</body></html>\n"
  )
}

// ---------------------------------------------------------------------------
// Filesystem helpers
// ---------------------------------------------------------------------------

function formatRunId(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, "0")
  return (
    "run-" + date.getFullYear() + pad(date.getMonth() + 1) + pad(date.getDate()) +
    "-" + pad(date.getHours()) + pad(date.getMinutes()) + pad(date.getSeconds())
  )
}

function fileId(id: string): string {
  return id.replace(/[^a-z0-9._-]+/gi, "_")
}

function relativeToRoot(path: string): string {
  return relative(ROOT, path).replace(/\\/g, "/")
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function pruneOldRuns(keep: number): void {
  try {
    const entries = readdirSync(RUNS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^run-\d{8}-\d{6}$/.test(entry.name))
      .map((entry) => entry.name)
      .sort()
      .reverse()
    for (const name of entries.slice(keep)) {
      rmSync(join(RUNS_DIR, name), { recursive: true, force: true })
    }
  } catch {
    // Pruning is best-effort housekeeping; never fail a verification run for it.
  }
}

function readPackageVersion(packageName: string): string {
  try {
    const manifest = JSON.parse(
      readFileSync(join(ROOT, "node_modules", packageName, "package.json"), "utf8"),
    ) as { version?: string }
    return manifest.version ?? "unknown"
  } catch {
    return "unknown"
  }
}

// ---------------------------------------------------------------------------
// Report types
// ---------------------------------------------------------------------------

interface EnvironmentInfo {
  platform: string
  release: string
  arch: string
  cpus: number
  bun: string
  chrome: { path: string; version: string }
  jsqr: string
  pngjs: string
}

interface RunSummary {
  total: number
  decodeCases: number
  warningCases: number
  passed: number
  failed: number
  knownLimitations: number
  errors: number
  requiredFailures: number
  durationMs: number
  screenshotMs: number
  decodeMs: number
}

interface RunReport {
  schema: 1
  tool: string
  mode: "batch" | "solo" | "dry-run"
  runId: string
  startedAt: string
  finishedAt: string
  environment: EnvironmentInfo
  config: {
    quick: boolean
    filter: string | null
    keep: string
    renderSize: number
    screenshot: { mode: string; soloPage: number; gridCell: number; denseCell: number }
    profileDir: string
    runDir: string
    seed: string
  }
  cases: CaseResult[]
  summary: RunSummary
  failures: Array<{ id: string; status: CaseStatus; reasons: string[] }>
  warnings: Array<{ id: string; code: string; level: string; message: string }>
}

function makeEnvironment(chromePath: string): EnvironmentInfo {
  return {
    platform: osPlatform(),
    release: osRelease(),
    arch: osArch(),
    cpus: cpus().length,
    bun: typeof Bun !== "undefined" ? Bun.version : (process.versions.bun ?? "unknown"),
    chrome: { path: chromePath, version: detectChromeVersion(chromePath) },
    jsqr: readPackageVersion("jsqr"),
    pngjs: readPackageVersion("pngjs"),
  }
}

function statusLabel(status: CaseStatus): string {
  switch (status) {
    case "pass":
      return "PASS"
    case "fail":
      return "FAIL"
    case "known-limitation":
      return "KNOWN"
    case "error":
      return "ERROR"
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const options = parseCli(process.argv.slice(2))
  if (options.help) {
    console.log(HELP)
    return
  }

  const allCases = buildCases()
  if (options.list) {
    for (const testCase of selectCases(allCases, options)) {
      console.log(
        testCase.id + "\t" + testCase.group + "\t" +
          (testCase.requireDecode === false ? "warning" : "decode") +
          (testCase.required === false ? "\toptional" : ""),
      )
    }
    return
  }

  const selected = selectCases(allCases, options)
  if (selected.length === 0) {
    fatal(
      "No cases matched" +
        (options.quick ? " --quick" : "") +
        (options.filter ? " --filter=" + options.filter : "") +
        ".",
    )
  }

  const chromePath = findChrome(options.chrome)
  const startedAt = new Date()
  const runDir = join(RUNS_DIR, RUN_ID)
  const fallbackProfileDir = options.profile + "-fallback"
  mkdirSync(runDir, { recursive: true })
  if (!options.dryRun) mkdirSync(options.profile, { recursive: true })

  const environment = makeEnvironment(chromePath)
  const mode: RunReport["mode"] = options.dryRun
    ? "dry-run"
    : options.backend === "solo"
      ? "solo"
      : "batch"

  if (!options.json) {
    console.log("Yopem QR — end-to-end scan verification (" + mode + ")")
    console.log(
      "environment: bun " + environment.bun + " · chrome " + environment.chrome.version +
        " · jsQR " + environment.jsqr + " · pngjs " + environment.pngjs +
        " · " + environment.platform + " " + environment.arch,
    )
    console.log(
      "cases: " + selected.length + " (" +
        selected.filter((testCase) => needsDecode(testCase)).length + " decode, " +
        selected.filter((testCase) => !needsDecode(testCase)).length + " warning)" +
        " · quick=" + options.quick +
        " · filter=" + (options.filter ?? "(all)") +
        (options.dryRun ? " · dry-run" : ""),
    )
    console.log("artifacts: " + relativeToRoot(runDir))
    console.log("")
  } else if (!options.dryRun) {
    console.error("[verify-qr] mode=" + mode + " cases=" + selected.length + " artifacts=" + runDir)
  }

  // 1. Render everything up-front: fast (~1ms/case) and gives warning
  //    assertions without touching the browser.
  const renderStartedAt = performance.now()
  const records = selected.map((testCase) => renderCase(testCase))
  const renderMs = performance.now() - renderStartedAt
  void renderMs

  const results: CaseResult[] = records.map((record) => {
    const { case: testCase, result } = record
    const requireDecode = testCase.requireDecode !== false
    const required = testCase.required !== false
    const failures = checkRenderAssertions(testCase, result)
    return {
      id: testCase.id,
      group: testCase.group,
      required,
      requireDecode,
      payload: { length: testCase.data.length, preview: testCase.data.slice(0, 64) },
      design: testCase.design,
      expected: {
        warnings: testCase.expectWarnings ?? [],
        forbidWarnings: testCase.forbidWarnings ?? [],
        renderError: testCase.expectedRenderError,
        knownLimitation: testCase.knownLimitation,
      },
      render: {
        version: result.matrix.version,
        size: result.matrix.size,
        errorCorrection: result.matrix.errorCorrectionLevel,
        width: result.width,
        height: result.height,
        svgBytes: record.svg.length,
        ms: record.ms,
        error: result.error,
        warnings: result.warnings,
      },
      decode: { attempted: false, matched: null, ms: 0 },
      assertions: [],
      failures,
      status: failures.length > 0 ? "fail" : "pass",
      timings: { screenshotMs: 0 },
      artifacts: {},
      note: testCase.note,
      knownLimitation: testCase.knownLimitation,
    }
  })

  const resultById = new Map(results.map((result) => [result.id, result]))
  const decodeRecords = records.filter((record) => needsDecode(record.case))
  let screenshotMs = 0
  let decodeMs = 0
  let browserUsed = false

  const assertDecode = (testCase: VerifyCase, outcome: DecodeOutcome): void => {
    const caseResult = resultById.get(testCase.id)
    if (!caseResult) return
    caseResult.decode = {
      attempted: true,
      matched: null,
      ms: outcome.ms,
      decoded: outcome.data === null ? null : outcome.data.slice(0, 96),
    }
    const check = checkDecode(testCase, outcome.data, outcome.error)
    caseResult.decode.matched = check.matched
    caseResult.decode.reason = check.reason
    caseResult.decode.firstDiffIndex = check.matched ? null : firstDiff(testCase.data, outcome.data)
    decodeMs += outcome.ms
    if (check.matched) {
      if (testCase.expectDecodeFailure) {
        caseResult.assertions.push(
          "known limitation no longer reproduces: this design now decodes — update docs/verification.md",
        )
      }
      if (caseResult.failures.length === 0) caseResult.status = "pass"
      return
    }
    if (testCase.expectDecodeFailure && testCase.knownLimitation) {
      if (caseResult.failures.length === 0) {
        caseResult.status = "known-limitation"
        caseResult.assertions.push(
          "expected jsQR failure reproduced: " + (check.reason ?? "decode mismatch"),
        )
        caseResult.knownLimitation = testCase.knownLimitation
      }
      return
    }
    if (!caseResult.required && testCase.knownLimitation) {
      if (caseResult.failures.length === 0) {
        caseResult.status = "known-limitation"
        caseResult.assertions.push("known limitation: " + (check.reason ?? "decode mismatch"))
        caseResult.knownLimitation = testCase.knownLimitation
      }
      return
    }
    caseResult.failures.push(check.reason ?? "decode mismatch")
    caseResult.status = "fail"
  }

    // 2. Browser decoding. Warning-only cases (requireDecode === false) never
  //    launch Chrome: their contract is the renderer warnings, not jsQR.
  if (!options.dryRun && decodeRecords.length > 0) {
    browserUsed = true
    if (options.backend === "solo") {
      for (const record of decodeRecords) {
        const testCase = record.case
        const htmlPath = join(runDir, fileId(testCase.id) + ".html")
        const pngPath = join(runDir, fileId(testCase.id) + ".png")
        const dense = testCase.dense === true
        const pageSize = dense ? Math.max(options.screenshotSize, 1000) : options.screenshotSize
        const svgMax = dense
          ? Math.round(pageSize * 0.9)
          : Math.round(options.screenshotSize * 0.833)
        writeFileSync(htmlPath, renderSoloPage(record.svg, pageSize, svgMax))
        if (!options.json) process.stdout.write("  decode " + testCase.id.padEnd(30) + " ... ")
        const shot = capturePage({
          chromePath,
          profileDir: options.profile,
          fallbackProfileDir,
          htmlPath,
          pngPath,
          width: pageSize,
          height: pageSize,
          timeoutMs: options.timeoutMs,
          retries: options.retries,
        })
        screenshotMs += shot.ms
        const caseResult = resultById.get(testCase.id)
        if (caseResult) {
          caseResult.timings.screenshotMs = shot.ms
          caseResult.artifacts = {
            html: relativeToRoot(htmlPath),
            png: shot.ok ? relativeToRoot(pngPath) : undefined,
          }
        }
        if (!shot.ok) {
          if (caseResult) {
            caseResult.status = "error"
            caseResult.failures.push("screenshot failed: " + (shot.error ?? "unknown error"))
          }
          if (!options.json) console.log("SCREENSHOT ERROR")
          continue
        }
        const decode = decodePng(PNG.sync.read(readFileSync(pngPath)))
        assertDecode(testCase, decode)
        if (!options.json) {
          console.log(
            (resultById.get(testCase.id)?.status === "pass" ? "PASS" : "FAIL") +
              " " + Math.round(shot.ms) + "ms shot / " + Math.round(decode.ms) + "ms decode",
          )
        }
      }
    } else {
      // Batch mode: 4x4 grids at 520px cells; dense payloads on a 760px 2-column page.
      interface Batch {
        records: RenderRecord[]
        page: string
        width: number
        height: number
        name: string
      }
      const batches: Batch[] = []
      const normal = decodeRecords.filter((record) => !record.case.dense)
      const dense = decodeRecords.filter((record) => record.case.dense)

      for (let index = 0; index < normal.length; index += GRID_COLS * GRID_ROWS) {
        const pageRecords = normal.slice(index, index + GRID_COLS * GRID_ROWS)
        batches.push({
          records: pageRecords,
          page: renderGridPage(pageRecords, {
            cols: GRID_COLS,
            cell: GRID_CELL,
            gap: GRID_GAP,
            pad: GRID_PAD,
            svgMax: GRID_SVG,
            pageWidth: GRID_PAGE_W,
            pageHeight: GRID_PAGE_H,
            title: "Yopem QR verification grid " + (batches.length + 1),
          }),
          width: GRID_PAGE_W,
          height: GRID_PAGE_H,
          name: "grid-" + String(batches.length + 1).padStart(2, "0"),
        })
      }
      for (let index = 0; index < dense.length; index += DENSE_COLS * 2) {
        const pageRecords = dense.slice(index, index + DENSE_COLS * 2)
        const rows = Math.ceil(pageRecords.length / DENSE_COLS)
        const height = DENSE_PAD * 2 + rows * DENSE_CELL + (rows - 1) * DENSE_GAP
        batches.push({
          records: pageRecords,
          page: renderGridPage(pageRecords, {
            cols: DENSE_COLS,
            cell: DENSE_CELL,
            gap: DENSE_GAP,
            pad: DENSE_PAD,
            svgMax: DENSE_SVG,
            pageWidth: DENSE_PAGE_W,
            pageHeight: height,
            title: "Yopem QR verification dense grid " + (batches.length + 1),
          }),
          width: DENSE_PAGE_W,
          height,
          name: "dense-" + String(batches.length + 1).padStart(2, "0"),
        })
      }

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
        const batch = batches[batchIndex]
        const htmlPath = join(runDir, batch.name + ".html")
        const pngPath = join(runDir, batch.name + ".png")
        writeFileSync(htmlPath, batch.page)
        if (!options.json) {
          console.log(
            "  batch " + (batchIndex + 1) + "/" + batches.length + " " + batch.name +
              " (" + batch.records.length + " cases, " + batch.width + "x" + batch.height + ") ...",
          )
        }
        const shot = capturePage({
          chromePath,
          profileDir: options.profile,
          fallbackProfileDir,
          htmlPath,
          pngPath,
          width: batch.width,
          height: batch.height,
          timeoutMs: options.timeoutMs,
          retries: options.retries,
        })
        screenshotMs += shot.ms
        if (!shot.ok) {
          for (const record of batch.records) {
            const caseResult = resultById.get(record.case.id)
            if (!caseResult) continue
            caseResult.status = "error"
            caseResult.failures.push("screenshot failed: " + (shot.error ?? "unknown error"))
            caseResult.artifacts = {
              html: relativeToRoot(htmlPath),
              gridPage: relativeToRoot(htmlPath),
            }
          }
          if (!options.json) console.log("    SCREENSHOT ERROR: " + (shot.error ?? "unknown"))
          continue
        }
        const pagePng = PNG.sync.read(readFileSync(pngPath))
        const densePage = batch.name.startsWith("dense-")
        const cell = densePage ? DENSE_CELL : GRID_CELL
        const gap = densePage ? DENSE_GAP : GRID_GAP
        const pad = densePage ? DENSE_PAD : GRID_PAD
        const cols = densePage ? DENSE_COLS : GRID_COLS
        for (let index = 0; index < batch.records.length; index += 1) {
          const record = batch.records[index]
          const column = index % cols
          const row = Math.floor(index / cols)
          const cellPng = cropPng(
            pagePng,
            pad + column * (cell + gap),
            pad + row * (cell + gap),
            cell,
            cell,
          )
          const cellPngPath = join(runDir, fileId(record.case.id) + ".png")
          writeFileSync(cellPngPath, PNG.sync.write(cellPng))
          const caseHtmlPath = join(runDir, fileId(record.case.id) + ".html")
          writeFileSync(caseHtmlPath, renderSoloPage(record.svg, SOLO_PAGE, SOLO_SVG))
          const caseResult = resultById.get(record.case.id)
          if (caseResult) {
            caseResult.artifacts = {
              html: relativeToRoot(caseHtmlPath),
              png: relativeToRoot(cellPngPath),
              gridPage: relativeToRoot(pngPath),
            }
          }
          const decode = decodePng(cellPng)
          assertDecode(record.case, decode)
          if (!options.json) {
            const status = resultById.get(record.case.id)?.status
            console.log(
              "    " + (status === "pass" ? "PASS" : status === "known-limitation" ? "KNOWN" : "FAIL") +
                " " + record.case.id.padEnd(28) + " " + Math.round(decode.ms) + "ms",
            )
          }
        }
      }
    }
  }

  // 3. Aggregate.
  const decodeCases = selected.filter((testCase) => needsDecode(testCase)).length
  const knownLimitations = results.filter((result) => result.status === "known-limitation")
  const errors = results.filter((result) => result.status === "error")
  const passed = results.filter((result) => result.status === "pass")
  const failed = results.filter((result) => result.status === "fail")
  const requiredFailures = results.filter(
    (result) => result.required && (result.status === "fail" || result.status === "error"),
  )

  const summary: RunSummary = {
    total: results.length,
    decodeCases,
    warningCases: results.length - decodeCases,
    passed: passed.length,
    failed: failed.length,
    knownLimitations: knownLimitations.length,
    errors: errors.length,
    requiredFailures: requiredFailures.length,
    durationMs: performance.now() - renderStartedAt,
    screenshotMs,
    decodeMs,
  }

  const finishedAt = new Date()
  const warningSnapshot = results.flatMap((result) =>
    result.render.warnings.map((warning) => ({
      id: result.id,
      code: warning.code,
      level: warning.level,
      message: warning.message,
    })),
  )
  const report: RunReport = {
    schema: 1,
    tool: "scripts/verify-qr-scan.ts",
    mode,
    runId: RUN_ID,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    environment,
    config: {
      quick: options.quick,
      filter: options.filter,
      keep: options.keep,
      renderSize: RENDER_SIZE,
      screenshot: {
        mode: options.backend,
        soloPage: options.screenshotSize,
        gridCell: GRID_CELL,
        denseCell: DENSE_CELL,
      },
      profileDir: relativeToRoot(options.profile),
      runDir: relativeToRoot(runDir),
      seed: "none (all payloads and designs are fixed constants)",
    },
    cases: results,
    summary,
    failures: requiredFailures.map((result) => ({
      id: result.id,
      status: result.status,
      reasons: [...result.assertions, ...result.failures],
    })),
    warnings: warningSnapshot,
  }

  writeFileSync(RESULTS_PATH, JSON.stringify(report, null, 2) + "\n")
  writeFileSync(join(runDir, "results.json"), JSON.stringify(report, null, 2) + "\n")
  writeFileSync(join(VERIFY_DIR, "latest-run.txt"), relativeToRoot(runDir) + "\n")

  // 4. Artifact retention: --keep=failures keeps only failing screenshots,
  //    --keep=none keeps only the per-run results.json written above.
  if (options.keep !== "all") {
    const removable = options.keep === "failures" ? passed : results
    for (const result of removable) {
      for (const artifact of Object.values(result.artifacts)) {
        if (!artifact) continue
        const absolute = join(ROOT, artifact)
        if (existsSync(absolute)) rmSync(absolute, { force: true })
      }
    }
  }
  pruneOldRuns(KEEP_RUNS)

  // 5. Output.
  if (options.json) {
    console.log(JSON.stringify(report, null, 2))
    process.exit(requiredFailures.length > 0 ? 1 : 0)
  }

  if (options.markdown) {
    console.log("| Case | Group | Status | Version | EC | Decode | Notes |")
    console.log("| --- | --- | --- | --- | --- | --- | --- |")
    for (const result of results) {
      const decode =
        result.decode.matched === null ? "—" : result.decode.matched ? "ok" : "failed"
      const notes = [...result.assertions, ...result.failures, result.knownLimitation ?? ""]
        .filter(Boolean)
        .join("; ")
      console.log(
        "| `" + result.id + "` | " + result.group + " | " + statusLabel(result.status) +
          " | " + result.render.version + " | " + result.render.errorCorrection +
          " | " + decode + " | " + notes.replace(/\|/g, "\\|") + " |",
      )
    }
    console.log("")
    console.log(
      "**Summary:** " + summary.passed + "/" + summary.total + " passed · " +
        summary.failed + " failed · " + summary.knownLimitations + " known limitation(s) · " +
        summary.errors + " error(s) · " + (summary.durationMs / 1000).toFixed(1) + "s",
    )
    process.exit(requiredFailures.length > 0 ? 1 : 0)
  }

  console.log("")
  let group = ""
  for (const result of results) {
    if (result.group !== group) {
      group = result.group
      console.log(group + " (" + results.filter((entry) => entry.group === group).length + ")")
    }
    const decodeInfo = result.decode.attempted
      ? (result.decode.matched ? "decoded " : "NOT decoded ") + "+" + Math.round(result.decode.ms) + "ms"
      : "render-only"
    const warnings = result.render.warnings.length
      ? "  warnings=" + result.render.warnings.map((warning) => warning.code).join(",")
      : ""
    console.log(
      "  " + statusLabel(result.status).padEnd(6) + " " + result.id.padEnd(30) +
        " v" + String(result.render.version).padEnd(3) +
        " EC " + result.render.errorCorrection +
        "  " + decodeInfo + warnings,
    )
    for (const failure of [...result.assertions, ...result.failures]) {
      console.log("         ↳ " + failure)
    }
    if (result.status === "known-limitation" && result.knownLimitation) {
      console.log("         ↳ known limitation: " + result.knownLimitation)
    }
  }

  console.log("")
  console.log(
    "SUMMARY: " + summary.passed + "/" + summary.total + " passed · " +
      summary.failed + " failed · " + summary.knownLimitations + " known-limitation · " +
      summary.errors + " error · " + (summary.durationMs / 1000).toFixed(1) + "s total" +
      " (screenshots " + (screenshotMs / 1000).toFixed(1) + "s, jsQR " + (decodeMs / 1000).toFixed(1) + "s)",
  )
  console.log("results: " + relativeToRoot(RESULTS_PATH) + " · artifacts: " + relativeToRoot(runDir))

  if (requiredFailures.length > 0) {
    console.log("")
    console.log("FAILURES:")
    for (const failure of requiredFailures) {
      console.log("  " + failure.id + ": " + [...failure.assertions, ...failure.failures].join("; "))
    }
    process.exit(1)
  }

  if (!browserUsed && !options.dryRun) {
    console.log("note: no decode cases selected — browser was not used")
  }
}

main().catch((error) => {
  console.error("verify-qr-scan: unexpected failure: " + errorText(error))
  process.exit(2)
})
