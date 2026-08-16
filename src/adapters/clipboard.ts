export async function copyImageToClipboard(png: Blob): Promise<void> {
  await navigator.clipboard.write([
    new ClipboardItem({ 'image/png': png }),
  ])
}
