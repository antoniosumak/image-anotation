/** A point on the implementation capture, in capture pixels. */
export type Point = { x: number; y: number }

/** A rectangle on the implementation capture, in capture pixels. */
export type Bounds = { x: number; y: number; width: number; height: number }

/** The implementation capture being marked up. */
export type Capture = {
  /** Where the adapter can load the pixels from — an object URL or data URL. */
  src: string
  /** Natural width in pixels. The capture is never scaled. */
  width: number
  /** Natural height in pixels. */
  height: number
}

/**
 * Who drew a region. Written by the editor and unused in v1 — it exists so
 * model-assisted pre-labelling can arrive without a schema migration.
 */
export type RegionSource = 'human' | 'model'

/** A rectangle locating one divergence on the capture. */
export type Region = {
  id: string
  bounds: Bounds
  source: RegionSource
  /** How sure the source is. Only ever set by a model; unused in v1. */
  confidence?: number
}

/**
 * What to draw for a report, described rather than drawn. The canvas adapter is
 * the only thing that turns this into pixels — see ADR-0001.
 */
export type RenderPlan = {
  width: number
  height: number
  capture: { src: string }
  regions: Array<{ bounds: Bounds }>
}

/** The artifact handed to the coding agent for one implementation capture. */
export type Report = {
  plan: RenderPlan
}
