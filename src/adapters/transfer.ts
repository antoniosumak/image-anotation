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
