import { dotPath, eyeBallPath, eyeFramePath, pathToSvg } from "./geometry"
import { buildQrMatrix, cloneMatrix, isEyeModule } from "./matrix"
import { buildScanWarnings } from "./scanability"
import { resolveDesign } from "./types"
import type { QrDesign, QrFill, QrMatrix, QrRenderResult, RenderQrOptions, ScanWarning } from "./types"

let svgIdCounter = 0

function nextId(prefix: string): string {
  svgIdCounter += 1
  return `yq-${prefix}-${svgIdCounter.toString(36)}`
}

function num(value: number, digits = 3): string {
  const factor = Math.pow(10, digits)
  return String(Math.round(value * factor) / factor)
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

function gradientDef(
  id: string,
  fill: Extract<QrFill, { type: "gradient" }>,
  box: BoundingBox,
): string {
  const stops = [...fill.gradient.stops]
    .filter((stop) => typeof stop.color === "string" && stop.color.length > 0)
    .sort((a, b) => a.offset - b.offset)
  if (stops.length === 0) return ""
  const stopTags = stops
    .map(
      (stop) =>
        `<stop offset="${num(Math.max(0, Math.min(1, stop.offset)))}" stop-color="${escapeXml(stop.color)}" />`,
    )
    .join("")

  if (fill.gradient.type === "linear") {
    const angle = (fill.gradient.angle * Math.PI) / 180
    const dx = Math.cos(angle)
    const dy = Math.sin(angle)
    const length = Math.abs(box.width * dx) + Math.abs(box.height * dy) || 1
    const centerX = box.x + box.width / 2
    const centerY = box.y + box.height / 2
    return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${num(centerX - (dx * length) / 2)}" y1="${num(centerY - (dy * length) / 2)}" x2="${num(centerX + (dx * length) / 2)}" y2="${num(centerY + (dy * length) / 2)}">${stopTags}</linearGradient>`
  }

  const centerX = box.x + box.width / 2
  const centerY = box.y + box.height / 2
  const radius = Math.hypot(box.width, box.height) / 2 || 1
  return `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${num(centerX)}" cy="${num(centerY)}" r="${num(radius)}">${stopTags}</radialGradient>`
}

interface Paint {
  defs: string
  attr: string
}

function paintFor(fill: QrFill, box: BoundingBox): Paint {
  if (fill.type === "solid") {
    return { defs: "", attr: escapeXml(fill.color) }
  }
  const id = nextId("grad")
  const defs = gradientDef(id, fill, box)
  if (!defs) return { defs: "", attr: "#000000" }
  return { defs, attr: `url(#${id})` }
}

function logoClearedMatrix(design: QrDesign, matrix: QrMatrix): QrMatrix {
  const logo = design.logo
  if (!logo || !logo.clearModules) return matrix
  const plateSize = matrix.size * logo.size * (1 + logo.padding * 2)
  const half = plateSize / 2
  const center = matrix.size / 2
  const start = Math.max(0, Math.floor(center - half - 0.5))
  const end = Math.min(matrix.size - 1, Math.ceil(center + half + 0.5))
  if (end < start) return matrix
  const cleared = cloneMatrix(matrix)
  for (let row = start; row <= end; row += 1) {
    for (let col = start; col <= end; col += 1) {
      if (isEyeModule(row, col, matrix.size)) continue
      cleared.modules[row * matrix.size + col] = 0
    }
  }
  return cleared
}

interface Layout {
  content: number
  pad: number
  totalWidth: number
  totalHeight: number
  qrX: number
  qrY: number
  fontSize: number
  labelHeight: number
  bottom: number
  hasFrame: boolean
  label: string
}

function computeLayout(design: QrDesign, matrixSize: number): Layout {
  const content = matrixSize + design.quietZone * 2
  const frame = design.frame
  const hasFrame = Boolean(frame && frame.style !== "none")
  const pad = hasFrame ? Math.max(1.8, content * 0.055) : 0
  const label = frame?.label?.trim() ?? ""
  const fontSize = content * (frame?.fontSize ?? 0.07)
  const style = frame?.style ?? "none"
  const supportsLabel =
    style === "rounded" ||
    style === "banner" ||
    style === "top" ||
    style === "badge" ||
    style === "ticket" ||
    style === "double"
  const labelHeight = hasFrame && supportsLabel && label
    ? style === "badge"
      ? fontSize * 2.1 + pad * 0.25
      : fontSize * 1.7 + pad * 0.3
    : 0
  const topOffset = hasFrame && label && style === "top" ? labelHeight : 0
  const bottomOffset = hasFrame
    ? style === "badge"
      ? labelHeight + pad * 0.2
      : style === "top"
        ? 0
        : labelHeight
    : 0
  return {
    content,
    pad,
    totalWidth: content + pad * 2,
    totalHeight: content + pad * 2 + topOffset + bottomOffset,
    qrX: pad,
    qrY: pad + topOffset,
    fontSize,
    labelHeight: hasFrame ? labelHeight : 0,
    bottom: bottomOffset,
    hasFrame,
    label,
  }
}

function estimatedTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.6
}

function renderFrame(design: QrDesign, layout: Layout): string {
  const frame = design.frame
  if (!frame || !layout.hasFrame) return ""
  const { totalWidth, totalHeight, pad, content, qrX, qrY } = layout
  const parts: string[] = []
  const frameColor = escapeXml(frame.frameColor)
  const labelColor = escapeXml(frame.labelColor)
  const style = frame.style
  const radius =
    style === "badge" || style === "banner" || style === "ticket"
      ? Math.max(0.8, pad * 0.75)
      : Math.max(0.8, pad)
  const borderWidth = Math.max(0.22, pad * 0.1)
  const fontFamily = "&quot;Segoe UI&quot;, system-ui, -apple-system, sans-serif"
  const label = layout.label
  const fitted = Math.min(layout.fontSize, (totalWidth - pad * 2) / Math.max(1, label.length * 0.6))
  const text = escapeXml(label)

  const drawLabel = (centerX: number, baselineY: number, size: number, weight = "700") => {
    parts.push(
      `<text x="${num(centerX)}" y="${num(baselineY)}" text-anchor="middle" font-family="${fontFamily}" font-size="${num(size)}" font-weight="${weight}" letter-spacing="${num(size * 0.04)}" fill="${labelColor}">${text}</text>`,
    )
  }

  if (label && layout.labelHeight > 0) {
    if (style === "banner") {
      const barY = qrY + content + pad * 0.1
      const barHeight = Math.max(0.4, layout.labelHeight - pad * 0.25)
      const barX = qrX + pad * 0.15
      const barWidth = content - pad * 0.3
      parts.push(
        `<rect x="${num(barX)}" y="${num(barY)}" width="${num(barWidth)}" height="${num(barHeight)}" rx="${num(Math.max(0.3, pad * 0.25))}" fill="${frameColor}" />`,
      )
      drawLabel(barX + barWidth / 2, barY + barHeight / 2 + fitted * 0.34, fitted)
    } else if (style === "top") {
      const barHeight = Math.max(0.4, layout.labelHeight - pad * 0.25)
      const barY = pad * 0.1
      const barX = qrX + pad * 0.15
      const barWidth = content - pad * 0.3
      parts.push(
        `<rect x="${num(barX)}" y="${num(barY)}" width="${num(barWidth)}" height="${num(barHeight)}" rx="${num(Math.max(0.3, pad * 0.25))}" fill="${frameColor}" />`,
      )
      drawLabel(barX + barWidth / 2, barY + barHeight / 2 + fitted * 0.34, fitted)
    } else if (style === "badge") {
      const pillHeight = Math.max(1.4, layout.labelHeight)
      const pillWidth = Math.min(
        totalWidth - pad * 2,
        estimatedTextWidth(label, fitted) + pillHeight * 0.9,
      )
      const pillY = qrY + content + pad * 0.15
      parts.push(
        `<rect x="${num((totalWidth - pillWidth) / 2)}" y="${num(pillY)}" width="${num(pillWidth)}" height="${num(pillHeight)}" rx="${num(pillHeight / 2)}" fill="${frameColor}" />`,
      )
      drawLabel(totalWidth / 2, pillY + pillHeight / 2 + fitted * 0.35, fitted)
    } else if (style === "ticket") {
      const lineY = qrY + content + pad * 0.1
      parts.push(
        `<line x1="${num(qrX + pad * 0.35)}" y1="${num(lineY)}" x2="${num(qrX + content - pad * 0.35)}" y2="${num(lineY)}" stroke="${frameColor}" stroke-width="${num(Math.max(0.15, pad * 0.07))}" stroke-dasharray="${num(pad * 0.35)} ${num(pad * 0.25)}" />`,
      )
      drawLabel(totalWidth / 2, lineY + layout.labelHeight / 2 + fitted * 0.4, fitted)
    } else {
      // rounded and double render the caption inside the bottom padding area
      const textY = qrY + content + layout.labelHeight / 2
      drawLabel(totalWidth / 2, textY + fitted * 0.35, fitted, style === "double" ? "600" : "700")
    }
  }

  if (style !== "simple") {
    if (style === "double") {
      const gap = Math.max(0.25, pad * 0.12)
      parts.push(
        `<rect x="${num(borderWidth / 2)}" y="${num(borderWidth / 2)}" width="${num(Math.max(1, totalWidth - borderWidth))}" height="${num(Math.max(1, totalHeight - borderWidth))}" rx="${num(Math.max(0, radius - borderWidth / 2))}" fill="none" stroke="${frameColor}" stroke-width="${num(borderWidth)}" />`,
      )
      const inset = borderWidth + gap
      parts.push(
        `<rect x="${num(inset)}" y="${num(inset)}" width="${num(Math.max(1, totalWidth - inset * 2))}" height="${num(Math.max(1, totalHeight - inset * 2))}" rx="${num(Math.max(0, radius - inset * 0.6))}" fill="none" stroke="${frameColor}" stroke-width="${num(Math.max(0.12, borderWidth * 0.45))}" opacity="0.55" />`,
      )
    } else {
      parts.push(
        `<rect x="${num(borderWidth / 2)}" y="${num(borderWidth / 2)}" width="${num(Math.max(1, totalWidth - borderWidth))}" height="${num(Math.max(1, totalHeight - borderWidth))}" rx="${num(Math.max(0, radius - borderWidth / 2))}" fill="none" stroke="${frameColor}" stroke-width="${num(borderWidth)}" />`,
      )
    }
  }

  return `<g class="qr-frame">${parts.join("")}</g>`
}

function renderLogo(design: QrDesign, matrix: QrMatrix, layout: Layout): string {
  const logo = design.logo
  if (!logo || !logo.src) return ""
  const content = layout.content
  const imageSize = content * logo.size
  const plateSize = imageSize * (1 + logo.padding * 2)
  const centerX = layout.qrX + content / 2
  const centerY = layout.qrY + content / 2
  const plateX = centerX - plateSize / 2
  const plateY = centerY - plateSize / 2
  const imageX = centerX - imageSize / 2
  const imageY = centerY - imageSize / 2
  const plateRadius = plateSize * logo.radius
  const parts: string[] = []

  if (logo.backgroundColor !== "transparent" && logo.backgroundColor.length > 0) {
    parts.push(
      `<rect x="${num(plateX)}" y="${num(plateY)}" width="${num(plateSize)}" height="${num(plateSize)}" rx="${num(plateRadius)}" fill="${escapeXml(logo.backgroundColor)}" />`,
    )
  }

  const imageRadius = imageSize * logo.radius
  const clipId = nextId("logo-clip")
  if (imageRadius > 0) {
    parts.push(
      `<clipPath id="${clipId}"><rect x="${num(imageX)}" y="${num(imageY)}" width="${num(imageSize)}" height="${num(imageSize)}" rx="${num(imageRadius)}" /></clipPath>`,
    )
    parts.push(
      `<image href="${escapeXml(logo.src)}" x="${num(imageX)}" y="${num(imageY)}" width="${num(imageSize)}" height="${num(imageSize)}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})" />`,
    )
  } else {
    parts.push(
      `<image href="${escapeXml(logo.src)}" x="${num(imageX)}" y="${num(imageY)}" width="${num(imageSize)}" height="${num(imageSize)}" preserveAspectRatio="xMidYMid slice" />`,
    )
  }

  return `<g class="qr-logo">${parts.join("")}</g>`
}

const FALLBACK_SVG = (size: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="QR content too long"><rect width="100" height="100" rx="8" fill="#f1f5f9" /><text x="50" y="52" text-anchor="middle" font-family="sans-serif" font-size="7" fill="#64748b">Content too long</text></svg>`

/**
 * Render a QR code to a standalone SVG string.
 *
 * Isomorphic: does not touch the DOM. Inline the result with `{@html}` or
 * serialise it for PNG/JPEG/PDF export via `export.ts`.
 */
export function renderQrSvg(options: RenderQrOptions): QrRenderResult {
  const design = resolveDesign(options.design)
  const errorCorrection = options.errorCorrection ?? design.errorCorrection
  const size = Math.max(64, Math.round(options.size ?? 512))
  const warnings: ScanWarning[] = []

  let matrix: QrMatrix
  try {
    matrix = buildQrMatrix(options.data, { errorCorrectionLevel: errorCorrection })
  } catch {
    return {
      svg: FALLBACK_SVG(size),
      matrix: { size: 21, modules: new Uint8Array(21 * 21), version: 1, errorCorrectionLevel: errorCorrection },
      warnings: [
        {
          level: "error",
          code: "data-too-long",
          message:
            "The content is too long to fit in a QR code at this error correction level. Shorten it or lower the error correction.",
        },
      ],
      width: 100,
      height: 100,
      error: "data-too-long",
    }
  }

  const logoMatrix = logoClearedMatrix(design, matrix)
  const layout = computeLayout(design, matrix.size)
  const contentBox: BoundingBox = {
    x: layout.qrX,
    y: layout.qrY,
    width: layout.content,
    height: layout.content,
  }
  const moduleBox: BoundingBox = {
    x: layout.qrX + design.quietZone,
    y: layout.qrY + design.quietZone,
    width: matrix.size,
    height: matrix.size,
  }

  const foreground = paintFor(design.foreground, contentBox)
  const background = paintFor(design.background, contentBox)
  const eyeFramePaint = design.eyeFrameColor
    ? { defs: "", attr: escapeXml(design.eyeFrameColor) }
    : foreground
  const eyeBallPaint = design.eyeBallColor
    ? { defs: "", attr: escapeXml(design.eyeBallColor) }
    : foreground

  const defs: string[] = [foreground.defs, background.defs].filter(Boolean)

  // Module shape is rendered once as a <path> and instanced with <use>.
  const gap = Math.max(0, Math.min(0.4, design.moduleGap))
  const inset = gap / 2
  const moduleShape = pathToSvg(
    dotPath(design.dotStyle, {
      x: inset,
      y: inset,
      width: 1 - gap,
      height: 1 - gap,
    }),
  )
  const moduleId = nextId("module")
  if (moduleShape) defs.push(`<path id="${moduleId}" d="${moduleShape}" />`)

  const uses: string[] = []
  for (let row = 0; row < matrix.size; row += 1) {
    for (let col = 0; col < matrix.size; col += 1) {
      if (logoMatrix.modules[row * matrix.size + col] !== 1) continue
      if (isEyeModule(row, col, matrix.size)) continue
      uses.push(
        `<use href="#${moduleId}" x="${num(moduleBox.x + col)}" y="${num(moduleBox.y + row)}" />`,
      )
    }
  }

  const eyeFrameId = nextId("eye-frame")
  const eyeBallId = nextId("eye-ball")
  const eyeFramesPath = [
    ...eyeFramePath(design.eyeFrameStyle, { x: 0, y: 0, size: 7 }),
    ...eyeFramePath(design.eyeFrameStyle, { x: matrix.size - 7, y: 0, size: 7 }),
    ...eyeFramePath(design.eyeFrameStyle, { x: 0, y: matrix.size - 7, size: 7 }),
  ]
  const eyeBallsPath = [
    ...eyeBallPath(design.eyeBallStyle, { x: 2, y: 2, size: 3 }),
    ...eyeBallPath(design.eyeBallStyle, { x: matrix.size - 5, y: 2, size: 3 }),
    ...eyeBallPath(design.eyeBallStyle, { x: 2, y: matrix.size - 5, size: 3 }),
  ]
  defs.push(`<path id="${eyeFrameId}" d="${pathToSvg(eyeFramesPath)}" />`)
  defs.push(`<path id="${eyeBallId}" d="${pathToSvg(eyeBallsPath)}" />`)

  const parts: string[] = []
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${num(layout.totalWidth)} ${num(layout.totalHeight)}" width="${size}" height="${num((size * layout.totalHeight) / layout.totalWidth)}" role="img" aria-label="QR code">`,
  )
  parts.push(`<title>QR code</title>`)
  if (defs.length > 0) parts.push(`<defs>${defs.join("")}</defs>`)

  // Frame plate sits underneath the QR content.
  if (layout.hasFrame && design.frame) {
    const frame = design.frame
    const radius =
      frame.style === "banner" || frame.style === "badge" || frame.style === "ticket"
        ? Math.max(0.8, layout.pad * 0.75)
        : Math.max(0.8, layout.pad)
    if (frame.backgroundColor !== "transparent" && frame.backgroundColor.length > 0) {
      parts.push(
        `<rect x="0" y="0" width="${num(layout.totalWidth)}" height="${num(layout.totalHeight)}" rx="${num(radius)}" fill="${escapeXml(frame.backgroundColor)}" />`,
      )
    }
  }

  if (!design.transparentBackground) {
    parts.push(
      `<rect x="${num(contentBox.x)}" y="${num(contentBox.y)}" width="${num(contentBox.width)}" height="${num(contentBox.height)}" fill="${background.attr}" />`,
    )
  }

  if (uses.length > 0) {
    parts.push(`<g class="qr-modules" fill="${foreground.attr}">${uses.join("")}</g>`)
  }

  parts.push(
    `<g class="qr-eyes" transform="translate(${num(moduleBox.x)} ${num(moduleBox.y)})"><use href="#${eyeFrameId}" fill="${eyeFramePaint.attr}" fill-rule="evenodd" /><use href="#${eyeBallId}" fill="${eyeBallPaint.attr}" /></g>`,
  )

  parts.push(renderLogo(design, logoMatrix, layout))

  if (layout.hasFrame && design.frame) {
    parts.push(renderFrame(design, layout))
  }

  parts.push("</svg>")

  const scanWarnings = buildScanWarnings(design, matrix, options.data)
  warnings.push(...scanWarnings)

  return {
    svg: parts.join(""),
    matrix,
    warnings,
    width: layout.totalWidth,
    height: layout.totalHeight,
  }
}