import type {
  Bounds,
  Capture,
  DesignReference,
  Point,
  Region,
  RenderPlan,
  Report,
} from '#/editor/types'
import { REPORT_GUTTER } from '#/lib/report-layout'

/**
 * Everything observable about an editor, as one immutable value. Intents
 * replace it wholesale so an adapter can subscribe and compare by reference.
 */
export type EditorState = {
  regions: Region[]
  /** The region currently being dragged, before it is committed. */
  draft: Region | null
  /** The design reference attached to the capture, or null when there is none. */
  designReference: DesignReference | null
}

/**
 * Which side of the report is which. The image is pasted on its own as often
 * as not, but the coding agent gets the text too, and one sentence there beats
 * captions burned over pixels the developer is asking it to judge.
 */
const SIDES =
  'The implementation capture is on the left, and the design reference it should match is on the right. The numbered regions mark divergences on the implementation capture.'

/**
 * What was actually written against a region. A note of nothing but whitespace
 * was never written, and trailing space the developer stopped typing after
 * shouldn't reach the report.
 */
function noteOn(region: Region): string {
  return region.note.trim()
}

/**
 * The regions as words, so the coding agent reads the notes as text rather
 * than off the pixels. A region nothing was written against is still listed —
 * every number drawn on the image has an entry here.
 */
function describeRegions(regions: Region[]): string {
  return regions
    .map((region) => {
      // A note can run to several lines. Indenting the rest of them keeps the
      // numbers as the only things starting an entry, so a second line can't
      // read as the next region.
      const note = noteOn(region).replace(/\n/g, '\n   ') || '(no note)'
      return `${region.number}. ${note}`
    })
    .join('\n')
}

/**
 * A number names a region by where it sits among the others, so the numbers
 * close up behind a deleted one — a report never says "3." with two regions
 * drawn. Notes travel with their regions, not with the numbers.
 */
function numbered(regions: Region[]): Region[] {
  return regions.map((region, index) =>
    region.number === index + 1 ? region : { ...region, number: index + 1 },
  )
}

/**
 * Where the two sides of a divergence go on one report image: the capture on
 * the left at the origin, and the design reference — when there is one — to the
 * right of it, both at natural size. Neither is scaled, because a report is
 * read for spacing a few pixels out, and scaling is what hides that.
 *
 * The capture staying at the origin is what lets a region's bounds be the same
 * in capture pixels and in report pixels.
 */
function roomForBothSides(
  capture: Capture,
  designReference: DesignReference | null,
): Omit<RenderPlan, 'regions'> {
  const captureBounds = {
    x: 0,
    y: 0,
    width: capture.width,
    height: capture.height,
  }

  if (!designReference) {
    return {
      width: capture.width,
      height: capture.height,
      capture: { src: capture.src, bounds: captureBounds },
      designReference: null,
    }
  }

  const beside = capture.width + REPORT_GUTTER
  return {
    width: beside + designReference.width,
    height: Math.max(capture.height, designReference.height),
    capture: { src: capture.src, bounds: captureBounds },
    designReference: {
      src: designReference.src,
      // Top-aligned: both sides show the same screen, so lining their tops up
      // puts the same element at roughly the same height on each.
      bounds: {
        x: beside,
        y: 0,
        width: designReference.width,
        height: designReference.height,
      },
    },
  }
}

function boundsBetween(from: Point, to: Point): Bounds {
  return {
    x: Math.min(from.x, to.x),
    y: Math.min(from.y, to.y),
    width: Math.abs(to.x - from.x),
    height: Math.abs(to.y - from.y),
  }
}

/**
 * The editor core: the one seam this app carries value at.
 *
 * It takes intents rather than pointer events and never touches the DOM, so a
 * test can drive a whole drag and assert on what was committed. It describes
 * reports rather than drawing them — see ADR-0001 and `buildReport`.
 */
export function createEditor(capture: Capture) {
  let state: EditorState = { regions: [], draft: null, designReference: null }
  let dragOrigin: Point | null = null
  let regionsDrawn = 0
  const listeners = new Set<() => void>()

  function setState(next: EditorState) {
    state = next
    for (const listener of listeners) listener()
  }

  /** A region locates something on the capture, so it cannot fall off it. */
  function ontoCapture(point: Point): Point {
    return {
      x: Math.min(Math.max(point.x, 0), capture.width),
      y: Math.min(Math.max(point.y, 0), capture.height),
    }
  }

  /**
   * Pins each edge of a rectangle onto the capture, and squares up one pulled
   * past the edge opposite it — which is what a resize back through itself is.
   */
  function fittedOntoCapture(bounds: Bounds): Bounds {
    return boundsBetween(
      ontoCapture({ x: bounds.x, y: bounds.y }),
      ontoCapture({ x: bounds.x + bounds.width, y: bounds.y + bounds.height }),
    )
  }

  /**
   * Slides a rectangle back onto the capture at the size it already is — a
   * move that ran off the edge stops there rather than being trimmed.
   */
  function slidOntoCapture(bounds: Bounds): Bounds {
    return {
      ...bounds,
      x: Math.min(
        Math.max(bounds.x, 0),
        Math.max(capture.width - bounds.width, 0),
      ),
      y: Math.min(
        Math.max(bounds.y, 0),
        Math.max(capture.height - bounds.height, 0),
      ),
    }
  }

  /** Puts a region back at new bounds, leaving its number and note alone. */
  function setBounds(regionId: string, bounds: Bounds) {
    setState({
      ...state,
      regions: state.regions.map((region) =>
        region.id === regionId ? { ...region, bounds } : region,
      ),
    })
  }

  function regionById(regionId: string): Region | undefined {
    return state.regions.find((region) => region.id === regionId)
  }

  return {
    beginRegion(point: Point) {
      dragOrigin = ontoCapture(point)
      setState({
        ...state,
        draft: {
          // Only committed regions consume an id, so a cancelled or
          // never-dragged one doesn't strand one.
          id: `region-${regionsDrawn + 1}`,
          // The number it will carry once committed, so the drag shows the
          // label the developer is about to be writing a note against.
          number: state.regions.length + 1,
          bounds: boundsBetween(dragOrigin, dragOrigin),
          note: '',
          source: 'human',
        },
      })
    },

    updateRegion(point: Point) {
      if (!dragOrigin || !state.draft) return
      setState({
        ...state,
        draft: {
          ...state.draft,
          bounds: boundsBetween(dragOrigin, ontoCapture(point)),
        },
      })
    },

    commitRegion() {
      const { draft } = state
      if (!draft) return
      dragOrigin = null
      // A click that never became a drag is not a region.
      const drawn = draft.bounds.width > 0 && draft.bounds.height > 0
      if (drawn) regionsDrawn += 1
      setState({
        ...state,
        regions: drawn ? [...state.regions, draft] : state.regions,
        draft: null,
      })
    },

    /**
     * Writes what is wrong at a region — the *what* its rectangle can't say.
     * Writing and editing are the same intent: the note is replaced outright,
     * so a note can be sharpened without redrawing the region.
     */
    annotate(regionId: string, note: string) {
      if (!regionById(regionId)) return
      setState({
        ...state,
        regions: state.regions.map((region) =>
          region.id === regionId ? { ...region, note } : region,
        ),
      })
    },

    /**
     * Repositions a region without redrawing it, so the note written against
     * it — which describes the element, not the coordinates — stays put.
     */
    moveRegion(regionId: string, delta: Point) {
      const region = regionById(regionId)
      if (!region) return
      setBounds(
        regionId,
        slidOntoCapture({
          ...region.bounds,
          x: region.bounds.x + delta.x,
          y: region.bounds.y + delta.y,
        }),
      )
    },

    /**
     * Puts a region at the bounds given — tightening it onto the element it
     * points at, or putting it back where an abandoned drag found it. Takes
     * the whole rectangle rather than an edge and a distance: which edge was
     * pulled is pointer detail, and the bounds are what the region is.
     */
    resizeRegion(regionId: string, bounds: Bounds) {
      if (!regionById(regionId)) return
      const fitted = fittedOntoCapture(bounds)
      // A region pulled shut is a region that locates nothing. Keep the bounds
      // it had rather than leaving something invisible to grab hold of again.
      if (fitted.width === 0 || fitted.height === 0) return
      setBounds(regionId, fitted)
    },

    /**
     * Drops a region the developer decided was not a divergence, and the note
     * written against it — the note only ever meant anything at that region.
     */
    removeRegion(regionId: string) {
      if (!regionById(regionId)) return
      setState({
        ...state,
        regions: numbered(
          state.regions.filter((region) => region.id !== regionId),
        ),
      })
    },

    /** Abandons the drag in progress, leaving committed regions untouched. */
    cancelRegion() {
      if (!state.draft) return
      dragOrigin = null
      setState({ ...state, draft: null })
    },

    /**
     * Puts the intended appearance of the screen beside the capture, so the
     * coding agent sees both sides. Attaching over one already there replaces
     * it — the regions and notes belong to the capture, not to it, so they are
     * left alone.
     */
    attachDesignReference(designReference: DesignReference) {
      setState({ ...state, designReference })
    },

    /** Takes it back off, returning the capture to having none. */
    removeDesignReference() {
      if (!state.designReference) return
      setState({ ...state, designReference: null })
    },

    regions(): Region[] {
      return state.regions
    },

    draftRegion(): Region | null {
      return state.draft
    },

    designReference(): DesignReference | null {
      return state.designReference
    },

    /**
     * Describes the report rather than drawing it: the canvas adapter is the
     * only thing that rasterizes. A region still mid-drag is not in the plan —
     * only committed regions are reported.
     */
    buildReport(): Report {
      const { designReference } = state
      return {
        plan: {
          ...roomForBothSides(capture, designReference),
          regions: state.regions.map((region) => ({
            bounds: region.bounds,
            number: region.number,
            note: noteOn(region),
          })),
        },
        // Which side is which only needs saying when there are two of them.
        text: [designReference ? SIDES : '', describeRegions(state.regions)]
          .filter(Boolean)
          .join('\n\n'),
      }
    },

    /** For adapters that re-render on change; returns an unsubscribe. */
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    getState(): EditorState {
      return state
    },
  }
}
