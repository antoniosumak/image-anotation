/**
 * How a region is drawn — shared by the on-screen overlay and the canvas
 * adapter so the copied image looks like what was drawn. Kept out of Tailwind
 * classes because the canvas cannot read them.
 */
export const REGION_STROKE = '#e11d48'
export const REGION_STROKE_WIDTH = 3

/** The plate carrying a region's number, and its note where there is one. */
export const LABEL_BACKGROUND = REGION_STROKE
export const LABEL_TEXT_COLOR = '#ffffff'
export const LABEL_FONT_SIZE = 13
export const LABEL_LINE_HEIGHT = 17
export const LABEL_FONT = `600 ${LABEL_FONT_SIZE}px ui-sans-serif, system-ui, sans-serif`
export const LABEL_PADDING_X = 6
export const LABEL_PADDING_Y = 3
export const LABEL_RADIUS = 4
/** How far the label is held off the rectangle it belongs to. */
export const LABEL_GAP = 4
/** Height of a label carrying a number alone, as the overlay draws it. */
export const LABEL_NUMBER_SIZE = 20
/** Long notes wrap rather than running off the side of the capture. */
export const LABEL_MAX_WIDTH = 320

/**
 * A label sits above its region so it never covers what the region points at.
 * A region drawn near the top of the capture has no room above it, so its
 * label goes below the rectangle instead.
 */
export function labelSitsAbove(regionTop: number, labelHeight: number): boolean {
  return regionTop >= labelHeight + LABEL_GAP
}
