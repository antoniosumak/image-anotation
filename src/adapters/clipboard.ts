export async function copyImageToClipboard(png: Blob): Promise<void> {
  await navigator.clipboard.write([
    new ClipboardItem({ 'image/png': png }),
  ])
}

export async function copyTextToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text)
}
