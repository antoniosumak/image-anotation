/** What to say when a paste or a drop carried something that wasn't an image. */
export const NO_IMAGE_MESSAGE = 'That carried no image.'

/** And when one arrived, but the browser could not decode it. */
export const UNREADABLE_IMAGE_MESSAGE = 'That image could not be read.'

/**
 * The image carried by a paste or a drop, or null when it carried none. Both
 * arrive as a `DataTransfer`, and an image is an image whichever way the
 * developer got it into the app.
 */
export function carriesFiles(transfer: DataTransfer | null): boolean {
  return transfer?.types.includes('Files') ?? false
}

export function imageFromTransfer(transfer: DataTransfer | null): Blob | null {
  for (const item of transfer?.items ?? []) {
    if (item.kind !== 'file' || !item.type.startsWith('image/')) continue
    const file = item.getAsFile()
    if (file) return file
  }
  return null
}

/** The one image a copied report puts in its HTML — see `copyImageToClipboard`. */
const IMAGE_IN_HTML = /<img[^>]+src="(data:image\/png;base64,[^"]+)"/

/**
 * The image a paste carried inside its HTML, which is where a report copied
 * from this app is still the file it was rather than a re-encoding of its
 * pixels. Null when the paste carried no HTML, or HTML with no image in it.
 *
 * Anything found here is still only a candidate: plenty of pages carry an
 * inline image, and one copied out of a browser is not what the developer
 * meant to paste. The caller takes it only once it turns out to be a report —
 * see `takePaste`.
 *
 * The transfer is read before this returns, not after: a `DataTransfer` is
 * only good inside the handler it arrived in, and an `async` function runs up
 * to its first `await` before it hands a promise back.
 */
export async function imageInTransferHtml(
  transfer: DataTransfer | null,
): Promise<Blob | null> {
  const found = IMAGE_IN_HTML.exec(transfer?.getData('text/html') ?? '')
  if (!found) return null
  return fetch(found[1]!)
    .then((response) => response.blob())
    .catch(() => null)
}
