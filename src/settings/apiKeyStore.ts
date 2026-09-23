const LS = {
  anthropicApiKey: 'texai.ai.anthropicApiKey',
  mem0ApiKey: 'texai.ai.mem0ApiKey',
  mem0UserId: 'texai.ai.mem0UserId',
} as const

export function getAnthropicApiKey(): string | null {
  return localStorage.getItem(LS.anthropicApiKey)
}

export function setAnthropicApiKey(key: string): void {
  localStorage.setItem(LS.anthropicApiKey, key)
}

export function clearAnthropicApiKey(): void {
  localStorage.removeItem(LS.anthropicApiKey)
}

export function getMem0ApiKey(): string | null {
  return localStorage.getItem(LS.mem0ApiKey)
}

export function setMem0ApiKey(key: string): void {
  localStorage.setItem(LS.mem0ApiKey, key)
}

export function clearMem0ApiKey(): void {
  localStorage.removeItem(LS.mem0ApiKey)
}

export function getOrCreateMem0UserId(): string {
  let id = localStorage.getItem(LS.mem0UserId)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(LS.mem0UserId, id)
  }
  return id
}
