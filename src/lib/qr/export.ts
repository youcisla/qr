/**
 * Browser-side export pipeline.
 *
 * SVG is the canonical output of the engine. PNG / JPEG are produced by handing
 * that SVG to the browser's own renderer through a canvas; PDF wraps the raster
 * in a single-page document with a tiny, dependency-free PDF writer.
 */

export interface RasterOptions {
  width: number
  height: number
  /** Extra pixel scale relative to the design size (1 = width x height px). */
  scale?: number
  /** Fill behind the QR (needed for JPEG). null/undefined keeps transparency. */
  background?: string | null
  /** JPEG quality 0..1. */
  quality?: number
}

export interface PdfOptions extends RasterOptions {
  title?: string
  /** Page margin in points. */
  margin?: number
}

function loadSvgImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const image = new Image()
    image.decoding = "sync"
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Could not rasterise the QR SVG"))
    }
    image.src = url
  })
}

function drawToCanvas(
  image: HTMLImageElement,
  options: RasterOptions,
): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D; width: number; height: number } {
  const scale = options.scale ?? 1
  const width = Math.max(16, Math.round(options.width * scale))
  const height = Math.max(16, Math.round(options.height * scale))
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d")
  if (!context) throw new Error("Canvas is not available in this browser")
  if (options.background) {
    context.fillStyle = options.background
    context.fillRect(0, 0, width, height)
  }
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = "high"
  context.drawImage(image, 0, 0, width, height)
  return { canvas, context, width, height }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error("Could not create image blob"))
      },
      type,
      quality,
    )
  })
}

export async function svgToPngBlob(svg: string, options: RasterOptions): Promise<Blob> {
  const image = await loadSvgImage(svg)
  const { canvas } = drawToCanvas(image, options)
  return canvasToBlob(canvas, "image/png")
}

export async function svgToJpegBlob(svg: string, options: RasterOptions): Promise<Blob> {
  const image = await loadSvgImage(svg)
  const { canvas } = drawToCanvas(image, { ...options, background: options.background ?? "#ffffff" })
  return canvasToBlob(canvas, "image/jpeg", options.quality ?? 0.95)
}

export async function svgToWebpBlob(svg: string, options: RasterOptions): Promise<Blob> {
  const image = await loadSvgImage(svg)
  const { canvas } = drawToCanvas(image, options)
  return canvasToBlob(canvas, "image/webp", options.quality ?? 0.95)
}

/** Minimal single-page PDF with an embedded JPEG. Works in every modern browser. */
export async function svgToPdfBlob(svg: string, options: PdfOptions): Promise<Blob> {
  const image = await loadSvgImage(svg)
  const raster = drawToCanvas(image, { ...options, background: options.background ?? "#ffffff" })
  const jpegBlob = await canvasToBlob(raster.canvas, "image/jpeg", options.quality ?? 0.95)
  const jpeg = new Uint8Array(await jpegBlob.arrayBuffer())
  return buildPdfFromJpeg(jpeg, raster.width, raster.height, options)
}

function buildPdfFromJpeg(
  jpeg: Uint8Array,
  imageWidth: number,
  imageHeight: number,
  options: PdfOptions,
): Blob {
  const margin = options.margin ?? 0
  const pageWidth = imageWidth + margin * 2
  const pageHeight = imageHeight + margin * 2
  const encoder = new TextEncoder()
  const chunks: Uint8Array[] = []
  const offsets: number[] = []
  let length = 0

  const push = (data: string | Uint8Array) => {
    const bytes = typeof data === "string" ? encoder.encode(data) : data
    chunks.push(bytes)
    length += bytes.length
  }
  const addObject = (body: string) => {
    offsets.push(length)
    push(body)
  }

  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n")

  const title = (options.title ?? "QR Code").replace(/[()\\]/g, " ").slice(0, 120)
  const infoObjectNumber = 6
  addObject(`1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n`)
  addObject(`2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n`)
  addObject(
    `3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >> endobj\n`,
  )
  const imageHeader =
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`
  const imageFooter = `\nendstream\nendobj\n`
  addObject(imageHeader)
  push(jpeg)
  push(imageFooter)

  const content = `q\n${imageWidth} 0 0 ${imageHeight} ${margin} ${margin} cm\n/Im0 Do\nQ\n`
  const contentBytes = encoder.encode(content)
  addObject(`5 0 obj << /Length ${contentBytes.length} >>\nstream\n`)
  push(contentBytes)
  push(`endstream\nendobj\n`)

  addObject(
    `${infoObjectNumber} 0 obj << /Title (${title}) /Producer (Yopem QR Studio) >> endobj\n`,
  )

  const xrefStart = length
  const pad = (value: number) => value.toString().padStart(10, "0")
  let xref = `xref\n0 ${infoObjectNumber + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) xref += `${pad(offset)} 00000 n \n`
  push(xref)
  push(
    `trailer\n<< /Size ${infoObjectNumber + 1} /Root 1 0 R /Info ${infoObjectNumber} 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`,
  )

  const output = new Uint8Array(length)
  let position = 0
  for (const chunk of chunks) {
    output.set(chunk, position)
    position += chunk.length
  }
  return new Blob([output], { type: "application/pdf" })
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export async function copySvgToClipboard(svg: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(svg)
    return true
  } catch {
    return false
  }
}
