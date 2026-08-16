import type { LoadedImage } from '#/editor/types'

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Could not decode image at ${src}`))
    image.src = src
  })
}

/**
 * Turns a pasted or dropped file into an image the app holds — a capture or a
 * design reference — reading its natural size, which is the unit regions are
 * measured in and the size the canvas adapter rasterizes at.
 *
 * The returned `src` is an object URL owned by the caller — release it with
 * `releaseLoadedImage` once the image is replaced.
 */
export async function loadImageFile(file: Blob): Promise<LoadedImage> {
  const src = URL.createObjectURL(file)
  try {
    const image = await loadImage(src)
    return { src, width: image.naturalWidth, height: image.naturalHeight }
  } catch (error) {
    URL.revokeObjectURL(src)
    throw error
  }
}

export function releaseLoadedImage(image: LoadedImage) {
  // A restored image is carried as a data URL and has nothing to release;
  // revoking one is a no-op, so every image is released the same way.
  URL.revokeObjectURL(image.src)
}

/**
 * The same image with its pixels inline rather than behind an object URL,
 * which only means anything to the page that made it. What a session written
 * into a report has to carry — see `Session`.
 *
 * Read back off the object URL each time rather than held from when the file
 * arrived: this runs once per report handed over, and a copy of every image
 * kept alive for the whole session to save it is the wrong trade.
 */
export async function inlineImage(image: LoadedImage): Promise<LoadedImage> {
  if (image.src.startsWith('data:')) return image
  const blob = await fetch(image.src).then((response) => response.blob())
  return { ...image, src: await dataUrl(blob) }
}

/** An image's bytes as a URL that carries them, rather than points at them. */
export function dataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    // SAFETY: `readAsDataURL` was what started this read, so on a load event
    // `result` is always a data-URL string, never an ArrayBuffer or null.
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Could not read the image back'))
    reader.readAsDataURL(blob)
  })
}
