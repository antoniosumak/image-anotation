import type { Bounds } from '#/editor/types'

/**
 * How a region is drawn — shared by the on-screen overlay and the canvas
 * adapter so the copied image looks like what was drawn. Kept out of Tailwind
 * classes because the canvas cannot read them.
 */
export const REGION_STROKE = '#e11d48'
export const REGION_STROKE_WIDTH = 3

/**
 * The hairline around a resize handle, so it stays visible against whatever
 * the capture happens to show underneath it. Stated here rather than as a
 * Tailwind class because the design system's tokens clear Tailwind's stock
 * palette — and because everything else about how a region looks lives here.
 */
export const HANDLE_BORDER = '#ffffff'

/**
 * A region is named by a pin shaped like a Figma comment: a disc with one
 * corner pulled square, and that square corner is the thing that points. The
 * shape is the whole reason for it — a plate of colour has to be *found* on a
 * screenshot of a UI that is itself full of coloured plates, whereas a pin
 * with a tip reads as something stuck on top of the picture rather than part
 * of it, at any size and over any background.
 *
 * Which corner is square is therefore not decoration: it is what says which
 * point on the capture this is about.
 */
export type PinTip = 'bottom-left' | 'top-left'

export const PIN_SIZE = 28
/** Full round, so the three unpointed corners make a disc rather than a box. */
export const PIN_RADIUS = PIN_SIZE / 2

export const PIN_BACKGROUND = REGION_STROKE
export const PIN_TEXT_COLOR = '#ffffff'
export const PIN_FONT_SIZE = 13
export const PIN_FONT = `600 ${PIN_FONT_SIZE}px ui-sans-serif, system-ui, sans-serif`

/**
 * The white collar around the pin, and the shadow under it. Both are doing the
 * same job as Figma's: a capture can be any colour underneath, including the
 * pin's own, and a ring plus a shadow is what keeps the shape legible without
 * knowing anything about what it landed on.
 */
export const PIN_RING = '#ffffff'
export const PIN_RING_WIDTH = 2

export const SHADOW_COLOR = 'rgba(15, 23, 42, 0.35)'
export const SHADOW_BLUR = 8
export const SHADOW_OFFSET_Y = 2

/**
 * The note beside the pin, drawn the way Figma draws an open comment: dark
 * text on white, not white text on the accent. The pin is what has to be
 * spotted; the note is what has to be *read*, and those want opposite
 * treatments.
 */
export const CARD_BACKGROUND = '#ffffff'
export const CARD_TEXT_COLOR = '#0f172a'
export const CARD_BORDER = 'rgba(15, 23, 42, 0.12)'
export const CARD_BORDER_WIDTH = 1
export const CARD_FONT_SIZE = 13
export const CARD_LINE_HEIGHT = 18
export const CARD_FONT = `400 ${CARD_FONT_SIZE}px ui-sans-serif, system-ui, sans-serif`
export const CARD_PADDING_X = 10
export const CARD_PADDING_Y = 8
export const CARD_RADIUS = 10
/** Long notes wrap rather than running off the side of the capture. */
export const CARD_MAX_WIDTH = 320
/** How far the card is held off the pin it belongs to. */
export const CARD_GAP = 6

/**
 * The four corner radii in the order both CSS and the canvas take them —
 * top-left, top-right, bottom-right, bottom-left. One helper for both, so the
 * pin on screen and the pin in the report image cannot end up pointing
 * different ways.
 *
 * No tip at all is a plain disc, which is what the notes panel wants: there is
 * nothing beside it on the capture for it to be pointing at.
 */
export function pinCornerRadii(
  tip: PinTip | null,
): [number, number, number, number] {
  if (tip === 'bottom-left') return [PIN_RADIUS, PIN_RADIUS, PIN_RADIUS, 0]
  if (tip === 'top-left') return [0, PIN_RADIUS, PIN_RADIUS, PIN_RADIUS]
  return [PIN_RADIUS, PIN_RADIUS, PIN_RADIUS, PIN_RADIUS]
}

/** The same four radii as CSS writes them. */
export function pinBorderRadius(tip: PinTip | null): string {
  return pinCornerRadii(tip)
    .map((radius) => `${radius}px`)
    .join(' ')
}

/**
 * A pin sits above its region and points down at it, so it never covers what
 * the region is about. A region drawn against the top of the capture has no
 * room above it, so its pin goes below the rectangle and points up instead.
 *
 * `regionTop` is measured from the top of the capture, not of the report.
 */
export function pinSitsAbove(regionTop: number): boolean {
  return regionTop >= PIN_SIZE
}

/**
 * Where the pin goes for a region. Its tip lands exactly on a corner of the
 * rectangle — touching, with no gap: the gap is what would make it read as a
 * label that happens to be nearby rather than a pin stuck at that corner.
 */
export function pinBoundsFor(region: Bounds, tip: PinTip): Bounds {
  return {
    x: region.x,
    y: tip === 'bottom-left' ? region.y - PIN_SIZE : region.y + region.height,
    width: PIN_SIZE,
    height: PIN_SIZE,
  }
}

/** Which corner of the pin is square, given which side of the region it is on. */
export function tipFor(above: boolean): PinTip {
  return above ? 'bottom-left' : 'top-left'
}

/**
 * The note card beside its pin: to the right by default, and to the left when
 * there isn't room for it on the right — a region marked near the right edge
 * of the capture is common, and a card that ran off it would take the note
 * with it.
 *
 * It grows away from the region rather than towards it: level with the top of
 * a pin that sits below, and with the bottom of one that sits above. A card is
 * taller than a pin as soon as the note runs to two lines, and one that always
 * hung downwards would lie across the very thing the note is about.
 */
export function cardBoundsFor(
  pin: Bounds,
  tip: PinTip,
  card: { width: number; height: number },
  /** The capture the card has to stay on — never the report around it. */
  capture: Bounds,
): Bounds {
  const right = pin.x + pin.width + CARD_GAP
  const fitsRight = right + card.width <= capture.x + capture.width
  const x = fitsRight ? right : pin.x - CARD_GAP - card.width
  // The pin's square corner is the end that touches the region, so growing
  // from the opposite end is growing away from it.
  const y = tip === 'bottom-left' ? pin.y + pin.height - card.height : pin.y

  return {
    // A card wider than the room either side of the pin is pinned to the
    // capture rather than allowed off it, which is the only case where it
    // covers the pin.
    x: clamp(x, capture.x, capture.x + capture.width - card.width),
    y: clamp(y, capture.y, capture.y + capture.height - card.height),
    width: card.width,
    height: card.height,
  }
}

/** The one rectangle covering a pin and the card beside it. */
export function unionOf(first: Bounds, second: Bounds | null): Bounds {
  if (!second) return first
  const x = Math.min(first.x, second.x)
  const y = Math.min(first.y, second.y)
  return {
    x,
    y,
    width: Math.max(first.x + first.width, second.x + second.width) - x,
    height: Math.max(first.y + first.height, second.y + second.height) - y,
  }
}

/**
 * `max` below `min` means the thing being placed is bigger than the room for
 * it — a card wider than the capture. Pin it to `min` rather than inverting.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max))
}
