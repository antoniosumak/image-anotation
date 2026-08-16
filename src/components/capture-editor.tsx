import { useState, useSyncExternalStore } from 'react'

import { rasterizeReport } from '#/adapters/canvas'
import { copyImageToClipboard } from '#/adapters/clipboard'
import { Button } from '#/components/ui/button'
import { createEditor } from '#/editor/createEditor'
import type { Bounds, Capture } from '#/editor/types'
import { REGION_STROKE, REGION_STROKE_WIDTH } from '#/lib/region-style'

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
            : 'Drag again to replace the region. Paste another capture to start over.'}
        </p>
      </div>

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
          <RegionOutline key={region.id} bounds={region.bounds} />
        ))}
        {draft ? <RegionOutline bounds={draft.bounds} /> : null}
      </div>
    </div>
  )
}

function RegionOutline({ bounds }: { bounds: Bounds }) {
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
    />
  )
}
