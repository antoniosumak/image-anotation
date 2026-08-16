/**
 * Reading and writing PNG `tEXt` chunks, so a written report can carry the
 * session that produced it and be dropped back on the app later.
 *
 * `tEXt` is the standard place for this: a decoder that doesn't know the
 * keyword skips the chunk, so a report carrying one is still an ordinary PNG
 * to every other tool. Trailing bytes after `IEND` would have been fewer lines
 * and are what most "hide data in a PNG" tricks reach for, but they are the
 * first thing an image pipeline drops.
 */

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10]

/** Header and trailer around a chunk's data: length, type, and CRC. */
const CHUNK_OVERHEAD = 12

type Chunk = {
  type: string
  data: Uint8Array
  /** Where the chunk's length field starts, in the whole file. */
  start: number
  end: number
}

let table: Uint32Array | null = null

function crcTable(): Uint32Array {
  if (table) return table
  table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let bit = 0; bit < 8; bit++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
}

/** The CRC-32 every PNG chunk ends with, over its type and its data. */
function crc32(bytes: Uint8Array): number {
  const lookup = crcTable()
  let crc = 0xffffffff
  for (const byte of bytes) crc = lookup[(crc ^ byte) & 0xff]! ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function latin1(text: string): Uint8Array {
  return Uint8Array.from(text, (character) => character.charCodeAt(0) & 0xff)
}

function fromLatin1(bytes: Uint8Array): string {
  // A session runs to megabytes, and spreading that into `fromCharCode` in one
  // go overflows the argument stack.
  let text = ''
  for (let at = 0; at < bytes.length; at += 8192) {
    text += String.fromCharCode(...bytes.subarray(at, at + 8192))
  }
  return text
}

function isPng(bytes: Uint8Array): boolean {
  return SIGNATURE.every((byte, index) => bytes[index] === byte)
}

/**
 * The file's chunks in order. Stops rather than throws at the first one that
 * runs past the end of the file — a truncated PNG is read as far as it goes.
 */
function* chunks(png: Uint8Array): Generator<Chunk> {
  if (!isPng(png)) return
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength)

  let at = SIGNATURE.length
  while (at + CHUNK_OVERHEAD <= png.length) {
    const length = view.getUint32(at)
    const end = at + CHUNK_OVERHEAD + length
    if (end > png.length) return
    yield {
      type: fromLatin1(png.subarray(at + 4, at + 8)),
      data: png.subarray(at + 8, at + 8 + length),
      start: at,
      end,
    }
    at = end
  }
}

function textChunk(keyword: string, text: string): Uint8Array {
  const data = latin1(`${keyword}\0${text}`)
  const chunk = new Uint8Array(data.length + CHUNK_OVERHEAD)
  const view = new DataView(chunk.buffer)

  view.setUint32(0, data.length)
  chunk.set(latin1('tEXt'), 4)
  chunk.set(data, 8)
  view.setUint32(chunk.length - 4, crc32(chunk.subarray(4, chunk.length - 4)))
  return chunk
}

/**
 * The same PNG with one more `tEXt` chunk in it, put before `IEND` because
 * that chunk ends the file.
 *
 * The text must be Latin-1 — see `encodeSession` for how the session gets that
 * way. Throws when handed something that isn't a PNG, which can only be a bug
 * here: the only images this writes to are ones the canvas adapter just made.
 */
export function withTextChunk(
  png: Uint8Array,
  keyword: string,
  text: string,
): Uint8Array<ArrayBuffer> {
  let end: Chunk | null = null
  for (const chunk of chunks(png)) if (chunk.type === 'IEND') end = chunk
  if (!end) throw new Error('Cannot write text into something that is not a PNG')

  const chunk = textChunk(keyword, text)
  const written = new Uint8Array(png.length + chunk.length)
  written.set(png.subarray(0, end.start))
  written.set(chunk, end.start)
  written.set(png.subarray(end.start), end.start + chunk.length)
  return written
}

/**
 * What was written under that keyword, or null when nothing was — which is the
 * ordinary case, since most images dropped on the app are just screenshots.
 */
export function textChunkIn(png: Uint8Array, keyword: string): string | null {
  for (const chunk of chunks(png)) {
    if (chunk.type !== 'tEXt') continue
    const split = chunk.data.indexOf(0)
    if (split < 0) continue
    if (fromLatin1(chunk.data.subarray(0, split)) !== keyword) continue
    return fromLatin1(chunk.data.subarray(split + 1))
  }
  return null
}
