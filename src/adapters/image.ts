import type { Capture } from '#/editor/types'

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Could not decode image at ${src}`))
    image.src = src
  })
}

/**
 * Turns an image file into a capture, reading its natural size so the app can
 * render it unscaled and the canvas adapter can rasterize at the same size.
 *
 * The returned `src` is an object URL owned by the caller — release it with
 * `releaseCapture` once the capture is replaced.
 */
export async function loadCapture(file: Blob): Promise<Capture> {
  const src = URL.createObjectURL(file)
  try {
    const image = await loadImage(src)
    return { src, width: image.naturalWidth, height: image.naturalHeight }
  } catch (error) {
    URL.revokeObjectURL(src)
    throw error
  }
}

export function releaseCapture(capture: Capture) {
  URL.revokeObjectURL(capture.src)
}
