import { describe, expect, it } from 'vitest'

import {
  CARD_GAP,
  PIN_RADIUS,
  PIN_SIZE,
  cardBoundsFor,
  pinBorderRadius,
  pinBoundsFor,
  pinCornerRadii,
  pinSitsAbove,
  tipFor,
  unionOf,
} from '#/lib/region-style'

/** A capture at the origin, as the report always lays it out. */
const CAPTURE = { x: 0, y: 0, width: 1000, height: 800 }

describe('pinCornerRadii', () => {
  it('squares off the corner that points, and rounds the rest', () => {
    expect(pinCornerRadii('bottom-left')).toEqual([
      PIN_RADIUS,
      PIN_RADIUS,
      PIN_RADIUS,
      0,
    ])
    expect(pinCornerRadii('top-left')).toEqual([
      0,
      PIN_RADIUS,
      PIN_RADIUS,
      PIN_RADIUS,
    ])
  })

  it('is a plain disc when it points at nothing', () => {
    expect(new Set(pinCornerRadii(null))).toEqual(new Set([PIN_RADIUS]))
  })

  it('writes the same corners for CSS as for the canvas', () => {
    const r = `${PIN_RADIUS}px`
    expect(pinBorderRadius('bottom-left')).toBe(`${r} ${r} ${r} 0px`)
    expect(pinBorderRadius('top-left')).toBe(`0px ${r} ${r} ${r}`)
  })
})

describe('pinSitsAbove', () => {
  it('points down at a region with room above it', () => {
    expect(pinSitsAbove(PIN_SIZE)).toBe(true)
    expect(tipFor(true)).toBe('bottom-left')
  })

  it('flips below a region drawn against the top of the capture', () => {
    expect(pinSitsAbove(PIN_SIZE - 1)).toBe(false)
    expect(pinSitsAbove(0)).toBe(false)
    expect(tipFor(false)).toBe('top-left')
  })
})

describe('pinBoundsFor', () => {
  const region = { x: 120, y: 200, width: 300, height: 90 }

  it('lands its tip on the top-left corner when it sits above', () => {
    const pin = pinBoundsFor(region, 'bottom-left')
    // The pointing corner is the bottom-left one, and it touches the region.
    expect({ x: pin.x, y: pin.y + pin.height }).toEqual({ x: 120, y: 200 })
  })

  it('lands its tip on the bottom-left corner when it sits below', () => {
    const pin = pinBoundsFor(region, 'top-left')
    expect({ x: pin.x, y: pin.y }).toEqual({ x: 120, y: 290 })
  })
})

describe('cardBoundsFor', () => {
  const region = { x: 100, y: 200, width: 200, height: 60 }
  const above = pinBoundsFor(region, 'bottom-left')
  const below = pinBoundsFor(region, 'top-left')

  it('sits to the right of the pin', () => {
    const card = cardBoundsFor(above, 'bottom-left', { width: 240, height: 28 }, CAPTURE)
    expect({ x: card.x, width: card.width }).toEqual({
      x: above.x + PIN_SIZE + CARD_GAP,
      width: 240,
    })
  })

  it('grows upwards from a pin above the region, never down over it', () => {
    const card = cardBoundsFor(above, 'bottom-left', { width: 240, height: 90 }, CAPTURE)
    // The card's foot is the pin's foot, which is the region's top corner.
    expect(card.y + card.height).toBe(above.y + PIN_SIZE)
    expect(card.y + card.height).toBeLessThanOrEqual(region.y)
  })

  it('grows downwards from a pin below the region, never up over it', () => {
    const card = cardBoundsFor(below, 'top-left', { width: 240, height: 90 }, CAPTURE)
    expect(card.y).toBe(below.y)
    expect(card.y).toBeGreaterThanOrEqual(region.y + region.height)
  })

  it('flips to the left of the pin rather than running off the capture', () => {
    const nearRight = pinBoundsFor(
      { x: 900, y: 200, width: 60, height: 60 },
      'bottom-left',
    )
    const card = cardBoundsFor(nearRight, 'bottom-left', { width: 240, height: 40 }, CAPTURE)
    expect(card.x + card.width).toBe(nearRight.x - CARD_GAP)
  })

  it('stays on the capture when the note is taller than the room beside it', () => {
    const low = pinBoundsFor({ x: 100, y: 700, width: 60, height: 90 }, 'top-left')
    const card = cardBoundsFor(low, 'top-left', { width: 200, height: 300 }, CAPTURE)
    expect(card.y + card.height).toBeLessThanOrEqual(CAPTURE.height)
  })

  it('pins a card wider than the whole capture to its left edge', () => {
    const card = cardBoundsFor(above, 'bottom-left', { width: 1200, height: 40 }, CAPTURE)
    expect(card.x).toBe(CAPTURE.x)
  })
})

describe('unionOf', () => {
  it('covers a pin and the card beside it', () => {
    expect(
      unionOf(
        { x: 100, y: 200, width: 28, height: 28 },
        { x: 134, y: 200, width: 240, height: 60 },
      ),
    ).toEqual({ x: 100, y: 200, width: 274, height: 60 })
  })

  it('is just the pin when nothing was written against the region', () => {
    const pin = { x: 100, y: 200, width: 28, height: 28 }
    expect(unionOf(pin, null)).toEqual(pin)
  })
})
