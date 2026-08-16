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
  URL.revokeObjectURL(image.src)
}
