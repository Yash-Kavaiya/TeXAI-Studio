const encoder = new TextEncoder()

export function utf8(text: string): Uint8Array {
  return encoder.encode(text)
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

/** Decodes base64 as GitHub returns it (wrapped at 60 columns with newlines). */
export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64.replace(/\s+/g, ''))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/**
 * The SHA-1 git assigns a blob with these bytes (`sha1("blob <len>\0" + data)`).
 * Comparing it with the SHA in a remote tree tells us a file is unchanged
 * without downloading it.
 */
export async function gitBlobSha(bytes: Uint8Array): Promise<string> {
  const header = encoder.encode(`blob ${bytes.length}\0`)
  const buffer = new Uint8Array(header.length + bytes.length)
  buffer.set(header)
  buffer.set(bytes, header.length)
  const digest = await crypto.subtle.digest('SHA-1', buffer)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}
