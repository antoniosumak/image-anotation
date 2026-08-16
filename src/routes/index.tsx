import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'

import { loadImageFile, releaseLoadedImage } from '#/adapters/image'
import { imageFromTransfer } from '#/adapters/transfer'
import { CaptureEditor } from '#/components/capture-editor'
import { IMAGE_TARGET_ATTRIBUTE } from '#/components/design-reference-panel'
import type { Capture } from '#/editor/types'

export const Route = createFileRoute('/')({ component: Home })

function isTypingTarget(target: EventTarget | null): boolean {
  if (target instanceof HTMLInputElement) return true
  if (target instanceof HTMLTextAreaElement) return true
  return target instanceof HTMLElement && target.isContentEditable
}

/**
 * Whether a paste was aimed at something other than the capture. Somewhere the
 * developer is typing — notes are text fields — or the design reference, which
 * takes images of its own. Replacing the capture throws away every region and
 * note drawn against it, so it only happens when the paste was meant for it.
 */
function aimedElsewhere(target: EventTarget | null): boolean {
  if (isTypingTarget(target)) return true
  return (
    target instanceof HTMLElement &&
    target.closest(`[${IMAGE_TARGET_ATTRIBUTE}]`) !== null
  )
}

function Home() {
  const [capture, setCapture] = useState<Capture | null>(null)
  const [captureError, setCaptureError] = useState<string | null>(null)
  const previous = useRef<Capture | null>(null)

  // Both ways an image arrives end here: a paste and a drop carry the same
  // thing, and either one replaces the capture.
  const takeCapture = async (image: Blob) => {
    try {
      const next = await loadImageFile(image)
      if (previous.current) releaseLoadedImage(previous.current)
      previous.current = next
      setCaptureError(null)
      setCapture(next)
    } catch {
      setCaptureError('That image could not be read.')
    }
  }

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (aimedElsewhere(event.target)) return

      const image = imageFromTransfer(event.clipboardData)
      if (!image) {
        setCaptureError('That paste carried no image.')
        return
      }

      event.preventDefault()
      void takeCapture(image)
    }

    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [])

  // Only on unmount — taking a capture releases the one it replaces.
  useEffect(() => () => {
    if (previous.current) releaseLoadedImage(previous.current)
  }, [])

  return (
    // A drop anywhere but the design reference is a capture — the page is one
    // big target, so a file dragged out of a folder has somewhere to land.
    <main
      className="flex flex-col items-start gap-6 p-8"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault()
        const image = imageFromTransfer(event.dataTransfer)
        if (!image) {
          setCaptureError('That carried no image.')
          return
        }
        void takeCapture(image)
      }}
    >
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">
          UI Divergence Feedback
        </h1>
        <p className="text-muted-foreground">
          Paste an implementation capture, drag a rectangle over what is wrong,
          and copy the annotated image for your coding agent.
        </p>
      </header>

      {captureError ? (
        <p className="text-destructive text-sm">{captureError}</p>
      ) : null}

      {capture ? (
        <CaptureEditor key={capture.src} capture={capture} />
      ) : (
        <div className="text-muted-foreground flex h-64 w-full max-w-2xl items-center justify-center rounded-lg border border-dashed">
          Press <kbd className="mx-1 font-mono">Ctrl/Cmd + V</kbd> to paste a
          capture, or drop an image anywhere on the page.
        </div>
      )}
    </main>
  )
}
