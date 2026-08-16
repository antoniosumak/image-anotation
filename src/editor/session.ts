import { z } from 'zod'

import type { DesignReference, LoadedImage, Region } from '#/editor/types'

/**
 * A capture, what was attached to it, and everything drawn on it — enough to
 * put the editor back exactly where it was left. Written into every report
 * image the app produces, so the report *is* the save file: there is no second
 * artifact to keep beside it and no state kept behind the developer's back.
 *
 * The capture is carried as pixels rather than as the object URL the page had,
 * because that URL means nothing to the page that opens the report later. It
 * has to be the capture and not the report image: a report already has the
 * regions drawn onto it, and reopening one would otherwise pile a second set
 * of pins on top of the first.
 */
export type Session = {
  capture: LoadedImage
  designReference: DesignReference | null
  regions: Region[]
}

/** The `tEXt` keyword a session is written under. */
export const SESSION_KEYWORD = 'ui-divergence-session'

/**
 * The session as text a PNG can carry. `tEXt` is Latin-1 and a note can be
 * written in anything, so the JSON is escaped down to ASCII — which keeps the
 * chunk legal without base64-ing the data URLs that are most of its weight a
 * second time. Only string contents can be non-ASCII in JSON output, so
 * escaping them in place leaves the document valid.
 */
export function encodeSession(session: Session): string {
  return JSON.stringify(session).replace(
    /[^\x20-\x7e]/g,
    (character) =>
      `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`,
  )
}

const size = z.number().finite().positive()
const coordinate = z.number().finite()

// A data URL and nothing else: the pixels travel inside the report, so a
// session pointing anywhere the page would have to go and fetch is one that
// did not come from this app.
const loadedImage = z.object({
  src: z.string().startsWith('data:image/'),
  width: size,
  height: size,
})

const region = z.object({
  id: z.string(),
  number: size,
  bounds: z.object({ x: coordinate, y: coordinate, width: size, height: size }),
  note: z.string(),
  source: z.enum(['human', 'model']),
  // Only ever written by a model, and dropped rather than fatal when mangled —
  // the regions themselves are still worth having.
  confidence: size.optional().catch(undefined),
})

const session = z.object({
  capture: loadedImage,
  // An attachment, not the substance: a mangled design reference costs the
  // session its reference, never the capture and the regions.
  designReference: loadedImage.nullable().catch(null),
  regions: z.array(region),
})

/**
 * The session back out of a report, or null when the text isn't one.
 *
 * Everything is checked rather than trusted. This parses a file that arrived
 * by drag and drop, and the src it carries goes straight into an `<img>` —
 * a report from somewhere else is not a reason to hand the page an arbitrary
 * URL to fetch.
 */
export function decodeSession(text: string): Session | null {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return null
  }

  const parsed = session.safeParse(raw)
  return parsed.success ? parsed.data : null
}
