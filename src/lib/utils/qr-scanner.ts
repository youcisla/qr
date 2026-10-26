/**
 * QR scanner utilities.
 *
 * Three layers live here:
 * 1. File / image decoding (jsQR with a native BarcodeDetector fast path).
 * 2. A live camera scanner (getUserMedia + requestAnimationFrame loop, camera
 *    switching and torch control when the platform supports it).
 * 3. A small localStorage-backed scan history.
 *
 * Everything is browser-only and lazily guarded so importing this module during
 * SSR is safe.
 */

import jsQR from "jsqr"

export interface ScanResult {
  success: boolean
  data?: string
  error?: string
}

export type ScanSource = "camera" | "upload" | "drop" | "paste" | "history"

/* -------------------------------------------------------------------------- */
/*                             Browser capabilities                           */
/* -------------------------------------------------------------------------- */

interface BarcodeDetectorResultLike {
  rawValue?: string
}

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<BarcodeDetectorResultLike[]>
}

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorLike

function getBarcodeDetectorConstructor(): BarcodeDetectorConstructor | null {
  const scope = globalThis as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }
  return scope.BarcodeDetector ?? null
}

/** True when the native BarcodeDetector API is available. */
export function isBarcodeDetectorSupported(): boolean {
  return getBarcodeDetectorConstructor() !== null
}

function createBarcodeDetector(): BarcodeDetectorLike | null {
  const Detector = getBarcodeDetectorConstructor()
  if (!Detector) return null
  try {
    return new Detector({ formats: ["qr_code"] })
  } catch {
    return null
  }
}

async function detectWithBarcodeDetector(source: CanvasImageSource): Promise<string | null> {
  const detector = createBarcodeDetector()
  if (!detector) return null
  try {
    const results = await detector.detect(source)
    const first = results.find(
      (result) => typeof result.rawValue === "string" && result.rawValue.length > 0,
    )
    return first?.rawValue ?? null
  } catch {
    return null
  }
}

/** True when getUserMedia can be used (secure context + API present). */
export function isCameraSupported(): boolean {
  if (typeof navigator === "undefined" || typeof window === "undefined") return false
  const mediaDevices = (navigator as Navigator & { mediaDevices?: MediaDevices }).mediaDevices
  if (!mediaDevices || typeof mediaDevices.getUserMedia !== "function") return false
  return window.isSecureContext === true || window.location.hostname === "localhost"
}

/* -------------------------------------------------------------------------- */
/*                             Image scanning                                 */
/* -------------------------------------------------------------------------- */

/** Decode a prepared ImageData buffer with jsQR. */
export function decodeImageData(imageData: ImageData): string | null {
  const code = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: "attemptBoth",
  })
  return code?.data ?? null
}

interface ImageSource {
  element: CanvasImageSource
  width: number
  height: number
  cleanup: () => void
}

async function loadImageSource(blob: Blob): Promise<ImageSource | null> {
  if (typeof document === "undefined") return null

  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob)
      return {
        element: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close(),
      }
    } catch {
      // Fall back to an <img> element below.
    }
  }

  const objectUrl = URL.createObjectURL(blob)
  const image = new Image()
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error("Failed to load image"))
      image.src = objectUrl
    })
  } catch (error) {
    URL.revokeObjectURL(objectUrl)
    throw error
  }

  const width = image.naturalWidth || image.width
  const height = image.naturalHeight || image.height
  if (!width || !height) {
    URL.revokeObjectURL(objectUrl)
    return null
  }

  return {
    element: image,
    width,
    height,
    cleanup: () => URL.revokeObjectURL(objectUrl),
  }
}

/** Draw an image source to a canvas, capped at maxDimension on the long edge. */
function drawToImageData(source: ImageSource, maxDimension: number): ImageData | null {
  if (typeof document === "undefined") return null
  const scale = Math.min(1, maxDimension / Math.max(source.width, source.height))
  const width = Math.max(1, Math.round(source.width * scale))
  const height = Math.max(1, Math.round(source.height * scale))

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d", { willReadFrequently: true })
  if (!context) return null
  context.drawImage(source.element, 0, 0, width, height)
  try {
    return context.getImageData(0, 0, width, height)
  } catch {
    return null
  }
}

/**
 * Decode a QR code from any image blob. Tries the native BarcodeDetector first
 * (fast and handles perspective well) and falls back to jsQR at two scales.
 */
export async function scanImageBlob(blob: Blob): Promise<ScanResult> {
  try {
    const source = await loadImageSource(blob)
    if (!source) return { success: false, error: "Could not read the image file" }

    try {
      const nativeResult = await detectWithBarcodeDetector(source.element)
      if (nativeResult) return { success: true, data: nativeResult }

      for (const maxDimension of [1600, 800]) {
        const imageData = drawToImageData(source, maxDimension)
        if (!imageData) continue
        const data = decodeImageData(imageData)
        if (data) return { success: true, data }
      }

      return {
        success: false,
        error: "No QR code detected in image. Try a clearer image or a different angle.",
      }
    } finally {
      source.cleanup()
    }
  } catch (error) {
    return {
      success: false,
      error: "Failed to scan image: " + (error instanceof Error ? error.message : "Unknown error"),
    }
  }
}

/** Decode a QR code from an uploaded image file. */
export async function scanQrCode(file: File): Promise<ScanResult> {
  if (!file.type.startsWith("image/")) {
    return { success: false, error: "Please upload an image file (PNG, JPEG, WebP)" }
  }
  const maxSize = 10 * 1024 * 1024
  if (file.size > maxSize) {
    return { success: false, error: "Image too large. Maximum size: 10MB" }
  }
  return scanImageBlob(file)
}

/* -------------------------------------------------------------------------- */
/*                               Camera scanner                               */
/* -------------------------------------------------------------------------- */

export type CameraErrorCode =
  | "unsupported"
  | "permission-denied"
  | "not-found"
  | "in-use"
  | "unknown"

export class CameraScannerError extends Error {
  readonly code: CameraErrorCode

  constructor(message: string, code: CameraErrorCode = "unknown") {
    super(message)
    this.name = "CameraScannerError"
    this.code = code
  }
}

export interface CameraDeviceInfo {
  deviceId: string
  label: string
}

export interface CameraScannerOptions {
  video: HTMLVideoElement
  onDetect: (data: string) => void
  onError?: (error: CameraScannerError) => void
  /** Throttle between scan attempts. Defaults to 110ms. */
  scanIntervalMs?: number
  /** Frames are downscaled to this width before jsQR. Defaults to 720. */
  maxScanWidth?: number
  /** Optional canvas to reuse for frame grabbing. */
  canvas?: HTMLCanvasElement
}

function isDomException(error: unknown): error is DOMException {
  return typeof DOMException !== "undefined" && error instanceof DOMException
}

/**
 * Live camera QR scanner. Owns the MediaStream and the requestAnimationFrame
 * loop; the Svelte component only forwards detection or error events.
 */
export class CameraQrScanner {
  private readonly video: HTMLVideoElement
  private readonly canvas: HTMLCanvasElement
  private readonly context: CanvasRenderingContext2D | null
  private readonly onDetect: (data: string) => void
  private readonly onError: (error: CameraScannerError) => void
  private readonly scanIntervalMs: number
  private readonly maxScanWidth: number

  private stream: MediaStream | null = null
  private frameHandle: number | null = null
  private detector: BarcodeDetectorLike | null = null
  private detectorUnavailable = false
  private lastScanAt = 0
  private scanInFlight = false
  private running = false
  private detected = false
  private devices: CameraDeviceInfo[] = []
  private activeDeviceId: string | null = null
  private torchAvailable = false
  private torchEnabled = false

  constructor(options: CameraScannerOptions) {
    this.video = options.video
    this.canvas = options.canvas ?? document.createElement("canvas")
    this.context = this.canvas.getContext("2d", { willReadFrequently: true })
    this.onDetect = options.onDetect
    this.onError = options.onError ?? (() => {})
    this.scanIntervalMs = options.scanIntervalMs ?? 110
    this.maxScanWidth = options.maxScanWidth ?? 720
  }

  get isRunning(): boolean {
    return this.running
  }

  get isTorchAvailable(): boolean {
    return this.torchAvailable
  }

  get isTorchEnabled(): boolean {
    return this.torchEnabled
  }

  get currentDeviceId(): string | null {
    return this.activeDeviceId
  }

  get hasMultipleCameras(): boolean {
    return this.devices.filter((device) => device.deviceId.length > 0).length > 1
  }

  get videoDevices(): CameraDeviceInfo[] {
    return this.devices
  }

  /** Request the camera, attach it to the video element and start scanning. */
  async start(): Promise<void> {
    if (!isCameraSupported()) {
      const error = new CameraScannerError(
        "Camera access is not available here. Upload a QR image instead.",
        "unsupported",
      )
      this.onError(error)
      throw error
    }

    this.stop()
    this.detected = false
    this.detectorUnavailable = false

    const mediaDevices = navigator.mediaDevices
    const constraints: MediaStreamConstraints = {
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
        deviceId: this.activeDeviceId ? { ideal: this.activeDeviceId } : undefined,
      },
    }

    let stream: MediaStream
    try {
      stream = await mediaDevices.getUserMedia(constraints)
    } catch (error) {
      const name = isDomException(error) ? error.name : error instanceof Error ? error.name : ""
      if (name === "OverconstrainedError" || name === "NotFoundError") {
        try {
          stream = await mediaDevices.getUserMedia({ audio: false, video: true })
        } catch (retryError) {
          const failure = this.translateError(retryError)
          this.onError(failure)
          throw failure
        }
      } else {
        const failure = this.translateError(error)
        this.onError(failure)
        throw failure
      }
    }

    this.stream = stream
    this.video.srcObject = stream
    this.video.muted = true
    this.video.setAttribute("playsinline", "true")
    try {
      await this.video.play()
    } catch {
      // Autoplay can reject until metadata is ready; the frame loop retries.
    }

    const track = stream.getVideoTracks()[0]
    if (track) {
      const settings = track.getSettings()
      this.activeDeviceId = settings.deviceId ?? this.activeDeviceId
      this.torchAvailable = this.readTorchCapability(track)
      this.torchEnabled = false
    }

    await this.refreshDevices()
    this.running = true
    this.lastScanAt = 0
    this.loop()
  }

  /** Stop the stream and cancel the scan loop. */
  stop(): void {
    this.running = false
    if (this.frameHandle !== null) {
      cancelAnimationFrame(this.frameHandle)
      this.frameHandle = null
    }
    if (this.stream) {
      for (const track of this.stream.getTracks()) track.stop()
      this.stream = null
    }
    if (this.video) {
      try {
        this.video.pause()
      } catch {
        // Some browsers throw when pausing a detached video.
      }
      this.video.srcObject = null
    }
    this.scanInFlight = false
    this.torchAvailable = false
    this.torchEnabled = false
  }

  /** Cycle to the next video input and restart the stream. */
  async switchCamera(): Promise<CameraDeviceInfo | null> {
    await this.refreshDevices()
    const available = this.devices.filter((device) => device.deviceId.length > 0)
    if (available.length < 2) return null
    const currentIndex = available.findIndex((device) => device.deviceId === this.activeDeviceId)
    const next = available[(currentIndex + 1) % available.length]
    if (!next) return null
    this.activeDeviceId = next.deviceId
    await this.start()
    return next
  }

  /** Turn the torch / flashlight on or off when the track supports it. */
  async setTorch(enabled: boolean): Promise<boolean> {
    const track = this.stream?.getVideoTracks()[0]
    if (!track || !this.torchAvailable) return false
    try {
      const advanced = [{ torch: enabled }] as unknown as MediaTrackConstraintSet[]
      await track.applyConstraints({ advanced })
      this.torchEnabled = enabled
      return true
    } catch {
      return false
    }
  }

  private readTorchCapability(track: MediaStreamTrack): boolean {
    try {
      const capabilities = track.getCapabilities?.() as
        | (MediaTrackCapabilities & { torch?: boolean })
        | undefined
      return capabilities?.torch === true
    } catch {
      return false
    }
  }

  private translateError(error: unknown): CameraScannerError {
    if (error instanceof CameraScannerError) return error
    const name = isDomException(error) ? error.name : error instanceof Error ? error.name : ""
    if (name === "NotAllowedError" || name === "SecurityError") {
      return new CameraScannerError(
        "Camera permission was denied. Allow camera access in your browser settings, or upload an image instead.",
        "permission-denied",
      )
    }
    if (name === "NotFoundError") {
      return new CameraScannerError(
        "No usable camera was found on this device. Upload a QR image instead.",
        "not-found",
      )
    }
    if (name === "NotReadableError" || name === "AbortError") {
      return new CameraScannerError(
        "The camera is busy in another app. Close it and try again, or upload an image.",
        "in-use",
      )
    }
    return new CameraScannerError(
      "Could not start the camera. Upload a QR image instead.",
      "unknown",
    )
  }

  private async refreshDevices(): Promise<CameraDeviceInfo[]> {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
      return this.devices
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      this.devices = devices
        .filter((device) => device.kind === "videoinput")
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || "Camera " + (index + 1),
        }))
    } catch {
      // Keep the previous device list.
    }
    return this.devices
  }

  private loop = (): void => {
    if (!this.running) return
    this.frameHandle = requestAnimationFrame(this.loop)
    if (this.detected) return

    const now = typeof performance !== "undefined" ? performance.now() : Date.now()
    if (now - this.lastScanAt < this.scanIntervalMs) return
    if (this.scanInFlight) return
    this.lastScanAt = now
    void this.scanFrame()
  }

  private async scanFrame(): Promise<void> {
    if (!this.running || this.detected) return
    if (this.video.readyState < 2 || !this.video.videoWidth) return

    this.scanInFlight = true
    try {
      const nativeResult = await this.detectWithNativeApi()
      if (nativeResult) {
        this.finish(nativeResult)
        return
      }
      const imageData = this.grabFrame()
      if (!imageData) return
      const data = decodeImageData(imageData)
      if (data) this.finish(data)
    } finally {
      this.scanInFlight = false
    }
  }

  private async detectWithNativeApi(): Promise<string | null> {
    if (this.detectorUnavailable) return null
    if (!this.detector) {
      const Detector = getBarcodeDetectorConstructor()
      if (!Detector) {
        this.detectorUnavailable = true
        return null
      }
      try {
        this.detector = new Detector({ formats: ["qr_code"] })
      } catch {
        this.detectorUnavailable = true
        return null
      }
    }
    try {
      const results = await this.detector.detect(this.video)
      const first = results.find(
        (result) => typeof result.rawValue === "string" && result.rawValue.length > 0,
      )
      return first?.rawValue ?? null
    } catch {
      this.detectorUnavailable = true
      this.detector = null
      return null
    }
  }

  private grabFrame(): ImageData | null {
    if (!this.context) return null
    const videoWidth = this.video.videoWidth
    const videoHeight = this.video.videoHeight
    if (!videoWidth || !videoHeight) return null

    const scale = Math.min(1, this.maxScanWidth / Math.max(videoWidth, videoHeight))
    const width = Math.max(1, Math.round(videoWidth * scale))
    const height = Math.max(1, Math.round(videoHeight * scale))
    if (this.canvas.width !== width) this.canvas.width = width
    if (this.canvas.height !== height) this.canvas.height = height

    this.context.drawImage(this.video, 0, 0, width, height)
    try {
      return this.context.getImageData(0, 0, width, height)
    } catch {
      return null
    }
  }

  private finish(data: string): void {
    if (this.detected) return
    this.detected = true
    this.stop()
    this.onDetect(data)
  }
}

/* -------------------------------------------------------------------------- */
/*                               Legacy helpers                               */
/* -------------------------------------------------------------------------- */

/** True when the value parses as an absolute URL. */
export function isValidUrl(data: string): boolean {
  try {
    new URL(data)
    return true
  } catch {
    return false
  }
}

/** Return the value as a URL, extracting the first http(s) match when needed. */
export function extractUrl(data: string): string {
  if (isValidUrl(data)) return data
  const urlMatch = data.match(/(https?:\/\/[^\s]+)/)
  if (urlMatch) return urlMatch[1]
  return data
}

/* -------------------------------------------------------------------------- */
/*                                 Scan history                               */
/* -------------------------------------------------------------------------- */

export interface ScanHistoryEntry {
  id: string
  /** Raw QR payload, kept so history entries can be re-parsed. */
  data: string
  /** Parsed content kind (url, wifi, vcard, ...). */
  kind: string
  title: string
  source: ScanSource
  scannedAt: number
}

export const SCAN_HISTORY_KEY = "yopem-qr:scan-history:v1"
export const SCAN_HISTORY_LIMIT = 25

function createHistoryId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return "scan-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10)
}

function isHistoryEntry(value: unknown): value is ScanHistoryEntry {
  if (!value || typeof value !== "object") return false
  const entry = value as Partial<ScanHistoryEntry>
  return (
    typeof entry.id === "string" &&
    typeof entry.data === "string" &&
    typeof entry.title === "string" &&
    typeof entry.scannedAt === "number"
  )
}

function readHistoryStorage(): Storage | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** Read the scan history, newest first. Never throws. */
export function loadScanHistory(): ScanHistoryEntry[] {
  const storage = readHistoryStorage()
  if (!storage) return []
  try {
    const raw = storage.getItem(SCAN_HISTORY_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isHistoryEntry).slice(0, SCAN_HISTORY_LIMIT)
  } catch {
    return []
  }
}

function persistScanHistory(entries: ScanHistoryEntry[]): void {
  const storage = readHistoryStorage()
  if (!storage) return
  try {
    storage.setItem(SCAN_HISTORY_KEY, JSON.stringify(entries))
  } catch {
    // Storage can be full or blocked (private mode); history is best effort.
  }
}

/**
 * Add a scan to the history. Duplicate payloads are moved to the top instead of
 * being stored twice.
 */
export function addScanHistoryEntry(entry: {
  data: string
  kind: string
  title: string
  source: ScanSource
}): ScanHistoryEntry[] {
  const newEntry: ScanHistoryEntry = {
    id: createHistoryId(),
    data: entry.data,
    kind: entry.kind,
    title: entry.title,
    source: entry.source,
    scannedAt: Date.now(),
  }
  const entries = [
    newEntry,
    ...loadScanHistory().filter((existing) => existing.data !== entry.data),
  ].slice(0, SCAN_HISTORY_LIMIT)
  persistScanHistory(entries)
  return entries
}

/** Remove a single history entry by id. */
export function removeScanHistoryEntry(id: string): ScanHistoryEntry[] {
  const entries = loadScanHistory().filter((entry) => entry.id !== id)
  persistScanHistory(entries)
  return entries
}

/** Clear the whole scan history. */
export function clearScanHistory(): void {
  const storage = readHistoryStorage()
  if (!storage) return
  try {
    storage.removeItem(SCAN_HISTORY_KEY)
  } catch {
    // Ignore blocked storage.
  }
}
