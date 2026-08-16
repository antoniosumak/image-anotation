import { useState, useSyncExternalStore } from 'react'

import { rasterizeReport } from '#/adapters/canvas'
import { copyImageToClipboard } from '#/adapters/clipboard'
import { Button } from '#/components/ui/button'
import { Textarea } from '#/components/ui/textarea'
import { createEditor } from '#/editor/createEditor'
import type { Capture, Region } from '#/editor/types'
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

type CopyState = 'idle' | 'copying' | 'copied' | 'failed'

const COPY_LABEL: Record<CopyState, string> = {
  idle: 'Copy Image',
  copying: 'Copying…',
  copied: 'Copied',
  failed: 'Copy failed — try again',
}

/**
 * Drives the editor core from pointer events and draws what it reports. It
 * holds no state of its own: every rectangle on screen came out of the core.
 */
export function CaptureEditor({ capture }: { capture: Capture }) {
  const [editor] = useState(() => createEditor(capture))
  const [copyState, setCopyState] = useState<CopyState>('idle')

  const { regions, draft } = useSyncExternalStore(
    editor.subscribe,
    editor.getState,
    editor.getState,
  )

  const pointOn = (event: React.PointerEvent<HTMLDivElement>) => {
    const surface = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - surface.left, y: event.clientY - surface.top }
  }

  const copyImage = async () => {
    setCopyState('copying')
    try {
      const { plan } = editor.buildReport()
      await copyImageToClipboard(await rasterizeReport(plan))
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
  }

  return (
    <div className="flex flex-col items-start gap-4">
      <div className="flex items-center gap-3">
        <Button onClick={copyImage} disabled={regions.length === 0}>
          {COPY_LABEL[copyState]}
        </Button>
        <p className="text-muted-foreground text-sm">
          {regions.length === 0
            ? 'Drag a rectangle over what is wrong.'
            : 'Drag another rectangle for each divergence, and say what is wrong beside it.'}
        </p>
      </div>

      <div className="flex items-start gap-6">
        {/* Sized to the capture's natural pixels — never scaled, so small
            spacing errors stay judgeable and pointer coordinates map 1:1. The
            ring is a shadow, not a border, so it marks the capture's edges
            without taking up layout and shifting those pixels. */}
        <div
          className="ring-border relative shrink-0 cursor-crosshair ring-1 touch-none select-none"
          style={{ width: capture.width, height: capture.height }}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId)
            setCopyState('idle')
            editor.beginRegion(pointOn(event))
          }}
          onPointerMove={(event) => editor.updateRegion(pointOn(event))}
          onPointerUp={() => editor.commitRegion()}
          // The gesture was taken away rather than finished — drop the drag
          // instead of committing bounds the developer never released on.
          onPointerCancel={() => editor.cancelRegion()}
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
            <RegionOutline key={region.id} region={region} />
          ))}
          {draft ? <RegionOutline region={draft} /> : null}
        </div>

        <NotePanel
          regions={regions}
          onNoteChange={(regionId, note) => editor.annotate(regionId, note)}
        />
      </div>
    </div>
  )
}

/**
 * The rectangle and its label. The note itself isn't drawn here — on screen it
 * lives in the panel where it is written, and only the copied image has to
 * carry it as pixels.
 */
function RegionOutline({ region }: { region: Region }) {
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
    </div>
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
}: {
  regions: Region[]
  onNoteChange: (regionId: string, note: string) => void
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
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
