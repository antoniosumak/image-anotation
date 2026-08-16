import { Button } from '@plerivo/ui/button'
import { ImagePlus, X } from 'lucide-react'
import { useState } from 'react'

import {
  NO_IMAGE_MESSAGE,
  UNREADABLE_IMAGE_MESSAGE,
  imageFromTransfer,
} from '#/adapters/transfer'
import { PanelHeading } from '#/components/panel-heading'
import type { DesignReference } from '#/editor/types'
import { cn } from '#/lib/utils'

/**
 * Marks a part of the page that takes images of its own, so the page-wide
 * handlers — which replace the capture, discarding every region and note drawn
 * against it — know an image dropped or pasted here was not meant for them.
 */
export const TAKES_IMAGES_ATTRIBUTE = 'data-takes-images'

/**
 * The design reference beside the capture: what the screen was meant to look
 * like, so the coding agent sees both sides of a divergence.
 *
 * Optional throughout. With none attached this is a drop zone and nothing
 * else — no region, note or report waits on it.
 */
export function DesignReferencePanel({
  designReference,
  onAttach,
  onRemove,
}: {
  designReference: DesignReference | null
  /** Rejects when the image could not be read, so this can say so. */
  onAttach: (image: Blob) => Promise<void>
  onRemove: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const take = async (transfer: DataTransfer | null) => {
    const image = imageFromTransfer(transfer)
    if (!image) {
      setError(NO_IMAGE_MESSAGE)
      return
    }
    try {
      await onAttach(image)
      setError(null)
    } catch {
      setError(UNREADABLE_IMAGE_MESSAGE)
    }
  }

  return (
    // The whole panel takes the drop, not just the dashed box inside it: a
    // drop that lands on the heading or the caption was still aimed here, and
    // falling through to the page would replace the capture and take every
    // region with it.
    <section
      {...{ [TAKES_IMAGES_ATTRIBUTE]: '' }}
      className={cn('flex flex-col gap-3 p-4', dragging && 'cursor-copy')}
      onDragOver={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(false)
        void take(event.dataTransfer)
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <PanelHeading>Design reference</PanelHeading>

        {designReference ? (
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive -my-1 size-6"
            aria-label="Remove design reference"
            onClick={() => {
              setError(null)
              onRemove()
            }}
          >
            <X className="size-3.5" />
          </Button>
        ) : null}
      </div>

      {/* Focusable, because a paste goes to whatever has focus: clicking here
          is how the developer says this paste is a design reference rather
          than a new capture. Dropping needs no such aiming. */}
      <div
        tabIndex={0}
        aria-label="Design reference — paste or drop an image"
        data-dragging={dragging ? '' : undefined}
        className={cn(
          'drop-target focus-visible:ring-ring/50 rounded-lg border border-dashed outline-none transition-colors focus-visible:ring-[3px]',
          designReference ? 'bg-card p-1.5' : 'p-6',
          dragging && 'bg-accent',
        )}
        onPaste={(event) => {
          event.preventDefault()
          void take(event.clipboardData)
        }}
      >
        {designReference ? (
          // Scaled to the column on screen, where it is something to look at
          // while marking up. The report carries it at full size.
          <img
            src={designReference.src}
            alt="Design reference"
            className="block h-auto max-w-full rounded"
          />
        ) : (
          <div className="text-muted-foreground flex flex-col items-center gap-2.5 text-center">
            <ImagePlus className="size-4" />
            <p className="text-[13px] leading-relaxed">
              Drop the intended design here, or click and paste. Optional —
              everything works without one.
            </p>
          </div>
        )}
      </div>

      {error ? <p className="text-destructive text-[13px]">{error}</p> : null}

      {designReference ? (
        <p className="text-muted-foreground text-xs">
          <span className="tabular-nums">
            {designReference.width} × {designReference.height}
          </span>
          , carried into the report at that size. Drop or paste another to
          replace it.
        </p>
      ) : null}
    </section>
  )
}
