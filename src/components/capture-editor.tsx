import { Button } from '@plerivo/ui/button'
import { Separator } from '@plerivo/ui/separator'
import { Textarea } from '@plerivo/ui/textarea'
import {
  Check,
  Copy,
  Maximize2,
  Minimize2,
  TriangleAlert,
  Trash2,
} from 'lucide-react'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { rasterizeReport } from '#/adapters/canvas'
import { copyImageToClipboard, copyTextToClipboard } from '#/adapters/clipboard'
import { writeReportImage } from '#/adapters/filesystem'
import { loadImageFile, releaseLoadedImage } from '#/adapters/image'
import { DesignReferencePanel } from '#/components/design-reference-panel'
import { PanelHeading } from '#/components/panel-heading'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '#/components/ui/alert-dialog'
import { createEditor, reportTextReferencing } from '#/editor/createEditor'
import type {
  Bounds,
  Capture,
  DesignReference,
  Point,
  Region,
} from '#/editor/types'
import { type Size, fitScale, scaledSize } from '#/lib/capture-fit'
import {
  HANDLE_SIZE,
  RESIZE_HANDLES,
  type ResizeHandle,
  cursorFor,
  grabAt,
  handleCenter,
  resizedBounds,
} from '#/lib/region-handles'
import {
  HANDLE_BORDER,
  LABEL_BACKGROUND,
  LABEL_GAP,
  LABEL_NUMBER_SIZE,
  LABEL_TEXT_COLOR,
  REGION_STROKE,
  REGION_STROKE_WIDTH,
  labelSitsAbove,
} from '#/lib/region-style'
import { cn } from '#/lib/utils'

/**
 * How handing the report over went. `empty` is the editor core refusing to
 * build a report at all — asked for with nothing marked up, both ways of
 * handing one over say so here rather than sending an unmarked capture.
 */
type CopyState = 'idle' | 'copying' | 'copied' | 'failed' | 'empty'

/**
 * How the other way of handing a report over went. The image landing on disk
 * and the text block landing on the clipboard are two things that can fail
 * separately, and saying "text copied" when the clipboard refused it would
 * send the developer off to paste nothing.
 */
type WriteState =
  | 'idle'
  | 'writing'
  | 'copied'
  | 'uncopied'
  | 'failed'
  | 'empty'

/**
 * The drag under way, as pointer bookkeeping — which region is being edited
 * and where the drag started, so escaping out of it can put things back. What
 * the drag *means* for the regions is the editor core's business.
 */
type Gesture =
  | { kind: 'draw' }
  | { kind: 'move'; regionId: string; last: Point; from: Bounds }
  | { kind: 'resize'; regionId: string; handle: ResizeHandle; from: Bounds }

/**
 * How big the capture is drawn. `fit` shrinks an oversized capture until the
 * whole of it is on the stage; `actual` puts it back on its own pixels, where
 * a one-pixel spacing error is judgeable, and lets the stage scroll. Neither
 * changes the capture, the regions or the report — only what is on screen.
 */
type Zoom = 'fit' | 'actual'

/** Said by whichever button was pressed on an unmarked capture. */
const NOTHING_TO_SEND = 'Nothing to send — draw a region first'

const COPY_LABEL: Record<CopyState, string> = {
  idle: 'Copy Image',
  copying: 'Copying…',
  copied: 'Copied',
  failed: 'Copy failed — try again',
  empty: NOTHING_TO_SEND,
}

const WRITE_LABEL: Record<WriteState, string> = {
  idle: 'Write Image, Copy Text',
  writing: 'Writing…',
  copied: 'Text copied',
  uncopied: 'Text not copied — try again',
  failed: 'Write failed — try again',
  empty: NOTHING_TO_SEND,
}

/**
 * Drives the editor core from pointer events and draws what it reports. It
 * holds no state of its own beyond how things are being *looked* at: every
 * rectangle on screen came out of the core.
 */
export function CaptureEditor({
  capture,
  onClear,
}: {
  capture: Capture
  /** Discards the capture and everything drawn on it — see `ClearCaptureButton`. */
  onClear: () => void
}) {
  const [editor] = useState(() => createEditor(capture))
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const [writeState, setWriteState] = useState<WriteState>('idle')
  // Where the last image written went. Kept however the capture is marked up
  // afterwards, because the file is still there and a text block already pasted
  // into a coding agent still names it.
  const [written, setWritten] = useState<string | null>(null)
  const [cursor, setCursor] = useState('crosshair')
  const [zoom, setZoom] = useState<Zoom>('fit')
  const gesture = useRef<Gesture | null>(null)

  const [stageRef, stageSize] = useMeasuredSize<HTMLDivElement>()
  const fits = fitScale(capture, stageSize)
  const scale = zoom === 'actual' ? 1 : fits
  const drawn = scaledSize(capture, scale)

  // What was copied described the regions as they stood — once they change,
  // saying it was copied would be saying it about a report that no longer
  // exists.
  const forgetWhatWasCopied = () => {
    setCopyState('idle')
    setWriteState('idle')
  }

  const { regions, draft, designReference } = useSyncExternalStore(
    editor.subscribe,
    editor.getState,
    editor.getState,
  )

  // Puts a design reference beside the capture, or none. The object URL behind
  // the one it replaces is this component's to release: the editor core holds
  // the string, and never learns it has been replaced.
  const showDesignReference = (next: DesignReference | null) => {
    const previous = editor.designReference()
    if (next) editor.attachDesignReference(next)
    else editor.removeDesignReference()
    forgetWhatWasCopied()
    if (previous) releaseLoadedImage(previous)
  }

  // On unmount only — showing one releases the one it replaced. The editor is
  // remounted when a new capture arrives, which is what takes the design
  // reference off with the regions it was attached alongside.
  useEffect(
    () => () => {
      const attached = editor.designReference()
      if (attached) releaseLoadedImage(attached)
    },
    [editor],
  )

  /**
   * Where a pointer event landed, in capture pixels. The capture on screen may
   * be a shrunken copy of itself, so the offset into the drawn frame is divided
   * back out — everything past this point talks in the capture's own pixels,
   * which is what the regions and the report are measured in.
   */
  const pointOn = (event: React.PointerEvent<HTMLDivElement>): Point => {
    const frame = event.currentTarget.getBoundingClientRect()
    return {
      x: (event.clientX - frame.left) / scale,
      y: (event.clientY - frame.top) / scale,
    }
  }

  // Escape abandons the drag under way: a new region is dropped before it
  // exists, and a region being moved or resized goes back where it was — so a
  // drag started in the wrong place never has to be drawn and then deleted.
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      const current = gesture.current
      if (event.key !== 'Escape' || !current) return
      if (current.kind === 'draw') editor.cancelRegion()
      else editor.resizeRegion(current.regionId, current.from)
      gesture.current = null
    }

    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [editor])

  const beginGesture = (point: Point) => {
    const grab = grabAt(point, regions, scale)
    if (!grab) {
      gesture.current = { kind: 'draw' }
      editor.beginRegion(point)
      return
    }

    const from = regions.find((region) => region.id === grab.regionId)?.bounds
    if (!from) return
    gesture.current =
      grab.kind === 'move'
        ? { kind: 'move', regionId: grab.regionId, last: point, from }
        : { kind: 'resize', regionId: grab.regionId, handle: grab.handle, from }
  }

  const continueGesture = (point: Point) => {
    const current = gesture.current
    if (!current) {
      setCursor(cursorFor(grabAt(point, regions, scale)))
      return
    }

    if (current.kind === 'draw') {
      editor.updateRegion(point)
    } else if (current.kind === 'move') {
      // Told as a distance rather than a destination, so a region held against
      // the edge of the capture starts moving again the moment the pointer
      // comes back rather than catching up all at once.
      editor.moveRegion(current.regionId, {
        x: point.x - current.last.x,
        y: point.y - current.last.y,
      })
      current.last = point
    } else {
      editor.resizeRegion(
        current.regionId,
        resizedBounds(current.from, current.handle, point),
      )
    }
  }

  const endGesture = ({ cancelled }: { cancelled: boolean }) => {
    const current = gesture.current
    gesture.current = null
    if (current?.kind !== 'draw') return
    // The gesture was taken away rather than finished — drop the drag instead
    // of committing bounds the developer never released on.
    if (cancelled) editor.cancelRegion()
    else editor.commitRegion()
  }

  const copyImage = async () => {
    // Asked for before anything is asked *about*. The core builds no report
    // from an unmarked capture, and the clipboard is left holding whatever it
    // already had rather than a picture that complains about nothing.
    const report = editor.buildReport()
    if (!report) {
      setCopyState('empty')
      return
    }

    setCopyState('copying')
    try {
      await copyImageToClipboard(await rasterizeReport(report.plan))
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
  }

  /**
   * The other way of handing a report over: the same report, written to disk as
   * an image and copied to the clipboard as the text block naming it — so one
   * paste gives the coding agent the picture and the notes as words at once.
   */
  const writeImageAndCopyText = async () => {
    // Built once, so the image written and the text copied describe the same
    // regions rather than two reads of the editor a moment apart — and asked
    // for up front, so an unmarked capture is turned away before a file is
    // written for it.
    const report = editor.buildReport()
    if (!report) {
      setWriteState('empty')
      return
    }

    setWriteState('writing')
    try {
      const png = await rasterizeReport(report.plan)

      const body = new FormData()
      body.set('image', png, 'report.png')
      const { path } = await writeReportImage({ data: body })
      setWritten(path)

      try {
        await copyTextToClipboard(reportTextReferencing(report, path))
        setWriteState('copied')
      } catch {
        // The image is on disk whatever the clipboard did, and a developer who
        // knows where it went can still hand it over.
        setWriteState('uncopied')
      }
    } catch {
      setWriteState('failed')
    }
  }

  return (
    <main className="flex min-h-0 flex-1">
      <section className="flex min-w-0 flex-1 flex-col">
        {/* Both ways of handing a report over stay pressable with nothing
            marked up. A developer who presses one is told there is nothing to
            send, which says more than a button that quietly cannot be
            pressed. */}
        <div className="border-border/80 flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <Button size="sm" onClick={copyImage}>
            <StateIcon state={copyState} idle={<Copy />} />
            {COPY_LABEL[copyState]}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={writeImageAndCopyText}
            disabled={writeState === 'writing'}
          >
            {WRITE_LABEL[writeState]}
          </Button>

          <Separator orientation="vertical" className="mx-1 h-5" />

          <ClearCaptureButton onClear={onClear} />

          <div className="ml-auto flex items-center gap-1">
            <span className="text-muted-foreground w-12 text-right text-xs tabular-nums">
              {Math.round(scale * 100)}%
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground"
              // Only worth offering once the capture is actually being shrunk —
              // a capture that already fits is at 100% either way.
              disabled={fits === 1}
              onClick={() => setZoom(zoom === 'fit' ? 'actual' : 'fit')}
            >
              {zoom === 'fit' ? <Maximize2 /> : <Minimize2 />}
              {zoom === 'fit' ? 'Actual size' : 'Fit'}
            </Button>
          </div>
        </div>

        {/* The stage is a fixed part of the layout and the capture is drawn
            inside it, so an oversized image scrolls or shrinks rather than
            pushing the panels around it off screen. */}
        <div
          ref={stageRef}
          className={cn(
            'stage-surface scrollbar-slim relative grid min-h-0 flex-1 p-6',
            zoom === 'fit' ? 'overflow-hidden' : 'overflow-auto',
          )}
        >
          <div
            className="ring-border relative m-auto shadow-2xl ring-1 touch-none select-none"
            style={{
              width: drawn.width,
              height: drawn.height,
              cursor,
              // Until the stage has been measured there is no honest scale to
              // draw at, and drawing at the wrong one first is a flash of a
              // capture jumping size.
              visibility: stageSize ? 'visible' : 'hidden',
            }}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId)
              forgetWhatWasCopied()
              beginGesture(pointOn(event))
            }}
            onPointerMove={(event) => continueGesture(pointOn(event))}
            onPointerUp={() => endGesture({ cancelled: false })}
            onPointerCancel={() => endGesture({ cancelled: true })}
          >
            <img
              src={capture.src}
              alt="Implementation capture"
              width={drawn.width}
              height={drawn.height}
              draggable={false}
              className="pointer-events-none block"
            />
            {regions.map((region) => (
              <RegionOutline
                key={region.id}
                region={region}
                scale={scale}
                committed
              />
            ))}
            {draft ? (
              <RegionOutline region={draft} scale={scale} committed={false} />
            ) : null}
          </div>
        </div>

        {/* What to do, and where the last image went — the two things that are
            true of the whole screen rather than of one panel. The written path
            says only what stays true, so it can be left up while the marking-up
            goes on. */}
        <div className="border-border/80 text-muted-foreground flex h-9 shrink-0 items-center gap-4 border-t px-4 text-xs">
          <p className="truncate">
            {regions.length === 0
              ? 'Drag a rectangle over what is wrong. Escape abandons a drag.'
              : 'Drag a region by its outline to move it, or by a handle to resize it.'}
          </p>

          {written ? (
            <p className="ml-auto flex min-w-0 items-center gap-1.5">
              {writeState === 'uncopied' ? (
                <TriangleAlert className="text-destructive size-3.5 shrink-0" />
              ) : null}
              <span className="shrink-0">
                {writeState === 'uncopied'
                  ? 'Text not copied. Image written to'
                  : 'Image written to'}
              </span>
              <code className="text-foreground truncate font-mono" title={written}>
                {written}
              </code>
            </p>
          ) : null}
        </div>
      </section>

      <aside className="border-border/80 scrollbar-slim flex w-[360px] shrink-0 flex-col divide-y overflow-y-auto border-l">
        <DesignReferencePanel
          designReference={designReference}
          onAttach={async (image) =>
            showDesignReference(await loadImageFile(image))
          }
          onRemove={() => showDesignReference(null)}
        />

        <NotePanel
          regions={regions}
          onNoteChange={(regionId, note) => {
            // The copied text block *is* the notes, so a keystroke after
            // copying makes it stale. Copy Image is left saying exactly what it
            // said before this button existed.
            setWriteState('idle')
            editor.annotate(regionId, note)
          }}
          onDelete={(regionId) => {
            forgetWhatWasCopied()
            editor.removeRegion(regionId)
          }}
        />
      </aside>
    </main>
  )
}

/**
 * The content box of an element, as it changes. Used for the stage, which is
 * whatever the window leaves over once the chrome around it has been laid out
 * — so how much of the capture fits is a question only the browser can answer.
 *
 * Null until it has been measured, which on the server is forever.
 */
function useMeasuredSize<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState<Size | null>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize({ width, height })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return [ref, size] as const
}

/** The icon that says how the last press went, or nothing much yet. */
function StateIcon({
  state,
  idle,
}: {
  state: CopyState
  idle: React.ReactNode
}) {
  if (state === 'copied') return <Check />
  if (state === 'failed' || state === 'empty') return <TriangleAlert />
  return idle
}

/**
 * Finishing with one screen and starting on the next. Clearing throws away the
 * whole capture — its design reference, every region and every note — and none
 * of it is written down anywhere, so it is asked about first.
 *
 * The confirmation is unconditional. Working out whether there is anything
 * worth losing would mean sometimes asking and sometimes not, and a
 * destructive button that only sometimes stops to ask is one a developer
 * learns to click through.
 */
function ClearCaptureButton({ onClear }: { onClear: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground hover:text-destructive"
          />
        }
      >
        <Trash2 />
        Clear
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle>Clear this capture?</AlertDialogTitle>
        <AlertDialogDescription>
          This discards the implementation capture, its design reference, and
          every region and note drawn on it. Nothing is saved anywhere, so there
          is no getting it back.
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep marking up</AlertDialogCancel>
          <AlertDialogAction onClick={onClear}>Clear</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/**
 * The rectangle and its label. The note itself isn't drawn here — on screen it
 * lives in the panel where it is written, and only the copied image has to
 * carry it as pixels.
 *
 * A region is stored in capture pixels and drawn in screen pixels: the bounds
 * are scaled, the stroke and the handles are not. A handle that shrank with an
 * oversized capture would be a two-pixel target, and an outline that thinned
 * with it would disappear — both are the tool showing itself, not part of the
 * report, and the report is rasterized from the bounds rather than from this.
 */
function RegionOutline({
  region,
  scale,
  committed,
}: {
  region: Region
  /** The fraction of natural size the capture is drawn at. */
  scale: number
  /** Only a committed region can be taken hold of, so only it shows handles. */
  committed: boolean
}) {
  const drawn = {
    x: region.bounds.x * scale,
    y: region.bounds.y * scale,
    width: region.bounds.width * scale,
    height: region.bounds.height * scale,
  }
  const labelAbove = labelSitsAbove(drawn.y, LABEL_NUMBER_SIZE)

  return (
    <div
      data-slot="region-outline"
      // Styled from the shared constants rather than Tailwind classes, so the
      // canvas adapter cannot drift from what is on screen.
      className="pointer-events-none absolute box-border"
      style={{
        left: drawn.x,
        top: drawn.y,
        width: drawn.width,
        height: drawn.height,
        border: `${REGION_STROKE_WIDTH}px solid ${REGION_STROKE}`,
      }}
    >
      <RegionLabel
        number={region.number}
        className="absolute shadow-sm"
        style={{
          // Flush with the rectangle's left edge, where the canvas puts it.
          left: 0,
          [labelAbove ? 'bottom' : 'top']: `calc(100% + ${LABEL_GAP}px)`,
        }}
      />
      {committed
        ? RESIZE_HANDLES.map((handle) => (
            <RegionHandle key={handle} bounds={drawn} handle={handle} />
          ))
        : null}
    </div>
  )
}

/**
 * Shows where a region can be pulled from. Drawn only — which handle a press
 * actually took hold of is worked out from the pointer's position, so a handle
 * stays grabbable right up against the edge of the capture.
 */
function RegionHandle({
  bounds,
  handle,
}: {
  /** The rectangle as drawn on screen, not as stored. */
  bounds: Bounds
  handle: ResizeHandle
}) {
  const center = handleCenter(
    { x: 0, y: 0, width: bounds.width, height: bounds.height },
    handle,
  )

  return (
    <span
      data-slot="region-handle"
      className="pointer-events-none absolute rounded-xs shadow-sm"
      style={{
        // The outline's border sits inside its bounds, so these offsets are
        // measured from inside it — pull them back out onto the drawn edge.
        left: center.x - REGION_STROKE_WIDTH,
        top: center.y - REGION_STROKE_WIDTH,
        width: HANDLE_SIZE,
        height: HANDLE_SIZE,
        transform: 'translate(-50%, -50%)',
        background: REGION_STROKE,
        border: `1px solid ${HANDLE_BORDER}`,
      }}
    />
  )
}

/**
 * What a region is called, wherever it is named — on the capture and again
 * beside the note written against it.
 */
function RegionLabel({
  number,
  className,
  style,
}: {
  number: number
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <span
      data-slot="region-label"
      className={cn(
        'flex items-center justify-center rounded px-1.5 text-xs font-semibold',
        className,
      )}
      style={{
        height: LABEL_NUMBER_SIZE,
        minWidth: LABEL_NUMBER_SIZE,
        background: LABEL_BACKGROUND,
        color: LABEL_TEXT_COLOR,
        ...style,
      }}
    >
      {number}
    </span>
  )
}

function NotePanel({
  regions,
  onNoteChange,
  onDelete,
}: {
  regions: Region[]
  onNoteChange: (regionId: string, note: string) => void
  onDelete: (regionId: string) => void
}) {
  return (
    <section className="flex flex-col gap-3 p-4">
      <PanelHeading count={regions.length}>Divergences</PanelHeading>

      {regions.length === 0 ? (
        <p className="text-muted-foreground text-[13px] leading-relaxed">
          Nothing marked yet. Each region you draw gets a note here.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {regions.map((region) => (
            <li
              key={region.id}
              className="group border-border/80 bg-card focus-within:border-ring/60 flex flex-col gap-1.5 rounded-lg border p-2.5 transition-colors"
            >
              <div className="flex items-center gap-2">
                <RegionLabel number={region.number} />
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive ml-auto size-6 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100"
                  aria-label={`Delete region ${region.number}`}
                  onClick={() => onDelete(region.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>

              <Textarea
                value={region.note}
                onChange={(event) => onNoteChange(region.id, event.target.value)}
                placeholder="What is wrong here?"
                aria-label={`Note for region ${region.number}`}
                rows={2}
                className="min-h-0 resize-none border-0 bg-transparent p-0 text-[13px] leading-relaxed shadow-none focus-visible:ring-0"
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
