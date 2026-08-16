import type { Bounds, Capture, Point, Region, Report } from '#/editor/types'

/**
 * Everything observable about an editor, as one immutable value. Intents
 * replace it wholesale so an adapter can subscribe and compare by reference.
 */
export type EditorState = {
  regions: Region[]
  /** The region currently being dragged, before it is committed. */
  draft: Region | null
}

/**
 * The regions as words, one line each, so the coding agent reads the notes as
 * text rather than off the pixels. A region with nothing written against it is
 * still listed — every number drawn on the image has a line here.
 */
function describeRegions(regions: Region[]): string {
  return regions
    .map((region) => `${region.number}. ${region.note || '(no note)'}`)
    .join('\n')
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
  let state: EditorState = { regions: [], draft: null }
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
      if (!state.regions.some((region) => region.id === regionId)) return
      setState({
        ...state,
        regions: state.regions.map((region) =>
          region.id === regionId ? { ...region, note } : region,
        ),
      })
    },

    /** Abandons the drag in progress, leaving committed regions untouched. */
    cancelRegion() {
      if (!state.draft) return
      dragOrigin = null
      setState({ ...state, draft: null })
    },

    regions(): Region[] {
      return state.regions
    },

    draftRegion(): Region | null {
      return state.draft
    },

    /**
     * Describes the report rather than drawing it: the canvas adapter is the
     * only thing that rasterizes. A region still mid-drag is not in the plan —
     * only committed regions are reported.
     */
    buildReport(): Report {
      return {
        plan: {
          width: capture.width,
          height: capture.height,
          capture: { src: capture.src },
          regions: state.regions.map((region) => ({
            bounds: region.bounds,
            number: region.number,
            note: region.note,
          })),
        },
        text: describeRegions(state.regions),
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
