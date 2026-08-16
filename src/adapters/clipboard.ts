import { dataUrl } from '#/adapters/image'

/**
 * Copies the report twice over: as the image every other app reads, and as one
 * line of HTML holding the same PNG inline.
 *
 * The clipboard sanitizes `image/png` — it decodes the pixels and encodes them
 * again, which is what a browser does with bytes another app might have
 * crafted. The pixels survive that; everything around them does not, and the
 * session a report carries is around them. HTML is handed over as written, so
 * the copy inside it is still the file that was copied.
 *
 * HTML rather than a web custom format, which is the other way to get bytes
 * across untouched: custom formats are Chromium's alone, and they can only be
 * read back by asking the clipboard for them, which needs permission the
 * developer has to grant on every paste. Every browser carries `text/html`,
 * and a paste event hands it over without being asked. Pasting a report
 * somewhere else is unaffected either way — a rich-text editor draws the image
 * out of the HTML, and everything else takes the PNG.
 */
export async function copyImageToClipboard(png: Blob): Promise<void> {
  const html = new Blob([`<img src="${await dataUrl(png)}">`], {
    type: 'text/html',
  })

  try {
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': png, 'text/html': html }),
    ])
  } catch {
    // A browser that won't take the pair still gets the image — the report is
    // copied either way, and only reopening it from the clipboard is lost.
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
  }
}

export async function copyTextToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text)
}
