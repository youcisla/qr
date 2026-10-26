# QR verification — end-to-end scan harness

**Status: 60-case matrix · 55 PASS · 5 documented jsQR limitations · 0 failures.**
Harness: `scripts/verify-qr-scan.ts` (Bun + headless Chrome + pngjs + jsQR).
Last full run: **solo mode**, 45 headless Chrome launches, ~52 s (up to ~100 s under heavy machine load), **no required failures** (55 passes + 5 expected decoder failures).
Batch mode (default) runs the same assertions in ~7-13 s with 4-5 Chrome launches.

This document is the evidence report for the QR-engine verification work. It records what is verified, how to reproduce it, the current pass/fail matrix, the engine tuning decisions that came out of failures, and the known limits of the reference decoder used by the harness.

---

## What is verified

The harness verifies the **rendered output of the QR engine decodes back to the exact payload**, not just that the renderer returns an SVG string.

Pipeline per case:

1. `renderQrSvg({ data, design, size: 512 })` from `src/lib/qr/render.ts` produces an SVG plus matrix and scanability warnings.
2. The SVG is embedded in a standalone white HTML page (one page per case, plus grid pages in batch mode).
3. Headless Chrome screenshots the page as a PNG (`--headless=new --screenshot`, reusable profile under `.tmp/verify/chrome-profile`).
4. `pngjs` reads the screenshot pixels; `jsQR` decodes them and the decoded string is compared byte-for-byte with the payload.
5. Separately, `renderQrSvg().warnings` is asserted against the expected scanability warnings for negative cases (low contrast, oversized logo, quiet zone, ...).

The harness also validates structural invariants for every case: `matrix.size === 17 + 4 * version`, `matrix.modules.length === size²`, the requested error-correction level reaches the matrix, the SVG starts with `<svg` and carries `role="img"`, and (for decode cases) no unexpected error-level warning is emitted.

### Matrix coverage

| Section | Cases | What it covers |
| --- | --- | --- |
| `dot` | 10 | every `DotStyle` (square, rounded, dots, diamond, star, cross, leaf, classy, hexagon, squircle) at EC H |
| `eye-frame` | 6 | every `EyeFrameStyle` (square, rounded, circle, leaf, octagon, squircle) |
| `eye-ball` | 5 | every `EyeBallStyle` (square, rounded, dots, leaf, squircle) |
| `fill` | 3 | solid, linear gradient, radial gradient |
| `background` | 2 | transparent background, inverted colours (light modules on dark) |
| `logo` | 1 | pngjs-built PNG data-URL logo, EC H, cleared modules |
| `frame` | 4 | frame `none`, `rounded`, `banner`, `badge` with captions |
| `quiet-zone` | 2 | quiet zone 2 vs 4 modules |
| `ec` | 4 | error-correction L / M / Q / H |
| `payload` | 3 | short URL, ~200-char URL (version 10), multi-line vCard (version 8) |
| `template` | 6 | templates `classic`, `brand-gradient`, `confetti`, `print-frame`, `ocean`, `neon` |
| `limits` | 6 | documented jsQR decoder limitations, decode failure asserted |
| `warning` | 8 | negative cases for scanability warnings (render-only) |

Determinism: every payload and design is a fixed constant, case order is fixed, and Chrome runs sequentially with `--force-device-scale-factor=1`. Only timing numbers vary between runs; pass/fail statuses are stable. There is no randomness, no network access, and no new dependency (pngjs and jsqr were already in `node_modules`).

---

## How to run

From the repository root:

```powershell
# Default: batch screenshots (4-5 Chrome launches, ~7-13 s), full 60-case matrix
bun run scripts/verify-qr-scan.ts

# Strict one-Chrome-launch-per-case mode (~52 s, 45 launches; up to ~100 s under load)
bun run scripts/verify-qr-scan.ts --solo

# Fast core matrix (~7 s), useful while iterating on the engine
bun run scripts/verify-qr-scan.ts --quick

# Only cases whose id/group matches a substring, machine-readable output
bun run scripts/verify-qr-scan.ts --filter=dot --json

# Render + warning assertions only, no browser (sub-second)
bun run scripts/verify-qr-scan.ts --dry-run

# package.json alias for the default run
bun run verify:qr
```

Flags:

| Flag | Meaning |
| --- | --- |
| `--quick` | core safe matrix only (23 cases) |
| `--filter=<substring>` | case id/group substring filter |
| `--json` | machine-readable JSON on stdout only |
| `--markdown` | markdown pass/fail table only |
| `--dry-run` / `--preflight` | render + warning assertions, no browser |
| `--list` | list case ids and exit |
| `--solo` / `--batch` | one Chrome launch per case / grid screenshots (default) |
| `--keep=all\|failures\|none` | artifact retention (default `all`) |
| `--chrome=<path>` | Chrome/Edge executable (also `QR_CHROME_PATH` env var) |
| `--profile=<path>` | reusable Chrome profile (default `.tmp/verify/chrome-profile`) |
| `--timeout=<ms>` | per-screenshot Chrome timeout (default 120000) |
| `--screenshot-size=<px>` | solo-mode page size (default 720; dense cases use 1000) |
| `--retries=<n>` | screenshot retries (default 2; the last retry goes to a fallback profile) |

Exit codes: `0` all required assertions passed, `1` at least one required case failed or a harness/browser error occurred, `2` fatal usage/environment error (no Chrome found, bad flag, empty filter).

Outputs:

- `.tmp/verify/results.json` — latest machine-readable report (cases, warnings, environment, timings).
- `.tmp/verify/runs/run-<timestamp>/` — HTML pages, grid screenshots, per-case cropped PNGs, `results.json`. Last 5 runs are kept.
- `.tmp/verify/latest-run.txt` — relative path of the newest run directory.

The last report records `report.mode` (`batch`, `solo`, or `dry-run`) and `report.config`, so a filtered or dry run cannot be mistaken for a full evidence run.

### Screenshot sizes

| Mode | Page | QR raster size | Notes |
| --- | --- | --- | --- |
| batch grid | 2128x2128, 520 px cells | ≤488 px | 16 cases per launch; dense page 1552x784 with 760 px cells (≤728 px QR) |
| batch dense | 1552xN | ≤728 px | long URL (v10) and diamond dot style |
| solo | 720x720 | ≤600 px | one launch per case; dense cases 1000x1000, ≤900 px QR |

The dense route exists because jsQR is resolution-sensitive for the diamond dot style (~19 px per module needed even at EC H) and for the ~200-char URL. Real phone scanners need far less; this is a decoder limit, not a print requirement.

---

## Current pass/fail matrix

**Environment of the run recorded below**

| Item | Version |
| --- | --- |
| Bun | `1.3.14` |
| Chrome (headless) | `150.0.7871.47` at `C:\Program Files\Google\Chrome\Application\chrome.exe` |
| jsQR | `1.4.0` |
| pngjs | `5.0.0` (installed transitive version; only `PNG.sync` is used) |
| OS | Windows 11, `win32 10.0.26300`, x64, 14 logical CPUs |
| Modes | `--solo` 55 PASS + 5 KNOWN in ~52 s; `batch` 55 PASS + 5 KNOWN in ~7-13 s |

PASS = render invariants, expected warnings and payload decode all matched.
KNOWN = documented jsQR limitation reproduced (decode attempted and failed); does not fail the run.

| Section | Case | Status | QR version | EC | Decoded | Engine warnings |
| --- | --- | --- | --- | --- | --- | --- |
| dot | `dot:square` | PASS | 3 | H | yes | — |
| dot | `dot:rounded` | PASS | 3 | H | yes | — |
| dot | `dot:dots` | PASS | 3 | H | yes | — |
| dot | `dot:diamond` | PASS | 3 | H | yes | — |
| dot | `dot:star` | PASS | 3 | H | yes | — |
| dot | `dot:cross` | PASS | 3 | H | yes | — |
| dot | `dot:leaf` | PASS | 3 | H | yes | — |
| dot | `dot:classy` | PASS | 3 | H | yes | — |
| dot | `dot:hexagon` | PASS | 3 | H | yes | — |
| dot | `dot:squircle` | PASS | 3 | H | yes | — |
| eye-frame | `eyeframe:square` | PASS | 3 | H | yes | — |
| eye-frame | `eyeframe:rounded` | PASS | 3 | H | yes | — |
| eye-frame | `eyeframe:circle` | PASS | 3 | H | yes | — |
| eye-frame | `eyeframe:leaf` | PASS | 3 | H | yes | — |
| eye-frame | `eyeframe:octagon` | PASS | 3 | H | yes | — |
| eye-frame | `eyeframe:squircle` | PASS | 3 | H | yes | — |
| eye-ball | `eyeball:square` | PASS | 3 | H | yes | — |
| eye-ball | `eyeball:rounded` | PASS | 3 | H | yes | — |
| eye-ball | `eyeball:dots` | PASS | 3 | H | yes | — |
| eye-ball | `eyeball:leaf` | PASS | 3 | H | yes | — |
| eye-ball | `eyeball:squircle` | PASS | 3 | H | yes | — |
| fill | `fill:solid` | PASS | 2 | M | yes | — |
| fill | `fill:linear-gradient` | PASS | 2 | M | yes | — |
| fill | `fill:radial-gradient` | PASS | 2 | M | yes | — |
| background | `background:transparent` | PASS | 2 | M | yes | `transparent-background` (info) |
| background | `color:inverted` | PASS | 2 | M | yes | `inverted-colors` (warning) |
| logo | `logo:png-h` | PASS | 3 | H | yes | — |
| frame | `frame:none` | PASS | 2 | M | yes | — |
| frame | `frame:rounded` | PASS | 2 | M | yes | — |
| frame | `frame:banner` | PASS | 2 | M | yes | — |
| frame | `frame:badge` | PASS | 2 | M | yes | — |
| quiet-zone | `quietzone:2` | PASS | 2 | M | yes | `quiet-zone-small` (info) |
| quiet-zone | `quietzone:4` | PASS | 2 | M | yes | — |
| ec | `ec:L` | PASS | 2 | L | yes | — |
| ec | `ec:M` | PASS | 2 | M | yes | — |
| ec | `ec:Q` | PASS | 2 | Q | yes | — |
| ec | `ec:H` | PASS | 3 | H | yes | — |
| payload | `payload:short-url` | PASS | 2 | M | yes | — |
| payload | `payload:long-url` | PASS | 10 | M | yes | — |
| payload | `payload:vcard` | PASS | 8 | M | yes | — |
| template | `template:classic` | PASS | 2 | M | yes | — |
| template | `template:brand-gradient` | PASS | 2 | M | yes | — |
| template | `template:confetti` | PASS | 3 | H | yes | — |
| template | `template:print-frame` | PASS | 2 | M | yes | — |
| template | `template:ocean` | PASS | 2 | M | yes | — |
| template | `template:neon` | PASS | 2 | Q | — | `inverted-colors` (warning) |
| limits | `limit:dot-star-ec-m` | KNOWN | 2 | M | no | — |
| limits | `limit:dot-hexagon-ec-m` | KNOWN | 2 | M | no | — |
| limits | `limit:dot-diamond-ec-m` | PASS | 2 | M | — | `low-module-density` (warning) |
| limits | `limit:square-frame-dots-ball` | KNOWN | 3 | H | no | — |
| limits | `limit:square-frame-leaf-ball` | KNOWN | 3 | H | no | — |
| limits | `limit:leaf-frame-square-ball` | KNOWN | 3 | H | no | — |
| warning | `warning:low-contrast` | PASS | 2 | M | — | `low-contrast` (error) |
| warning | `warning:huge-logo` | PASS | 3 | H | — | `logo-too-large` (error) |
| warning | `warning:logo-without-ec` | PASS | 2 | M | — | `logo-without-error-correction` (warning) |
| warning | `warning:data-too-long` | PASS | 1 | H | — | `data-too-long` (error) |
| warning | `warning:quiet-zone-zero` | PASS | 2 | M | — | `quiet-zone-small` (warning) |
| warning | `warning:wide-module-gap` | PASS | 2 | M | — | `low-module-density` (warning) |
| warning | `warning:external-logo` | PASS | 3 | H | — | `external-logo` (info) |
| warning | `warning:long-frame-caption` | PASS | 2 | M | — | `frame-overlap` (info) |



---

## Warning thresholds: what the negative cases prove

Every warning expectation matched in the current run. The negative cases pin the thresholds so a future change in `src/lib/qr/scanability.ts` is noticed:

- `contrast < 3:1` → **error** `low-contrast`; `3.0-4.5:1` → **warning** `low-contrast`. Verified with `#d4d4d4` on white (1.5:1, error fires).
- Logo covering > 32 % → **error** `logo-too-large`; 25-32 % → warning. Verified with a 45 % logo (error fires) and an 18 % logo at EC H (no warning).
- Logo with `clearModules` below EC H → **warning** `logo-without-error-correction`. Verified at EC M.
- Quiet zone 0 → **warning** `quiet-zone-small`; quiet zone 1-3 → **info**; 4 passes without warnings. Verified for 0 and 2.
- `moduleGap > 0.2` → **warning** `low-module-density`. Verified at 0.3.
- `dotStyle: "diamond"` below EC H → **warning** `low-module-density`. Verified at EC M.
- Payload that cannot fit → `error: "data-too-long"`, placeholder SVG, **error** warning. Verified with 4000 chars at EC H.
- External (non-`data:`) logo URL → **info** `external-logo`; captions longer than 32 chars → **info** `frame-overlap`.
- Inverted colours → **warning** `inverted-colors`; transparent background → **info** `transparent-background`. Both verified.

### Observations for the Lead (thresholds worth a decision)

1. **star and hexagon module styles are not flagged below EC H.** `dot:star` and `dot:hexagon` at the default EC M fail jsQR in every run and at every resolution tried (420-688 px SVG), while `scanability.ts` only emits `low-module-density` for `diamond`. Either extend the warning/auto-bump to star/hexagon, or force EC H for shaped styles in the studio. Reproducers: `{ "dotStyle": "star" }` and `{ "dotStyle": "hexagon" }` with EC M.
2. **diamond needs a large raster for jsQR.** At EC H it decodes on a 688-728 px raster but not on the 488 px grid cell. Phones and print are not affected at typical sizes, but small on-screen previews may look riskier than they are.
3. **Gradient contrast uses the average stop colour.** The heuristic flags gradients by their mean stop colour, so a gradient whose darkest stop is fine can still trip `low-contrast` (an earlier Ocean palette, `#0ea5e9 → #14b8a6` on `#f0fdfa`, averages to ~2.5:1). The current Ocean template uses darker stops (`#0369a1 → #0f766e`, ~5.5:1) and passes. No action needed now, but worth remembering when authors add light gradients.
4. **Inverted dot-style codes are marginal for jsQR.** The Neon template decoded in some runs (488 px grid) and failed at 520-688 px in others; the harness therefore asserts only the `inverted-colors` warning for it, not the decode. Light-on-dark *rounded/square* designs (`color:inverted`) decode reliably and are required.

---

## Engine design choices that came from failures

These are visible in `src/lib/qr/geometry.ts` and were validated by this harness:

- **Densified star, hexagon, cross and diamond shapes.** `starPath` expands the sparkle to 1.16x the cell with an inner ratio of 0.68; `hexagonPath` expands the hexagon to 1.05x; `crossPath` uses 0.62-wide arms; the diamond style is drawn with a negative inset (`-24%` of the cell), i.e. an expanded diamond. `bulgedDiamondPath` (bowed-out diamond edges) remains in `geometry.ts` from the same tuning work. These changes keep dark coverage high enough for real decoders; without them the shapes lose too much of each module.
- **EC H is the safe level for stylised styles.** Every shaped dot style and every eye-style coverage case is verified at EC H. Star/hexagon/diamond fail jsQR at EC M; the engine already warns about diamond below H, and the warning gap for star/hexagon is item 1 above.
- **Removed unreliable eye styles.** Earlier tuning scripts exercised `EyeFrameStyle: "dots"` and `EyeBallStyle: "diamond"`; neither exists in the shipped `types.ts` contract (6 frame styles, 5 ball styles). The current contract keeps only shapes that the reference decoder can locate in at least one sensible pairing.
- **Eye shapes are verified in decoder-safe pairings.** jsQR's finder-pattern locator rejects a square or rounded frame with a circular/leaf ball, and rejects square balls inside asymmetric frames (circle/leaf/octagon). The harness verifies each frame style with a rounded ball and each ball style inside a rounded frame; the rejected pairings are kept as KNOWN cases so the evidence is not hidden.

## Known limitations

- Chrome profile note: the harness reuses a profile directory under `.tmp/verify/`; if a previous headless Chrome was killed, remove that profile directory before running (`Remove-Item -Recurse -Force .tmp/verify/chrome-profile*`), otherwise Chrome can exit 3 without writing a screenshot. Use `--profile=<path>` for an isolated run.


1. **jsQR is the only decoder used.** It is stricter than modern phone scanners. Everything marked KNOWN is a jsQR limitation; phone-scanner behaviour is unverified (no device/browser decoder available in this environment).
2. **Inverted dot-style designs are unreliable in jsQR**, as described above. The harness does not assert their decode.
3. **Diamond needs jsQR margin.** At EC < H the engine warns about it; at EC H jsQR needs a large raster (the harness routes diamond to the dense page), and at EC M jsQR fails the 488 px batch grid while decoding the 600 px+ solo raster.
4. **Specific eye-frame/eye-ball pairings fail jsQR locating**: square frame + dots/leaf ball, and circle/leaf/octagon frame + square ball. Other pairings of the same shapes decode.
5. **No physical print, camera, or mobile test.** The harness proves vector output rasterises and decodes on a desktop renderer; it cannot prove scanning at 2 cm print size, in low light, or from a screen at an angle.
6. **Warning heuristics are heuristics**, not decoder output. The harness pins their thresholds but cannot prove a "warning-free" design is universally scannable.
7. **pngjs 5.0.0** is the version installed in `node_modules` (not upstream 7). The harness uses only `PNG.sync.read/write` and the PNG constructor; a future upgrade should be a no-op but was not tested.
8. **Chrome must be installed locally.** The harness does not download a browser and does not touch the network.

### jsQR 1.4.0 quirks the harness works around

- `inversionAttempts: "onlyInvert"` throws `TypeError: matrix.height is undefined` (`scan()` receives `undefined` when `binarize` was called without `returnInverted`). The harness never uses it.
- `jsQR()` mutates its shared default options object. The harness always passes `{ inversionAttempts: "attemptBoth" }` explicitly so earlier calls cannot change later behaviour.
- For inverted codes `attemptBoth` is the only reliable mode, and even then it is marginal for dot-style modules.

---

## Reproducing the evidence

```powershell
cd C:\Users\Y.CHEHBOUB\PERSONAL__DO_NOT_TOUCH\qr
bun run scripts/verify-qr-scan.ts --solo   # authoritative strict run (~52 s, 45 Chrome launches)
bun run scripts/verify-qr-scan.ts          # fast batch run (~7-13 s, 4-5 Chrome launches)
```

Expected tail of the output:

```text
SUMMARY: 55/60 passed · 0 failed · 5 known-limitation · 0 error · ...
results: .tmp/verify/results.json · artifacts: .tmp/verify/runs/run-<timestamp>
```

`results.json` contains, per case: payload preview/length, design JSON, decoded payload preview, first differing byte index on mismatch, matrix version/EC/size, warnings with messages, screenshot and decode timings, and artifact paths. `report.warnings` gives a flat snapshot of every warning the engine emitted, which is convenient when tuning `scanability.ts`.

### Adding or changing cases

- Add cases in `buildCases()` in `scripts/verify-qr-scan.ts`; give each a stable id, a group, a fixed payload and design, and either `expectWarnings` (warning contract) or the default decode assertion.
- Warning-only cases set `requireDecode: false` and never launch Chrome.
- A case that is expected to expose a decoder limitation sets `expectDecodeFailure: true` plus `knownLimitation`. If it starts decoding, the run reports "known limitation no longer reproduces" instead of silently passing, so the docs can be updated.
- Keep `quick: true` on a cheap subset so `--quick` stays under ~10 s.
- Do not edit product source from the harness. Report renderer surprises to the QR-engine owner with the failing case id, payload and design JSON.

## Scope

This harness verifies the **QR renderer** only: `src/lib/qr/render.ts`, `geometry.ts`, `scanability.ts`, `types.ts`, `templates.ts` and the `qrcode` matrix builder. It does not exercise the SvelteKit studio UI, the camera scanner component, content-type codecs, export pipeline, or scan analytics. Those need their own integration/e2e coverage.
