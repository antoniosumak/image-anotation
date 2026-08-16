/**
 * How a report lays its two sides out. Shared by the editor core, which plans
 * the layout, and the canvas adapter, which fills the ground the images don't
 * cover.
 */

/**
 * The gap between the implementation capture and the design reference beside
 * it. Wide enough that the two read as two images rather than one wide one.
 */
export const REPORT_GUTTER = 24

/**
 * What shows through the gutter, and beside the shorter of the two images.
 * A mid grey so it separates both a light design and a dark one.
 */
export const REPORT_BACKGROUND = '#a3a3a3'
