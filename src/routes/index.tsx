import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'

import { loadImageFile, releaseLoadedImage } from '#/adapters/image'
import {
  NO_IMAGE_MESSAGE,
  UNREADABLE_IMAGE_MESSAGE,
  carriesFiles,
  imageFromTransfer,
} from '#/adapters/transfer'
import { CaptureEditor } from '#/components/capture-editor'
import { TAKES_IMAGES_ATTRIBUTE } from '#/components/design-reference-panel'
import type { Capture } from '#/editor/types'

export const Route = createFileRoute('/')({ component: Home })

function isTypingTarget(target: EventTarget | null): boolean {
  if (target instanceof HTMLInputElement) return true
  if (target instanceof HTMLTextAreaElement) return true
  return target instanceof HTMLElement && target.isContentEditable
}

/**
 * Whether a paste or a drop was aimed at something other than the capture:
 * somewhere the developer is typing — notes are text fields — or the design
 * reference, which takes images of its own. Replacing the capture throws away
 * every region and note drawn against it, so it only happens when the image
 * was meant for it.
 */
function aimedElsewhere(target: EventTarget | null): boolean {
  if (isTypingTarget(target)) return true
  return (
    target instanceof HTMLElement &&
    target.closest(`[${TAKES_IMAGES_ATTRIBUTE}]`) !== null
  )
}

function Home() {
  const [capture, setCapture] = useState<Capture | null>(null)
  const [captureError, setCaptureError] = useState<string | null>(null)
  const previous = useRef<Capture | null>(null)

  // Both ways an image arrives end here: a paste and a drop carry the same
  // thing, and either one replaces the capture.
  const takeCapture = async (transfer: DataTransfer | null) => {
    const image = imageFromTransfer(transfer)
    if (!image) {
      setCaptureError(NO_IMAGE_MESSAGE)
      return
    }
    try {
      const next = await loadImageFile(image)
      if (previous.current) releaseLoadedImage(previous.current)
      previous.current = next
      setCaptureError(null)
      setCapture(next)
    } catch {
      setCaptureError(UNREADABLE_IMAGE_MESSAGE)
    }
  }

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (aimedElsewhere(event.target)) return
      event.preventDefault()
      void takeCapture(event.clipboardData)
    }

    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [])

  // Only on unmount — taking a capture releases the one it replaces.
  useEffect(() => () => {
    if (previous.current) releaseLoadedImage(previous.current)
  }, [])

  return (
    // A file dropped anywhere but the design reference is a capture — the page
    // is one big target, so an image dragged out of a folder has somewhere to
    // land. Files only: text dragged into a note is the browser's to handle.
    <main
      className="flex flex-col items-start gap-6 p-8"
      onDragOver={(event) => {
        if (aimedElsewhere(event.target) || !carriesFiles(event.dataTransfer)) {
          return
        }
        event.preventDefault()
      }}
      onDrop={(event) => {
        if (aimedElsewhere(event.target)) return
        event.preventDefault()
        void takeCapture(event.dataTransfer)
      }}
    >
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">
          UI Divergence Feedback
        </h1>
        <p className="text-muted-foreground">
          Paste an implementation capture, drag a rectangle over what is wrong,
          and hand the annotated report to your coding agent — as an image on
          your clipboard, or as a written image and the text block naming it.
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
