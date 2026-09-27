/** Saves bytes to the user's disk via a temporary object URL. */
export function downloadBytes(bytes: Uint8Array, fileName: string, type: string): void {
  const url = URL.createObjectURL(new Blob([bytes.slice()], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  // Revoke after the browser has started the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** A project name made safe to use as a file name on any OS. */
export function safeFileName(name: string, fallback: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '-').trim() || fallback
}
