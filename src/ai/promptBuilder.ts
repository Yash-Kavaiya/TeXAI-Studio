export function buildUserMessage(prompt: string, memories: string[] = []): string {
  if (memories.length === 0) {
    return `User request: ${prompt}`
  }
  const memoryBlock = memories.map((m) => `- ${m}`).join('\n')
  return `Known user preferences (from prior sessions):\n${memoryBlock}\n\nUser request: ${prompt}`
}
