/**
 * Dependency-free path geometry for the QR renderer.
 *
 * Shapes are expressed as arrays of path commands in user units (modules), then
 * serialised either to SVG path data or (later) to other vector back ends. All
 * coordinates are floats; rounding only happens at serialisation time.
 */

export type PathCommand =
  | { type: "M"; x: number; y: number }
  | { type: "L"; x: number; y: number }
  | { type: "Q"; cx: number; cy: number; x: number; y: number }
  | { type: "C"; c1x: number; c1y: number; c2x: number; c2y: number; x: number; y: number }
  | { type: "Z" }

export type Path = PathCommand[]

/** Circle-to-bezier magic constant: 4 * (sqrt(2) - 1) / 3 */
export const KAPPA = 0.5522847498307936

const round = (value: number): string => {
  const rounded = Math.round(value * 10000) / 10000
  return Number.isFinite(rounded) ? String(rounded) : "0"
}

export function pathToSvg(path: Path): string {
  if (path.length === 0) return ""
  const parts: string[] = []
  for (const command of path) {
    switch (command.type) {
      case "M":
        parts.push(`M${round(command.x)} ${round(command.y)}`)
        break
      case "L":
        parts.push(`L${round(command.x)} ${round(command.y)}`)
        break
      case "Q":
        parts.push(
          `Q${round(command.cx)} ${round(command.cy)} ${round(command.x)} ${round(command.y)}`,
        )
        break
      case "C":
        parts.push(
          `C${round(command.c1x)} ${round(command.c1y)} ${round(command.c2x)} ${round(command.c2y)} ${round(command.x)} ${round(command.y)}`,
        )
        break
      case "Z":
        parts.push("Z")
        break
    }
  }
  return parts.join("")
}

export function translatePath(path: Path, dx: number, dy: number): Path {
  return path.map((command) => {
    switch (command.type) {
      case "M":
      case "L":
        return { ...command, x: command.x + dx, y: command.y + dy }
      case "Q":
        return {
          ...command,
          cx: command.cx + dx,
          cy: command.cy + dy,
          x: command.x + dx,
          y: command.y + dy,
        }
      case "C":
        return {
          ...command,
          c1x: command.c1x + dx,
          c1y: command.c1y + dy,
          c2x: command.c2x + dx,
          c2y: command.c2y + dy,
          x: command.x + dx,
          y: command.y + dy,
        }
      case "Z":
        return command
    }
  })
}

export function scalePath(path: Path, sx: number, sy: number = sx): Path {
  return path.map((command) => {
    switch (command.type) {
      case "M":
      case "L":
        return { ...command, x: command.x * sx, y: command.y * sy }
      case "Q":
        return {
          ...command,
          cx: command.cx * sx,
          cy: command.cy * sy,
          x: command.x * sx,
          y: command.y * sy,
        }
      case "C":
        return {
          ...command,
          c1x: command.c1x * sx,
          c1y: command.c1y * sy,
          c2x: command.c2x * sx,
          c2y: command.c2y * sy,
          x: command.x * sx,
          y: command.y * sy,
        }
      case "Z":
        return command
    }
  })
}

interface CornerRadii {
  tl: number
  tr: number
  br: number
  bl: number
}

function normalizeRadii(width: number, height: number, radii: number | CornerRadii): CornerRadii {
  if (typeof radii === "number") {
    return { tl: radii, tr: radii, br: radii, bl: radii }
  }
  return radii
}

/**
 * Rounded rectangle path. `k` controls the bezier bulge (0.5523 = true circular
 * arc, larger values read as a "squircle").
 */
export function roundedRectPath(
  x: number,
  y: number,
  width: number,
  height: number,
  radii: number | CornerRadii,
  k: number = KAPPA,
): Path {
  const normalized = normalizeRadii(width, height, radii)
  const max = Math.min(width, height) / 2
  const tl = clamp(normalized.tl, 0, max)
  const tr = clamp(normalized.tr, 0, max)
  const br = clamp(normalized.br, 0, max)
  const bl = clamp(normalized.bl, 0, max)

  const path: Path = []
  path.push({ type: "M", x: x + tl, y })
  path.push({ type: "L", x: x + width - tr, y })
  if (tr > 0) {
    path.push({ type: "C", c1x: x + width - tr + tr * k, c1y: y, c2x: x + width, c2y: y + tr - tr * k, x: x + width, y: y + tr })
  }
  path.push({ type: "L", x: x + width, y: y + height - br })
  if (br > 0) {
    path.push({ type: "C", c1x: x + width, c1y: y + height - br + br * k, c2x: x + width - br + br * k, c2y: y + height, x: x + width - br, y: y + height })
  }
  path.push({ type: "L", x: x + bl, y: y + height })
  if (bl > 0) {
    path.push({ type: "C", c1x: x + bl - bl * k, c1y: y + height, c2x: x, c2y: y + height - bl + bl * k, x, y: y + height - bl })
  }
  path.push({ type: "L", x, y: y + tl })
  if (tl > 0) {
    path.push({ type: "C", c1x: x, c1y: y + tl - tl * k, c2x: x + tl - tl * k, c2y: y, x: x + tl, y })
  }
  path.push({ type: "Z" })
  return path
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/** Circle approximated with four cubic segments. */
export function circlePath(centerX: number, centerY: number, radius: number): Path {
  const k = radius * KAPPA
  return [
    { type: "M", x: centerX, y: centerY - radius },
    {
      type: "C",
      c1x: centerX + k,
      c1y: centerY - radius,
      c2x: centerX + radius,
      c2y: centerY - k,
      x: centerX + radius,
      y: centerY,
    },
    {
      type: "C",
      c1x: centerX + radius,
      c1y: centerY + k,
      c2x: centerX + k,
      c2y: centerY + radius,
      x: centerX,
      y: centerY + radius,
    },
    {
      type: "C",
      c1x: centerX - k,
      c1y: centerY + radius,
      c2x: centerX - radius,
      c2y: centerY + k,
      x: centerX - radius,
      y: centerY,
    },
    {
      type: "C",
      c1x: centerX - radius,
      c1y: centerY - k,
      c2x: centerX - k,
      c2y: centerY - radius,
      x: centerX,
      y: centerY - radius,
    },
    { type: "Z" },
  ]
}

export function polygonPath(points: Array<[number, number]>): Path {
  if (points.length === 0) return []
  const path: Path = []
  points.forEach(([x, y], index) => {
    path.push(index === 0 ? { type: "M", x, y } : { type: "L", x, y })
  })
  path.push({ type: "Z" })
  return path
}

/** Diamond inscribed in the given box, optionally inset by `inset` on each side. */
export function diamondPath(x: number, y: number, width: number, height: number, inset = 0): Path {
  const cx = x + width / 2
  const cy = y + height / 2
  return polygonPath([
    [cx, y + inset],
    [x + width - inset, cy],
    [cx, y + height - inset],
    [x + inset, cy],
  ])
}

/**
 * Diamond with bowed-out edges ("rounded diamond"). Used for the diamond dot
 * style and diamond eye ball so the shape keeps enough dark coverage to scan.
 */
export function bulgedDiamondPath(
  x: number,
  y: number,
  width: number,
  height: number,
  expansion: number,
  bulge: number,
): Path {
  const w = width * (1 + expansion * 2)
  const h = height * (1 + expansion * 2)
  const ox = x - width * expansion
  const oy = y - height * expansion
  const cx = ox + w / 2
  const cy = oy + h / 2
  const top: [number, number] = [cx, oy]
  const right: [number, number] = [ox + w, cy]
  const bottom: [number, number] = [cx, oy + h]
  const left: [number, number] = [ox, cy]
  const bx = w * bulge
  const by = h * bulge
  return [
    { type: "M", x: top[0], y: top[1] },
    { type: "Q", cx: right[0] - bx, cy: right[1] - by, x: right[0], y: right[1] },
    { type: "Q", cx: bottom[0] + bx, cy: bottom[1] - by, x: bottom[0], y: bottom[1] },
    { type: "Q", cx: left[0] + bx, cy: left[1] + by, x: left[0], y: left[1] },
    { type: "Q", cx: top[0] - bx, cy: top[1] + by, x: top[0], y: top[1] },
    { type: "Z" },
  ]
}

/** Regular hexagon (pointy left/right) inscribed in the box. */
export function hexagonPath(x: number, y: number, width: number, height: number): Path {
  // Slightly expanded so the dark coverage stays scanner-friendly.
  const expansion = 1.05
  const w = width * expansion
  const h = height * expansion
  x -= (w - width) / 2
  y -= (h - height) / 2
  const cx = x + w / 2
  const cy = y + h / 2
  const rx = w / 2
  return polygonPath([
    [cx - rx * 0.5, y],
    [cx + rx * 0.5, y],
    [x + w, cy],
    [cx + rx * 0.5, y + h],
    [cx - rx * 0.5, y + h],
    [x, cy],
  ])
}

/** Eight-pointed sparkle/star inscribed in the box. */
export function starPath(x: number, y: number, width: number, height: number): Path {
  // 8-point sparkle. The points extend slightly past the cell and the inner
  // ratio is high enough to keep dark coverage above ~0.78 of the cell area.
  const expansion = 1.16
  const w = width * expansion
  const h = height * expansion
  x -= (w - width) / 2
  y -= (h - height) / 2
  const cx = x + w / 2
  const cy = y + h / 2
  const outerX = w / 2
  const outerY = h / 2
  const inner = 0.68
  return polygonPath([
    [cx, y],
    [cx + outerX * inner, cy - outerY * inner],
    [x + w, cy],
    [cx + outerX * inner, cy + outerY * inner],
    [cx, y + h],
    [cx - outerX * inner, cy + outerY * inner],
    [x, cy],
    [cx - outerX * inner, cy - outerY * inner],
  ])
}

/** Plus/cross shape inscribed in the box. */
export function crossPath(x: number, y: number, width: number, height: number): Path {
  // Arms are intentionally thick (~0.55 of the cell) so the shape keeps enough
  // dark coverage for small-print scanning.
  const armW = width * 0.62
  const armH = height * 0.62
  const cx = x + width / 2
  const cy = y + height / 2
  return polygonPath([
    [cx - armW / 2, y + height],
    [cx + armW / 2, y + height],
    [cx + armW / 2, cy + armH / 2],
    [x + width, cy + armH / 2],
    [x + width, cy - armH / 2],
    [cx + armW / 2, cy - armH / 2],
    [cx + armW / 2, y],
    [cx - armW / 2, y],
    [cx - armW / 2, cy - armH / 2],
    [x, cy - armH / 2],
    [x, cy + armH / 2],
    [cx - armW / 2, cy + armH / 2],
  ])
}

/** Square with the top-right corner chamfered off. */
export function classyPath(x: number, y: number, width: number, height: number): Path {
  const cut = Math.min(width, height) * 0.45
  return polygonPath([
    [x, y],
    [x + width - cut, y],
    [x + width, y + cut],
    [x + width, y + height],
    [x, y + height],
  ])
}

/** Leaf shape: two opposite corners rounded to 50%. */
export function leafPath(x: number, y: number, width: number, height: number): Path {
  const radius = Math.min(width, height) / 2
  return roundedRectPath(x, y, width, height, { tl: radius, tr: 0, br: radius, bl: 0 })
}

/** Superellipse-ish squircle. */
export function squirclePath(x: number, y: number, width: number, height: number): Path {
  const radius = Math.min(width, height) * 0.45
  return roundedRectPath(x, y, width, height, radius, 0.82)
}

export interface ShapeOptions {
  x: number
  y: number
  width: number
  height: number
}

/** Path for one dark module of the given dot style, within its 1x1 cell. */
export function dotPath(
  style:
    | "square"
    | "rounded"
    | "dots"
    | "diamond"
    | "star"
    | "cross"
    | "leaf"
    | "classy"
    | "hexagon"
    | "squircle",
  options: ShapeOptions,
): Path {
  const { x, y, width, height } = options
  switch (style) {
    case "square":
      return polygonPath([
        [x, y],
        [x + width, y],
        [x + width, y + height],
        [x, y + height],
      ])
    case "rounded":
      return roundedRectPath(x, y, width, height, Math.min(width, height) * 0.28)
    case "dots":
      return circlePath(x + width / 2, y + height / 2, Math.min(width, height) / 2)
    case "diamond":
      return diamondPath(x, y, width, height, -Math.min(width, height) * 0.24)
    case "star":
      return starPath(x, y, width, height)
    case "cross":
      return crossPath(x, y, width, height)
    case "leaf":
      return leafPath(x, y, width, height)
    case "classy":
      return classyPath(x, y, width, height)
    case "hexagon":
      return hexagonPath(x, y, width, height)
    case "squircle":
      return squirclePath(x, y, width, height)
  }
}

export interface EyeOptions {
  x: number
  y: number
  /** Full finder pattern size (7 modules by default). */
  size: number
}

/** Finder-pattern frame (ring with a hole) for the given eye style. */
export function eyeFramePath(
  style: "square" | "rounded" | "circle" | "leaf" | "octagon" | "squircle",
  { x, y, size }: EyeOptions,
): Path {
  const innerInset = size * (1 / 7)
  const ix = x + innerInset
  const iy = y + innerInset
  const iw = size - innerInset * 2
  const ih = size - innerInset * 2
  const outerRadius = size * 0.3
  const innerRadius = outerRadius - innerInset * 0.4

  const ring = (outer: Path, inner: Path): Path => [...outer, ...inner]

  switch (style) {
    case "square":
      return ring(
        roundedRectPath(x, y, size, size, 0),
        roundedRectPath(ix, iy, iw, ih, 0),
      )
    case "rounded":
      return ring(
        roundedRectPath(x, y, size, size, outerRadius),
        roundedRectPath(ix, iy, iw, ih, Math.max(0, innerRadius)),
      )
    case "circle":
      return ring(
        circlePath(x + size / 2, y + size / 2, size / 2),
        circlePath(x + size / 2, y + size / 2, size / 2 - innerInset),
      )
    case "leaf":
      return ring(
        roundedRectPath(x, y, size, size, {
          tl: size / 2,
          tr: size * 0.12,
          br: size / 2,
          bl: size * 0.12,
        }),
        roundedRectPath(ix, iy, iw, ih, {
          tl: iw / 2,
          tr: iw * 0.12,
          br: iw / 2,
          bl: iw * 0.12,
        }),
      )
    case "octagon": {
      const cut = size * 0.28
      const innerCut = cut - innerInset * 0.3
      const outer = polygonPath([
        [x + cut, y],
        [x + size - cut, y],
        [x + size, y + cut],
        [x + size, y + size - cut],
        [x + size - cut, y + size],
        [x + cut, y + size],
        [x, y + size - cut],
        [x, y + cut],
      ])
      const inner = polygonPath([
        [ix + innerCut, iy],
        [ix + iw - innerCut, iy],
        [ix + iw, iy + innerCut],
        [ix + iw, iy + ih - innerCut],
        [ix + iw - innerCut, iy + ih],
        [ix + innerCut, iy + ih],
        [ix, iy + ih - innerCut],
        [ix, iy + innerCut],
      ])
      return ring(outer, inner)
    }
    case "squircle":
      return ring(
        roundedRectPath(x, y, size, size, size * 0.34, 0.8),
        roundedRectPath(ix, iy, iw, ih, iw * 0.34, 0.8),
      )
  }
}

/** Finder-pattern inner ball for the given style (3x3 modules by default). */
export function eyeBallPath(
  style: "square" | "rounded" | "dots" | "leaf" | "squircle",
  { x, y, size }: EyeOptions,
): Path {
  switch (style) {
    case "square":
      return roundedRectPath(x, y, size, size, 0)
    case "rounded":
      return roundedRectPath(x, y, size, size, size * 0.3)
    case "dots":
      return circlePath(x + size / 2, y + size / 2, size / 2)
    case "squircle":
      return roundedRectPath(x, y, size, size, size * 0.4, 0.85)
    case "leaf":
      return roundedRectPath(x, y, size, size, {
        tl: size / 2,
        tr: 0,
        br: size / 2,
        bl: 0,
      })
  }
}