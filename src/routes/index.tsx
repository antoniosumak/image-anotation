import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'

import { imageFromPaste } from '#/adapters/clipboard'
import { loadCapture, releaseCapture } from '#/adapters/image'
import { CaptureEditor } from '#/components/capture-editor'
import type { Capture } from '#/editor/types'

export const Route = createFileRoute('/')({ component: Home })

function isTypingTarget(target: EventTarget | null): boolean {
  if (target instanceof HTMLInputElement) return true
  if (target instanceof HTMLTextAreaElement) return true
  return target instanceof HTMLElement && target.isContentEditable
}

function Home() {
  const [capture, setCapture] = useState<Capture | null>(null)
  const [pasteError, setPasteError] = useState<string | null>(null)
  const previous = useRef<Capture | null>(null)

  useEffect(() => {
    const onPaste = async (event: ClipboardEvent) => {
      // An image is always a capture — writing a note leaves the cursor in a
      // text field, and pasting a picture into one meant nothing anyway. A
      // paste of anything else aimed at somewhere the developer is typing is
      // theirs to keep.
      const image = imageFromPaste(event.clipboardData)
      if (!image) {
        if (isTypingTarget(event.target)) return
        setPasteError('That paste carried no image.')
        return
      }

      event.preventDefault()
      try {
        const next = await loadCapture(image)
        if (previous.current) releaseCapture(previous.current)
        previous.current = next
        setPasteError(null)
        setCapture(next)
      } catch {
        setPasteError('That image could not be read.')
      }
    }

    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [])

  // Only on unmount — the paste handler releases each capture it replaces.
  useEffect(() => () => {
    if (previous.current) releaseCapture(previous.current)
  }, [])

  return (
    <main className="flex flex-col items-start gap-6 p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">
          UI Divergence Feedback
        </h1>
        <p className="text-muted-foreground">
          Paste an implementation capture, drag a rectangle over what is wrong,
          and copy the annotated image for your coding agent.
        </p>
      </header>

      {pasteError ? (
        <p className="text-destructive text-sm">{pasteError}</p>
      ) : null}

      {capture ? (
        <CaptureEditor key={capture.src} capture={capture} />
      ) : (
        <div className="text-muted-foreground flex h-64 w-full max-w-2xl items-center justify-center rounded-lg border border-dashed">
          Press <kbd className="mx-1 font-mono">Ctrl/Cmd + V</kbd> to paste a
          capture.
        </div>
      )}
    </main>
  )
}
