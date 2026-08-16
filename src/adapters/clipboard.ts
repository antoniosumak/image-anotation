/** The pasted image, or null when the paste carried something else. */
export function imageFromPaste(clipboardData: DataTransfer | null): Blob | null {
  for (const item of clipboardData?.items ?? []) {
    if (item.kind !== 'file' || !item.type.startsWith('image/')) continue
    const file = item.getAsFile()
    if (file) return file
  }
  return null
}

export async function copyImageToClipboard(png: Blob): Promise<void> {
  await navigator.clipboard.write([
    new ClipboardItem({ 'image/png': png }),
  ])
}
