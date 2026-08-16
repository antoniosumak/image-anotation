import { Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { rasterizeReport } from '#/adapters/canvas'
import { copyImageToClipboard, copyTextToClipboard } from '#/adapters/clipboard'
import { writeReportImage } from '#/adapters/filesystem'
import { loadImageFile, releaseLoadedImage } from '#/adapters/image'
import { DesignReferencePanel } from '#/components/design-reference-panel'
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
import { Button } from '#/components/ui/button'
import { Textarea } from '#/components/ui/textarea'
import { createEditor, reportTextReferencing } from '#/editor/createEditor'
import type {
  Bounds,
  Capture,
  DesignReference,
  Point,
  Region,
} from '#/editor/types'
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
 * holds no state of its own: every rectangle on screen came out of the core.
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
  const gesture = useRef<Gesture | null>(null)

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

  const pointOn = (event: React.PointerEvent<HTMLDivElement>) => {
    const surface = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - surface.left, y: event.clientY - surface.top }
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
    const grab = grabAt(point, regions)
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
      setCursor(cursorFor(grabAt(point, regions)))
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
    <div className="flex flex-col items-start gap-4">
      <div className="flex flex-col items-start gap-2">
        {/* Both export buttons stay pressable with nothing marked up. A
            developer who presses one is told there is nothing to send, which
            says more than a button that quietly cannot be pressed. */}
        <div className="flex items-center gap-3">
          <Button onClick={copyImage}>{COPY_LABEL[copyState]}</Button>
          <Button
            variant="secondary"
            onClick={writeImageAndCopyText}
            disabled={writeState === 'writing'}
          >
            {WRITE_LABEL[writeState]}
          </Button>
          <ClearCaptureButton onClear={onClear} />
          <p className="text-muted-foreground text-sm">
            {regions.length === 0
              ? 'Drag a rectangle over what is wrong. Escape abandons a drag.'
              : 'Drag another rectangle for each divergence, and say what is wrong beside it. Drag a region by its outline to move it, or by a handle to resize it.'}
          </p>
        </div>

        {/* Where the image went, so the developer can find it — and so the path
            in the copied text block can be recognised as theirs. It says only
            what stays true, so it can be left up while the marking-up goes on. */}
        {written ? (
          <p className="text-muted-foreground text-sm">
            {writeState === 'uncopied'
              ? 'The text block could not be copied. Image written to '
              : 'Image written to '}
            <code className="font-mono">{written}</code>
          </p>
        ) : null}
      </div>

      <div className="flex items-start gap-6">
        {/* Sized to the capture's natural pixels — never scaled, so small
            spacing errors stay judgeable and pointer coordinates map 1:1. The
            ring is a shadow, not a border, so it marks the capture's edges
            without taking up layout and shifting those pixels. */}
        <div
          className="ring-border relative shrink-0 ring-1 touch-none select-none"
          style={{ width: capture.width, height: capture.height, cursor }}
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
            width={capture.width}
            height={capture.height}
            draggable={false}
            className="pointer-events-none block"
          />
          {regions.map((region) => (
            <RegionOutline key={region.id} region={region} committed />
          ))}
          {draft ? <RegionOutline region={draft} committed={false} /> : null}
        </div>

        <DesignReferencePanel
          designReference={designReference}
          onAttach={async (image) => showDesignReference(await loadImageFile(image))}
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
      </div>
    </div>
  )
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
      <AlertDialogTrigger render={<Button variant="ghost" />}>
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
 */
function RegionOutline({
  region,
  committed,
}: {
  region: Region
  /** Only a committed region can be taken hold of, so only it shows handles. */
  committed: boolean
}) {
  const { bounds } = region
  const labelAbove = labelSitsAbove(bounds.y, LABEL_NUMBER_SIZE)

  return (
    <div
      data-slot="region-outline"
      // Styled from the shared constants rather than Tailwind classes, so the
      // canvas adapter cannot drift from what is on screen.
      className="pointer-events-none absolute box-border"
      style={{
        left: bounds.x,
        top: bounds.y,
        width: bounds.width,
        height: bounds.height,
        border: `${REGION_STROKE_WIDTH}px solid ${REGION_STROKE}`,
      }}
    >
      <RegionLabel
        number={region.number}
        className="absolute"
        style={{
          // Flush with the rectangle's left edge, where the canvas puts it.
          left: 0,
          [labelAbove ? 'bottom' : 'top']: `calc(100% + ${LABEL_GAP}px)`,
        }}
      />
      {committed
        ? RESIZE_HANDLES.map((handle) => (
            <RegionHandle key={handle} bounds={bounds} handle={handle} />
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
      className="pointer-events-none absolute rounded-xs border border-white"
      style={{
        // The outline's border sits inside its bounds, so these offsets are
        // measured from inside it — pull them back out onto the drawn edge.
        left: center.x - REGION_STROKE_WIDTH,
        top: center.y - REGION_STROKE_WIDTH,
        width: HANDLE_SIZE,
        height: HANDLE_SIZE,
        transform: 'translate(-50%, -50%)',
        background: REGION_STROKE,
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
    <section className="flex w-72 shrink-0 flex-col gap-3">
      <h2 className="text-sm font-medium">Divergences</h2>

      {regions.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Nothing marked yet. Each region you draw gets a note here.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {regions.map((region) => (
            <li key={region.id} className="flex items-start gap-2">
              <RegionLabel number={region.number} className="mt-1.5" />
              <Textarea
                value={region.note}
                onChange={(event) => onNoteChange(region.id, event.target.value)}
                placeholder="What is wrong here?"
                aria-label={`Note for region ${region.number}`}
                rows={2}
              />
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive mt-0.5"
                aria-label={`Delete region ${region.number}`}
                onClick={() => onDelete(region.id)}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
