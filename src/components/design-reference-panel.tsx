import { useState } from 'react'

import {
  NO_IMAGE_MESSAGE,
  UNREADABLE_IMAGE_MESSAGE,
  imageFromTransfer,
} from '#/adapters/transfer'
import { Button } from '#/components/ui/button'
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
      className={cn(
        'flex w-96 shrink-0 flex-col gap-3',
        dragging && 'cursor-copy',
      )}
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
      <h2 className="text-sm font-medium">Design reference</h2>

      {/* Focusable, because a paste goes to whatever has focus: clicking here
          is how the developer says this paste is a design reference rather
          than a new capture. Dropping needs no such aiming. */}
      <div
        tabIndex={0}
        aria-label="Design reference — paste or drop an image"
        className={cn(
          'focus-visible:border-ring focus-visible:ring-ring/50 rounded-lg border border-dashed p-2 outline-none focus-visible:ring-[3px]',
          dragging && 'border-ring bg-accent',
          !designReference && 'text-muted-foreground p-6 text-center text-sm',
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
            className="block h-auto max-w-full"
          />
        ) : (
          <p>
            Drop the intended design here, or click and press{' '}
            <kbd className="font-mono">Ctrl/Cmd + V</kbd>. Optional — everything
            works without one.
          </p>
        )}
      </div>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      {designReference ? (
        <div className="flex items-start justify-between gap-2">
          <p className="text-muted-foreground text-sm">
            {designReference.width} × {designReference.height}, carried into the
            report at that size. Drop or paste another to replace it.
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive -mt-1"
            onClick={() => {
              setError(null)
              onRemove()
            }}
          >
            Remove
          </Button>
        </div>
      ) : null}
    </section>
  )
}
