import { loadImage } from '#/adapters/image'
import type { Bounds, PlannedRegion, RenderPlan } from '#/editor/types'
import {
  LABEL_BACKGROUND,
  LABEL_FONT,
  LABEL_GAP,
  LABEL_LINE_HEIGHT,
  LABEL_MAX_WIDTH,
  LABEL_PADDING_X,
  LABEL_PADDING_Y,
  LABEL_RADIUS,
  LABEL_TEXT_COLOR,
  REGION_STROKE,
  REGION_STROKE_WIDTH,
  labelSitsAbove,
} from '#/lib/region-style'

/**
 * The only thing in the app that turns a plan into pixels. It reads the plan
 * and draws it — every decision about *what* to draw was already made by the
 * editor core.
 */
export async function rasterizeReport(plan: RenderPlan): Promise<Blob> {
  const image = await loadImage(plan.capture.src)

  const canvas = document.createElement('canvas')
  canvas.width = plan.width
  canvas.height = plan.height

  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not get a 2d canvas context')

  context.drawImage(image, 0, 0, plan.width, plan.height)

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

  // Labels go on after every rectangle, so one region's note is never drawn
  // under a rectangle belonging to another.
  for (const region of plan.regions) drawLabel(context, region, plan)

  return toPng(canvas)
}

/**
 * Draws a region's number, and its note when one was written, on a plate
 * beside the rectangle — the image is pasted on its own, so it has to carry
 * what is wrong as well as where.
 */
function drawLabel(
  context: CanvasRenderingContext2D,
  region: PlannedRegion,
  plan: RenderPlan,
) {
  context.font = LABEL_FONT
  context.textBaseline = 'top'

  const lines = wrapText(
    context,
    region.note ? `${region.number}. ${region.note}` : `${region.number}`,
    LABEL_MAX_WIDTH,
  )
  const width =
    Math.max(...lines.map((line) => context.measureText(line).width)) +
    LABEL_PADDING_X * 2
  const height = lines.length * LABEL_LINE_HEIGHT + LABEL_PADDING_Y * 2

  // A region against the edge of the capture would push its label off it.
  // A region against the edge of the capture would push its label off it.
  const { bounds } = region
  const x = clamp(bounds.x, 0, plan.width - width)

  // Above by default, so a label never covers the region it belongs to. With
  // several regions on one capture it can still land on a *neighbour*, so take
  // the side that covers fewer of them.
  const others = plan.regions.filter((other) => other !== region)
  const above = topFor('above', bounds, height, plan)
  const below = topFor('below', bounds, height, plan)
  const preferred = labelSitsAbove(bounds.y, height) ? above : below
  const alternative = preferred === above ? below : above
  const y =
    covered({ x, y: alternative, width, height }, others) <
    covered({ x, y: preferred, width, height }, others)
      ? alternative
      : preferred

  context.fillStyle = LABEL_BACKGROUND
  context.beginPath()
  context.roundRect(x, y, width, height, LABEL_RADIUS)
  context.fill()

  context.fillStyle = LABEL_TEXT_COLOR
  lines.forEach((line, index) => {
    context.fillText(
      line,
      x + LABEL_PADDING_X,
      y + LABEL_PADDING_Y + index * LABEL_LINE_HEIGHT,
    )
  })
}

/** Where a label of this height sits if put on the given side of its region. */
function topFor(
  side: 'above' | 'below',
  bounds: Bounds,
  height: number,
  plan: RenderPlan,
): number {
  const top =
    side === 'above'
      ? bounds.y - LABEL_GAP - height
      : bounds.y + bounds.height + LABEL_GAP
  return clamp(top, 0, plan.height - height)
}

/** How many of the other regions this label would be drawn over. */
function covered(label: Bounds, regions: PlannedRegion[]): number {
  return regions.filter(
    ({ bounds }) =>
      label.x < bounds.x + bounds.width &&
      label.x + label.width > bounds.x &&
      label.y < bounds.y + bounds.height &&
      label.y + label.height > bounds.y,
  ).length
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

/**
 * `max` below `min` means the thing being placed is bigger than the room for
 * it — a label wider than the capture. Pin it to `min` rather than inverting.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

function toPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Could not encode the report as a PNG'))
    }, 'image/png')
  })
}
