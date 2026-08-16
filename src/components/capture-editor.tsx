import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { rasterizeReport } from '#/adapters/canvas'
import { copyImageToClipboard } from '#/adapters/clipboard'
import { Button } from '#/components/ui/button'
import { Textarea } from '#/components/ui/textarea'
import { createEditor } from '#/editor/createEditor'
import type { Capture, Region } from '#/editor/types'
import {
  LABEL_BACKGROUND,
  LABEL_GAP,
  LABEL_TEXT_COLOR,
  REGION_STROKE,
  REGION_STROKE_WIDTH,
  labelSitsAbove,
} from '#/lib/region-style'

type CopyState = 'idle' | 'copying' | 'copied' | 'failed'

const COPY_LABEL: Record<CopyState, string> = {
  idle: 'Copy Image',
  copying: 'Copying…',
  copied: 'Copied',
  failed: 'Copy failed — try again',
}

/** Height of the on-screen number badge, and the room it needs above a region. */
const BADGE_SIZE = 20

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

  // A region says where; the note says what — so a freshly drawn one puts the
  // cursor straight into its note rather than making the developer aim at it.
  const noteFields = useRef(new Map<string, HTMLTextAreaElement | null>())
  const newestRegionId = regions.at(-1)?.id
  useEffect(() => {
    if (newestRegionId) noteFields.current.get(newestRegionId)?.focus()
  }, [newestRegionId])

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
          fieldRefs={noteFields}
        />
      </div>
    </div>
  )
}

/**
 * The rectangle and its number. The note itself isn't drawn here — on screen
 * it lives in the panel where it is written, and only the copied image has to
 * carry it as pixels.
 */
function RegionOutline({ region }: { region: Region }) {
  const { bounds } = region
  const badgeAbove = labelSitsAbove(bounds.y, BADGE_SIZE)

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
      <span
        data-slot="region-number"
        className="absolute flex items-center justify-center rounded px-1.5 text-xs font-semibold"
        style={{
          height: BADGE_SIZE,
          minWidth: BADGE_SIZE,
          left: -REGION_STROKE_WIDTH,
          [badgeAbove ? 'bottom' : 'top']: `calc(100% + ${LABEL_GAP}px)`,
          background: LABEL_BACKGROUND,
          color: LABEL_TEXT_COLOR,
        }}
      >
        {region.number}
      </span>
    </div>
  )
}

function NotePanel({
  regions,
  onNoteChange,
  fieldRefs,
}: {
  regions: Region[]
  onNoteChange: (regionId: string, note: string) => void
  fieldRefs: React.RefObject<Map<string, HTMLTextAreaElement | null>>
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
              <span
                className="mt-1.5 flex items-center justify-center rounded px-1.5 text-xs font-semibold"
                style={{
                  height: BADGE_SIZE,
                  minWidth: BADGE_SIZE,
                  background: LABEL_BACKGROUND,
                  color: LABEL_TEXT_COLOR,
                }}
              >
                {region.number}
              </span>
              <Textarea
                ref={(field) => {
                  if (field) fieldRefs.current.set(region.id, field)
                  else fieldRefs.current.delete(region.id)
                }}
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
