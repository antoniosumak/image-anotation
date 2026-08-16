import { crc32 } from 'node:zlib'

import { describe, expect, it } from 'vitest'

import {
  SESSION_KEYWORD,
  type Session,
  decodeSession,
  encodeSession,
} from '#/editor/session'
import { textChunkIn, withTextChunk } from '#/lib/png-text'

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10]

/**
 * A chunk with the right shape and a CRC of zero. Nothing here checks CRCs —
 * a chunk this app wrote is one it just made — so the bytes only have to walk.
 */
function chunk(type: string, data: number[] = []): number[] {
  const length = [
    (data.length >>> 24) & 0xff,
    (data.length >>> 16) & 0xff,
    (data.length >>> 8) & 0xff,
    data.length & 0xff,
  ]
  const name = [...type].map((character) => character.charCodeAt(0))
  return [...length, ...name, ...data, 0, 0, 0, 0]
}

/** The smallest thing that walks like a PNG: signature, a header, an end. */
function smallestPng(): Uint8Array {
  return Uint8Array.from([
    ...SIGNATURE,
    ...chunk('IHDR', Array.from({ length: 13 }, () => 0)),
    ...chunk('IEND'),
  ])
}

const session: Session = {
  capture: { src: 'data:image/png;base64,AAAA', width: 800, height: 600 },
  designReference: null,
  regions: [
    {
      id: 'region-1',
      number: 1,
      bounds: { x: 10, y: 20, width: 30, height: 40 },
      // Non-ASCII on purpose: a tEXt chunk is Latin-1, and notes are not.
      note: 'Spacing is off — “tighten” it ✅',
      source: 'human',
    },
  ],
}

describe('png text chunks', () => {
  it('reads back what it wrote', () => {
    const written = withTextChunk(smallestPng(), 'keyword', 'the text')
    expect(textChunkIn(written, 'keyword')).toBe('the text')
  })

  it('leaves IEND as the last chunk, so the file still ends where a PNG does', () => {
    const png = smallestPng()
    const written = withTextChunk(png, 'keyword', 'x')
    const end = String.fromCharCode(...written.subarray(-8, -4))

    expect(end).toBe('IEND')
    expect(written.length).toBe(png.length + 'keyword\0x'.length + 12)
  })

  /**
   * A wrong CRC is the one way this corrupts a report silently: the chunk still
   * walks, the app still reads it back, and only a strict decoder somewhere
   * else ever complains. Checked against zlib's, and on a real PNG rather than
   * the synthetic one above.
   */
  it('signs the chunk with a CRC other decoders agree with', () => {
    const png = Uint8Array.from(
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64',
      ),
    )
    const written = withTextChunk(png, 'keyword', 'the text')

    expect(textChunkIn(written, 'keyword')).toBe('the text')

    // Spliced in where IEND used to start, and as long as the file grew.
    const chunk = Buffer.from(
      written.subarray(png.length - 12, written.length - 12),
    )
    expect(chunk.subarray(4, 8).toString()).toBe('tEXt')
    expect(chunk.readUInt32BE(chunk.length - 4)).toBe(
      crc32(chunk.subarray(4, chunk.length - 4)) >>> 0,
    )
  })

  it('finds nothing under a keyword that was never written', () => {
    const written = withTextChunk(smallestPng(), 'keyword', 'the text')
    expect(textChunkIn(written, 'other')).toBeNull()
  })

  it('finds nothing in something that is not a PNG', () => {
    expect(textChunkIn(Uint8Array.from([1, 2, 3, 4]), 'keyword')).toBeNull()
  })
})

describe('sessions carried in a report', () => {
  it('survives the round trip through a report image', () => {
    const written = withTextChunk(
      smallestPng(),
      SESSION_KEYWORD,
      encodeSession(session),
    )
    const text = textChunkIn(written, SESSION_KEYWORD)

    expect(text).toBeTruthy()
    expect(decodeSession(text!)).toEqual(session)
  })

  it('writes ASCII only, because a tEXt chunk is Latin-1', () => {
    expect(encodeSession(session)).toMatch(/^[\x20-\x7e]*$/)
  })

  it('refuses a session pointing at pixels it would have to go and fetch', () => {
    const elsewhere = {
      ...session,
      capture: { ...session.capture, src: 'https://example.com/capture.png' },
    }
    expect(decodeSession(JSON.stringify(elsewhere))).toBeNull()
  })

  it('refuses text that is not a session at all', () => {
    expect(decodeSession('not json')).toBeNull()
    expect(decodeSession('{"regions":[]}')).toBeNull()
  })
})
