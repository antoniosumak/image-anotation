import { useState } from 'react'

import { imageFromTransfer } from '#/adapters/transfer'
import { Button } from '#/components/ui/button'
import type { DesignReference } from '#/editor/types'
import { cn } from '#/lib/utils'

/**
 * Marks the elements that take an image of their own, so the page-wide paste
 * handler — which replaces the capture — knows a paste was not aimed at it.
 */
export const IMAGE_TARGET_ATTRIBUTE = 'data-image-target'

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
      setError('That carried no image.')
      return
    }
    try {
      await onAttach(image)
      setError(null)
    } catch {
      setError('That image could not be read.')
    }
  }

  return (
    <section className="flex w-96 shrink-0 flex-col gap-3">
      <h2 className="text-sm font-medium">Design reference</h2>

      {/* Focusable, because a paste goes to whatever has focus: clicking here
          is how the developer says this paste is a design reference rather
          than a new capture. Dropping needs no such aiming. */}
      <div
        {...{ [IMAGE_TARGET_ATTRIBUTE]: '' }}
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
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          // The page takes a drop as a new capture; this one was aimed here.
          event.stopPropagation()
          setDragging(false)
          void take(event.dataTransfer)
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
