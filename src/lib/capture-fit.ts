/**
 * How the capture is sized down to sit inside the stage that holds it.
 *
 * The stage is a fixed part of the app's layout, so the capture cannot be the
 * thing that decides how big the page is — a 3000px Figma export used to push
 * every panel off screen. Instead the capture is drawn at whatever fraction of
 * its natural size fits, and the geometry stays in capture pixels throughout:
 * regions are stored, planned and rasterized as if nothing were scaled, and
 * only the pointer coming in and the overlay going out are converted.
 */

/** Anything with a size in pixels — a capture, or the stage holding it. */
export type Size = { width: number; height: number }

/**
 * The fraction of natural size the capture is drawn at.
 *
 * Never above 1: a capture smaller than the stage stays at its own pixels,
 * where a one-pixel spacing error is still a one-pixel spacing error rather
 * than a blur. Only oversized captures are shrunk, and only as far as they
 * have to be.
 *
 * `stage` is null until the stage has been measured, and a stage mid-layout
 * can report zero — both mean "no idea yet", answered with natural size
 * because that is what the capture is drawn at once it does fit.
 */
export function fitScale(capture: Size, stage: Size | null): number {
  if (!stage) return 1
  if (stage.width <= 0 || stage.height <= 0) return 1
  if (capture.width <= 0 || capture.height <= 0) return 1

  return Math.min(1, stage.width / capture.width, stage.height / capture.height)
}

/** The size the capture is drawn at, rounded to whole device pixels. */
export function scaledSize(capture: Size, scale: number): Size {
  return {
    width: Math.round(capture.width * scale),
    height: Math.round(capture.height * scale),
  }
}
