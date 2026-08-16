/**
 * The image carried by a paste or a drop, or null when it carried none. Both
 * arrive as a `DataTransfer`, and an image is an image whichever way the
 * developer got it into the app.
 */
export function imageFromTransfer(transfer: DataTransfer | null): Blob | null {
  for (const item of transfer?.items ?? []) {
    if (item.kind !== 'file' || !item.type.startsWith('image/')) continue
    const file = item.getAsFile()
    if (file) return file
  }
  return null
}
