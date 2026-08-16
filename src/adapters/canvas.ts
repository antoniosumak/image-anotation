import { loadImage } from '#/adapters/image'
import type { RenderPlan } from '#/editor/types'
import { REGION_STROKE, REGION_STROKE_WIDTH } from '#/lib/region-style'

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

  return toPng(canvas)
}

function toPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Could not encode the report as a PNG'))
    }, 'image/png')
  })
}
