import { createFileRoute } from '@tanstack/react-router'
import { Frame, ImagePlus } from 'lucide-react'
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
  // Only for the drop outline — whether a file is currently over the page.
  const [dropping, setDropping] = useState(false)
  const previous = useRef<Capture | null>(null)

  // The object URL behind the capture on screen is this component's to release,
  // and there are three ways it stops being the one on screen: replaced by
  // another, cleared, or the page going away.
  const releasePreviousCapture = () => {
    if (previous.current) releaseLoadedImage(previous.current)
  }

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
      releasePreviousCapture()
      previous.current = next
      setCaptureError(null)
      setCapture(next)
    } catch {
      setCaptureError(UNREADABLE_IMAGE_MESSAGE)
    }
  }

  /**
   * Done with this screen, on to the next. The capture goes, and with it the
   * editor built around it — which is what takes the design reference, every
   * region and every note with it, since all of them hang off the capture and
   * none of them are written down anywhere else.
   */
  const clearCapture = () => {
    releasePreviousCapture()
    previous.current = null
    setCaptureError(null)
    setCapture(null)
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
  useEffect(() => () => releasePreviousCapture(), [])

  return (
    // One screen, exactly the height of the window: the chrome is fixed and
    // everything that can outgrow it — the stage, the rail — scrolls inside
    // itself. A capture is never allowed to be the thing that decides how big
    // the page is.
    //
    // A file dropped anywhere but the design reference is a capture, so the
    // whole screen is one target and an image dragged out of a folder always
    // has somewhere to land. Files only: text dragged into a note is the
    // browser's to handle.
    <div
      className="bg-background text-foreground flex h-screen flex-col overflow-hidden"
      onDragOver={(event) => {
        if (aimedElsewhere(event.target) || !carriesFiles(event.dataTransfer)) {
          return
        }
        event.preventDefault()
        setDropping(true)
      }}
      onDragLeave={(event) => {
        // Dragging between two elements fires a leave on the one behind — only
        // a leave that goes nowhere inside the page is the file actually gone.
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
          return
        }
        setDropping(false)
      }}
      onDrop={(event) => {
        setDropping(false)
        if (aimedElsewhere(event.target)) return
        event.preventDefault()
        void takeCapture(event.dataTransfer)
      }}
    >
      <header className="border-border/80 bg-background flex h-12 shrink-0 items-center gap-3 border-b px-4">
        <span className="bg-primary text-primary-foreground flex size-6 shrink-0 items-center justify-center rounded-md">
          <Frame className="size-3.5" />
        </span>
        <h1 className="text-[13px] font-medium tracking-tight">
          UI Divergence Feedback
        </h1>
        <span className="text-border select-none">/</span>
        <p className="text-muted-foreground truncate text-[13px] tabular-nums">
          {capture
            ? `${capture.width} × ${capture.height}`
            : 'No capture'}
        </p>

        <p className="text-muted-foreground ml-auto hidden text-xs md:block">
          Mark up what drifted, hand the report to your coding agent
        </p>
      </header>

      {captureError ? (
        <p
          role="alert"
          className="border-destructive/30 bg-destructive/10 text-destructive shrink-0 border-b px-4 py-2 text-[13px]"
        >
          {captureError}
        </p>
      ) : null}

      {capture ? (
        <CaptureEditor
          key={capture.src}
          capture={capture}
          onClear={clearCapture}
        />
      ) : (
        <EmptyStage />
      )}

      {/* Says the page will take the file, without moving anything under it. */}
      {dropping ? (
        <div className="ring-primary/70 pointer-events-none fixed inset-0 z-40 ring-2 ring-inset" />
      ) : null}
    </div>
  )
}

/**
 * The stage before there is anything on it. Same recessed ground the capture
 * lands on, so taking a capture fills the frame that was already there rather
 * than replacing one screen with another.
 */
function EmptyStage() {
  return (
    <main className="stage-surface grid min-h-0 flex-1 place-items-center p-8">
      <div className="border-border bg-card/40 flex w-full max-w-md flex-col items-center gap-5 rounded-xl border border-dashed px-8 py-14 text-center">
        <span className="bg-muted text-muted-foreground flex size-11 items-center justify-center rounded-full">
          <ImagePlus className="size-5" />
        </span>

        <div className="flex flex-col gap-2">
          <h2 className="text-[15px] font-medium">
            Paste an implementation capture
          </h2>
          <p className="text-muted-foreground text-[13px] leading-relaxed text-balance">
            Press <Kbd>Ctrl</Kbd>
            <span className="mx-0.5">/</span>
            <Kbd>⌘</Kbd> <Kbd>V</Kbd>, or drop an image anywhere on this page.
          </p>
        </div>
      </div>
    </main>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="border-border bg-muted text-foreground inline-flex h-5 min-w-5 items-center justify-center rounded border px-1.5 font-mono text-[11px] font-medium">
      {children}
    </kbd>
  )
}
