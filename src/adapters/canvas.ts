import { loadImage } from '#/adapters/image'
import type { Bounds, PlannedRegion, RenderPlan } from '#/editor/types'
import { REPORT_BACKGROUND } from '#/lib/report-layout'
import {
  CARD_BACKGROUND,
  CARD_BORDER,
  CARD_BORDER_WIDTH,
  CARD_FONT,
  CARD_LINE_HEIGHT,
  CARD_MAX_WIDTH,
  CARD_PADDING_X,
  CARD_PADDING_Y,
  CARD_RADIUS,
  CARD_TEXT_COLOR,
  PIN_BACKGROUND,
  PIN_FONT,
  PIN_RING,
  PIN_RING_WIDTH,
  PIN_TEXT_COLOR,
  type PinTip,
  REGION_STROKE,
  REGION_STROKE_WIDTH,
  SHADOW_BLUR,
  SHADOW_COLOR,
  SHADOW_OFFSET_Y,
  cardBoundsFor,
  pinBoundsFor,
  pinCornerRadii,
  pinSitsAbove,
  tipFor,
  unionOf,
} from '#/lib/region-style'

/** A region's pin and note card, once it is known where they both go. */
type PlacedComment = {
  number: number
  pin: Bounds
  tip: PinTip
  card: (Bounds & { lines: string[] }) | null
}

/**
 * The only thing in the app that turns a plan into pixels. It reads the plan
 * and draws it — every decision about *what* to draw was already made by the
 * editor core.
 */
export async function rasterizeReport(plan: RenderPlan): Promise<Blob> {
  // Both sides at once: the report is one image, so it is only worth drawing
  // once both have decoded.
  const images = await Promise.all(
    [plan.capture, plan.designReference]
      .filter((planned) => planned !== null)
      .map(async (planned) => ({
        planned,
        image: await loadImage(planned.src),
      })),
  )

  const canvas = document.createElement('canvas')
  canvas.width = plan.width
  canvas.height = plan.height

  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not get a 2d canvas context')

  // Under everything, so the gutter between the two sides — and the ground
  // beside the shorter of them — isn't left transparent.
  context.fillStyle = REPORT_BACKGROUND
  context.fillRect(0, 0, plan.width, plan.height)

  for (const { planned, image } of images) {
    const { bounds } = planned
    context.drawImage(image, bounds.x, bounds.y, bounds.width, bounds.height)
  }

  context.strokeStyle = REGION_STROKE
  context.lineWidth = REGION_STROKE_WIDTH
  for (const { bounds } of plan.regions) {
    // Canvas centres a stroke on its path; the on-screen overlay draws its
    // border inside the bounds. Inset by half the width so the rectangle in
    // the copied image sits exactly where it was drawn.
    const inset = REGION_STROKE_WIDTH / 2
    context.strokeRect(
      bounds.x + inset,
      bounds.y + inset,
      Math.max(bounds.width - REGION_STROKE_WIDTH, 0),
      Math.max(bounds.height - REGION_STROKE_WIDTH, 0),
    )
  }

  // Placed for every region before any of them is drawn, so the pass order
  // below can be decided across the whole capture rather than region by
  // region.
  const comments = plan.regions.map((region) => place(context, region, plan))

  // Cards first and pins after, all of them: a card belonging to one region
  // would otherwise be free to bury the pin of another, and the pins are the
  // part that has to survive being drawn over.
  for (const { card } of comments) if (card) drawCard(context, card)
  for (const comment of comments) drawPin(context, comment)

  return toPng(canvas)
}

/**
 * Where a region's pin and note card go. The pin points at a corner of the
 * rectangle from outside it, and the card sits beside the pin — so the report
 * carries what is wrong as well as where, without either covering the thing
 * being complained about.
 */
function place(
  context: CanvasRenderingContext2D,
  region: PlannedRegion,
  plan: RenderPlan,
): PlacedComment {
  const { bounds } = region
  // Held to the capture, not to the report, so a note never strays onto the
  // design reference beside it.
  const capture = plan.capture.bounds

  context.font = CARD_FONT
  const lines = region.note ? wrapText(context, region.note, CARD_MAX_WIDTH) : []
  const size = lines.length
    ? {
        width:
          Math.max(...lines.map((line) => context.measureText(line).width)) +
          CARD_PADDING_X * 2,
        height: lines.length * CARD_LINE_HEIGHT + CARD_PADDING_Y * 2,
      }
    : null

  const sideOf = (above: boolean) => {
    const tip = tipFor(above)
    const pin = pinBoundsFor(bounds, tip)
    const card = size ? cardBoundsFor(pin, tip, size, capture) : null
    return { number: region.number, pin, tip, card: card && { ...card, lines } }
  }

  // Above by default. With several regions on one capture a pin can still land
  // on a *neighbour*, so take the side that covers fewer of them.
  const preferred = sideOf(pinSitsAbove(bounds.y - capture.y))
  const alternative = sideOf(preferred.tip !== 'bottom-left')
  const usable = [preferred, alternative].filter((side) =>
    fitsOnCapture(side.pin, capture),
  )
  // Neither side fits when the capture is barely taller than the region — a
  // pin half off the top of it still points at the right corner, which is
  // more use than one moved somewhere it fits.
  if (usable.length < 2) return usable[0] ?? preferred

  const others = plan.regions.filter((other) => other !== region)
  return covered(footprintOf(alternative), others) <
    covered(footprintOf(preferred), others)
    ? alternative
    : preferred
}

function footprintOf(comment: PlacedComment): Bounds {
  return unionOf(comment.pin, comment.card)
}

/** Whether a pin is drawn wholly on the capture rather than off the end of it. */
function fitsOnCapture(pin: Bounds, capture: Bounds): boolean {
  return pin.y >= capture.y && pin.y + pin.height <= capture.y + capture.height
}

/** How many of the other regions this footprint would be drawn over. */
function covered(footprint: Bounds, regions: PlannedRegion[]): number {
  return regions.filter(
    ({ bounds }) =>
      footprint.x < bounds.x + bounds.width &&
      footprint.x + footprint.width > bounds.x &&
      footprint.y < bounds.y + bounds.height &&
      footprint.y + footprint.height > bounds.y,
  ).length
}

/**
 * The pin: a disc with its pointing corner squared off, a white collar and a
 * shadow. The collar and the shadow are drawn without each other — a shadow
 * cast by the collar rather than by the pin would ring it in grey.
 */
function drawPin(
  context: CanvasRenderingContext2D,
  { pin, tip, number }: PlacedComment,
) {
  const radii = pinCornerRadii(tip)

  context.save()
  context.shadowColor = SHADOW_COLOR
  context.shadowBlur = SHADOW_BLUR
  context.shadowOffsetY = SHADOW_OFFSET_Y
  context.fillStyle = PIN_BACKGROUND
  context.beginPath()
  context.roundRect(pin.x, pin.y, pin.width, pin.height, radii)
  context.fill()
  context.restore()

  context.save()
  context.strokeStyle = PIN_RING
  context.lineWidth = PIN_RING_WIDTH
  context.beginPath()
  // Inset by half the width, so the collar sits *inside* the pin's bounds as
  // the overlay's border does — a stroke centred on the path would put the
  // pin's outer edge half a ring further out here than on screen.
  const inset = PIN_RING_WIDTH / 2
  context.roundRect(
    pin.x + inset,
    pin.y + inset,
    pin.width - PIN_RING_WIDTH,
    pin.height - PIN_RING_WIDTH,
    radii.map((radius) => (radius > 0 ? radius - inset : 0)),
  )
  context.stroke()

  context.font = PIN_FONT
  context.fillStyle = PIN_TEXT_COLOR
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  // Centred on the whole pin rather than on the disc: the squared corner is
  // the tip, and a number nudged away from it would read as off-centre.
  context.fillText(`${number}`, pin.x + pin.width / 2, pin.y + pin.height / 2)
  context.restore()
}

/** The note, as Figma draws an open comment: dark text on a white card. */
function drawCard(
  context: CanvasRenderingContext2D,
  card: Bounds & { lines: string[] },
) {
  context.save()
  context.shadowColor = SHADOW_COLOR
  context.shadowBlur = SHADOW_BLUR
  context.shadowOffsetY = SHADOW_OFFSET_Y
  context.fillStyle = CARD_BACKGROUND
  context.beginPath()
  context.roundRect(card.x, card.y, card.width, card.height, CARD_RADIUS)
  context.fill()
  context.restore()

  context.save()
  // Inset by half the width, because canvas centres a stroke on its path and
  // the card's edge is where the white stops.
  const inset = CARD_BORDER_WIDTH / 2
  context.strokeStyle = CARD_BORDER
  context.lineWidth = CARD_BORDER_WIDTH
  context.beginPath()
  context.roundRect(
    card.x + inset,
    card.y + inset,
    card.width - CARD_BORDER_WIDTH,
    card.height - CARD_BORDER_WIDTH,
    CARD_RADIUS,
  )
  context.stroke()

  context.font = CARD_FONT
  context.fillStyle = CARD_TEXT_COLOR
  context.textAlign = 'left'
  context.textBaseline = 'top'
  card.lines.forEach((line, index) => {
    context.fillText(
      line,
      card.x + CARD_PADDING_X,
      card.y + CARD_PADDING_Y + index * CARD_LINE_HEIGHT,
    )
  })
  context.restore()
}

/**
 * Breaks a note across lines so a long one stays on the capture. Line breaks
 * the developer typed are kept — they meant them.
 */
function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = []

  for (const paragraph of text.split('\n')) {
    let line = ''
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word
      if (line && context.measureText(candidate).width > maxWidth) {
        lines.push(line)
        line = word
      } else {
        line = candidate
      }
    }
    lines.push(line)
  }

  return lines
}

function toPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Could not encode the report as a PNG'))
    }, 'image/png')
  })
}
