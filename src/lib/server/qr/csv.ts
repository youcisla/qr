import type { QrCodeWithDesign } from "./service"

/** Escape one CSV cell and neutralise spreadsheet formula injection. */
function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return ""
  let text = String(value).replace(/\r\n|\r|\n/g, " ")
  if (/^[=+\-@\t]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

function buildRow(cells: unknown[]): string {
  return cells.map(escapeCell).join(",")
}

function designSummary(code: QrCodeWithDesign): string {
  const { design } = code
  return [
    design.dotStyle,
    design.eyeFrameStyle,
    design.eyeBallStyle,
    design.errorCorrection,
    design.quietZone,
  ].join(" / ")
}

function fillColor(code: QrCodeWithDesign): string {
  const fill = code.design.foreground
  return fill.type === "solid" ? fill.color : "gradient"
}

function backgroundColor(code: QrCodeWithDesign): string {
  if (code.design.transparentBackground) return "transparent"
  const fill = code.design.background
  return fill.type === "solid" ? fill.color : "gradient"
}

const HEADERS = [
  "id",
  "title",
  "description",
  "type",
  "status",
  "content_type",
  "short_code",
  "short_url",
  "destination_url",
  "encoded_data",
  "tags",
  "scan_count",
  "unique_scan_count",
  "last_scanned_at",
  "expires_at",
  "created_at",
  "updated_at",
  "dot_style",
  "eye_frame_style",
  "eye_ball_style",
  "foreground",
  "background",
  "error_correction",
  "has_logo",
  "frame_style",
  "design_summary",
  "design_json",
]

/**
 * Build the CSV export of a user's QR codes. The output always starts with a
 * UTF-8 BOM so Excel opens unicode titles correctly.
 */
export function buildQrCodesCsv(codes: QrCodeWithDesign[], origin: string): string {
  const normalisedOrigin = origin.replace(/\/+$/, "")
  const lines: string[] = [buildRow(HEADERS)]
  for (const code of codes) {
    lines.push(
      buildRow([
        code.id,
        code.title,
        code.description,
        code.type,
        code.status,
        code.contentType,
        code.shortCode,
        code.type === "dynamic" && code.shortCode ? `${normalisedOrigin}/${code.shortCode}` : "",
        code.destinationUrl,
        code.encodedData,
        code.tags.join("; "),
        code.scanCount,
        code.uniqueScanCount,
        code.lastScannedAt?.toISOString() ?? "",
        code.expiresAt?.toISOString() ?? "",
        code.createdAt.toISOString(),
        code.updatedAt.toISOString(),
        code.design.dotStyle,
        code.design.eyeFrameStyle,
        code.design.eyeBallStyle,
        fillColor(code),
        backgroundColor(code),
        code.design.errorCorrection,
        code.design.logo ? "yes" : "no",
        code.design.frame?.style ?? "none",
        designSummary(code),
        JSON.stringify(code.design),
      ]),
    )
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`
}
