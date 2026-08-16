import {
  SESSION_KEYWORD,
  type Session,
  decodeSession,
  encodeSession,
} from '#/editor/session'
import { textChunkIn, withTextChunk } from '#/lib/png-text'

/**
 * The report image with its own session written into it, so the file on disk is
 * the thing you drop back on the app to carry on marking the capture up.
 */
export async function withSession(png: Blob, session: Session): Promise<Blob> {
  const written = withTextChunk(
    new Uint8Array(await png.arrayBuffer()),
    SESSION_KEYWORD,
    encodeSession(session),
  )
  return new Blob([written], { type: 'image/png' })
}

/**
 * The session inside a dropped image, or null when it hasn't got one — which
 * is every ordinary screenshot, and also a report that was copied to the
 * clipboard rather than written, since the clipboard re-encodes the pixels and
 * drops everything around them.
 */
export async function sessionIn(image: Blob): Promise<Session | null> {
  const text = textChunkIn(
    new Uint8Array(await image.arrayBuffer()),
    SESSION_KEYWORD,
  )
  return text ? decodeSession(text) : null
}
