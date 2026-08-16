/** A point on the implementation capture, in capture pixels. */
export type Point = { x: number; y: number }

/** A rectangle on the implementation capture, in capture pixels. */
export type Bounds = { x: number; y: number; width: number; height: number }

/** An image the tool has decoded, and the size it came in at. */
export type LoadedImage = {
  /** Where the adapter can load the pixels from — an object URL or data URL. */
  src: string
  /**
   * Natural width in pixels — and the units everything else is measured in.
   * The report never scales the image; the stage may shrink the capture to
   * fit on screen, but that is a fact about the screen and nothing outside
   * the overlay knows about it.
   */
  width: number
  /** Natural height in pixels. */
  height: number
}

/** The implementation capture being marked up. */
export type Capture = LoadedImage

/**
 * The intended appearance of the screen the capture was taken of, attached so
 * the coding agent sees both sides of a divergence. A capture has zero or one:
 * the tool is fully usable with none, which is the common case when no export
 * is to hand.
 */
export type DesignReference = LoadedImage

/**
 * Who drew a region. Written by the editor and unused in v1 — it exists so
 * model-assisted pre-labelling can arrive without a schema migration.
 */
export type RegionSource = 'human' | 'model'

/** A rectangle locating one divergence on the capture. */
export type Region = {
  id: string
  /**
   * What the developer and the coding agent call this region: its 1-based
   * position among the regions on the capture, so deleting one closes the gap
   * it left. Kept apart from `id`, which identifies a region rather than
   * naming it, and so survives the renumbering.
   */
  number: number
  bounds: Bounds
  /** What is wrong here, in the developer's words. Empty until written. */
  note: string
  source: RegionSource
  /** How sure the source is. Only ever set by a model; unused in v1. */
  confidence?: number
}

/** One region as the report draws it: where it is, what it is called, what is wrong. */
export type PlannedRegion = {
  bounds: Bounds
  number: number
  /** Empty when nothing was written — the adapter then draws the number alone. */
  note: string
}

/** An image as the report draws it: where to load it from, and where it goes. */
export type PlannedImage = {
  src: string
  bounds: Bounds
}

/**
 * What to draw for a report, described rather than drawn. The canvas adapter is
 * the only thing that turns this into pixels — see ADR-0001.
 */
export type RenderPlan = {
  width: number
  height: number
  /**
   * Always at the origin, so a region's bounds are the same in capture pixels
   * and in report pixels.
   */
  capture: PlannedImage
  /** Beside the capture, or null when none is attached. */
  designReference: PlannedImage | null
  /** On the capture only — never on the design reference. */
  regions: PlannedRegion[]
}

/** The artifact handed to the coding agent for one implementation capture. */
export type Report = {
  plan: RenderPlan
  /**
   * The same regions and notes as words, for handing the coding agent text
   * rather than pixels. Numbers match the ones drawn on the image.
   */
  text: string
}
