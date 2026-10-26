import QRCode from "qrcode"

import type { ErrorCorrectionLevel, QrMatrix } from "./types"

export interface BuildMatrixOptions {
  errorCorrectionLevel?: ErrorCorrectionLevel
  /** Force a QR version (module count = 17 + 4 * version). Mostly used in tests. */
  version?: number
}

/**
 * Encode `data` into a QR module matrix.
 *
 * Uses the battle-tested `qrcode` encoder (Reed-Solomon + mask selection) and
 * normalises its output into the engine's row-major `QrMatrix` shape. This
 * module is isomorphic: it is safe to import from the browser bundle.
 */
export function buildQrMatrix(data: string, options: BuildMatrixOptions = {}): QrMatrix {
  const payload = typeof data === "string" && data.length > 0 ? data : " "
  const errorCorrectionLevel = options.errorCorrectionLevel ?? "M"

  const created = QRCode.create(payload, {
    errorCorrectionLevel,
    ...(options.version ? { version: options.version } : {}),
  })

  const size = created.modules.size
  const modules = new Uint8Array(size * size)
  const source = created.modules.data as Uint8Array

  for (let i = 0; i < modules.length; i++) {
    modules[i] = source[i] ? 1 : 0
  }

  return {
    size,
    modules,
    version: created.version,
    errorCorrectionLevel,
  }
}

export function isDark(matrix: QrMatrix, row: number, col: number): boolean {
  if (row < 0 || col < 0 || row >= matrix.size || col >= matrix.size) return false
  return matrix.modules[row * matrix.size + col] === 1
}

export function cloneMatrix(matrix: QrMatrix): QrMatrix {
  return { ...matrix, modules: new Uint8Array(matrix.modules) }
}

/** Bit mask of the three 7x7 finder patterns (plus their 1-module separators). */
export function isEyeModule(row: number, col: number, size: number): boolean {
  const inTopLeft = row < 7 && col < 7
  const inTopRight = row < 7 && col >= size - 7
  const inBottomLeft = row >= size - 7 && col < 7
  return inTopLeft || inTopRight || inBottomLeft
}
