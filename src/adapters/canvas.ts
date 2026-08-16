import { loadImage } from '#/adapters/image'
import type { PlannedRegion, RenderPlan } from '#/editor/types'
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
  const { bounds } = region
  const x = clamp(bounds.x, 0, plan.width - width)
  const y = clamp(
    labelSitsAbove(bounds.y, height)
      ? bounds.y - LABEL_GAP - height
      : bounds.y + bounds.height + LABEL_GAP,
    0,
    plan.height - height,
  )

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

/** Breaks a note across lines so a long one stays on the capture. */
function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = []
  let line = ''

  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line)
      line = word
    } else {
      line = candidate
    }
  }

  lines.push(line)
  return lines
}

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
