import type { Bounds, Point, Region } from '#/editor/types'

/**
 * Where a committed region can be taken hold of. Pointer-level geometry: the
 * editor core is told *what* the new bounds are, never which edge was pulled.
 */
export const RESIZE_HANDLES = [
  'nw',
  'n',
  'ne',
  'e',
  'se',
  's',
  'sw',
  'w',
] as const

export type ResizeHandle = (typeof RESIZE_HANDLES)[number]

/**
 * How big a handle is drawn, and how wide a target it is to grab — in screen
 * pixels, because it is the pointer that has to hit it. A capture shrunk to
 * fit the stage is grabbed by the same targets it would be at full size.
 */
export const HANDLE_SIZE = 10

/**
 * How far either side of a region's outline still counts as grabbing it, again
 * in screen pixels. The drawn stroke alone is too thin to aim at.
 */
export const EDGE_GRAB = 10

/** The cursor that says which way a handle pulls. */
export const HANDLE_CURSOR: Record<ResizeHandle, string> = {
  nw: 'nwse-resize',
  se: 'nwse-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
}

/** A handle sits on the corner or the edge midpoint it is named after. */
export function handleCenter(bounds: Bounds, handle: ResizeHandle): Point {
  return {
    x: handle.includes('w')
      ? bounds.x
      : handle.includes('e')
        ? bounds.x + bounds.width
        : bounds.x + bounds.width / 2,
    y: handle.includes('n')
      ? bounds.y
      : handle.includes('s')
        ? bounds.y + bounds.height
        : bounds.y + bounds.height / 2,
  }
}

/**
 * The rectangle a region becomes when one of its handles is dragged to a
 * point: the edges the handle names follow the pointer, the rest stay where
 * they were. An edge pulled past the one opposite is left inverted — the core
 * squares that up when it takes the bounds.
 */
export function resizedBounds(
  bounds: Bounds,
  handle: ResizeHandle,
  point: Point,
): Bounds {
  const left = handle.includes('w') ? point.x : bounds.x
  const right = handle.includes('e') ? point.x : bounds.x + bounds.width
  const top = handle.includes('n') ? point.y : bounds.y
  const bottom = handle.includes('s') ? point.y : bounds.y + bounds.height

  return { x: left, y: top, width: right - left, height: bottom - top }
}

/** What a press at a point takes hold of, if anything. */
export type Grab =
  | { kind: 'move'; regionId: string }
  | { kind: 'resize'; regionId: string; handle: ResizeHandle }

/**
 * Reads a press as an intent to edit a region: a handle resizes it, its
 * outline moves it. Nothing means the press is somewhere free, where it draws
 * a new region instead.
 *
 * Only what is actually drawn can be grabbed. The space a region encloses is
 * left alone deliberately — a divergence often sits inside another one, and a
 * region has to stay drawable over the top of one already marked.
 *
 * Every handle is tried before any outline, so a region drawn over another
 * can't swallow the corner it overlaps. Within each pass the last region drawn
 * wins, because that is the one on top.
 *
 * `scale` is the fraction of natural size the capture is drawn at. The point
 * and the regions are both in capture pixels, so a capture drawn at half size
 * has to be given twice the slack in those pixels for a handle to stay the
 * same size under the pointer.
 */
export function grabAt(
  point: Point,
  regions: Region[],
  scale = 1,
): Grab | null {
  for (const region of [...regions].reverse()) {
    for (const handle of RESIZE_HANDLES) {
      if (within(point, handleCenter(region.bounds, handle), scale)) {
        return { kind: 'resize', regionId: region.id, handle }
      }
    }
  }

  for (const region of [...regions].reverse()) {
    if (onOutline(region.bounds, point, scale)) {
      return { kind: 'move', regionId: region.id }
    }
  }

  return null
}

/** The cursor for what is under the pointer — nothing under it draws. */
export function cursorFor(grab: Grab | null): string {
  if (!grab) return 'crosshair'
  return grab.kind === 'move' ? 'move' : HANDLE_CURSOR[grab.handle]
}

function within(point: Point, center: Point, scale: number): boolean {
  const reach = inCapturePixels(HANDLE_SIZE / 2, scale)
  return (
    Math.abs(point.x - center.x) <= reach &&
    Math.abs(point.y - center.y) <= reach
  )
}

/** On the rectangle's outline: within the grab band, either side of it. */
function onOutline(bounds: Bounds, point: Point, scale: number): boolean {
  const band = inCapturePixels(EDGE_GRAB / 2, scale)
  return (
    contains(grown(bounds, band), point) &&
    !contains(grown(bounds, -band), point)
  )
}

/**
 * A distance on screen, said in capture pixels. A scale of zero or less is
 * nonsense the stage can briefly report mid-layout; left undivided it would
 * make every target infinite, so it is read as "drawn at natural size".
 */
function inCapturePixels(onScreen: number, scale: number): number {
  return scale > 0 ? onScreen / scale : onScreen
}

/** The same rectangle, `by` further out on every side. */
function grown(bounds: Bounds, by: number): Bounds {
  return {
    x: bounds.x - by,
    y: bounds.y - by,
    width: bounds.width + by * 2,
    height: bounds.height + by * 2,
  }
}

function contains(bounds: Bounds, point: Point): boolean {
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
  )
}
