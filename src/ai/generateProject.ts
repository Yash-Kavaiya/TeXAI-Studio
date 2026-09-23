import { getAnthropicApiKey, getMem0ApiKey, getOrCreateMem0UserId } from '../settings/apiKeyStore'
import { callCreateLatexProjectTool } from './claudeClient'
import { buildSystemPrompt } from './systemPrompt'
import { buildUserMessage } from './promptBuilder'
import { resolveMem0Client, type MemoryRecord } from './mem0Client'
import { MissingApiKeyError } from './errors'

export interface GenerateProjectRequest {
  prompt: string
}

export interface GenerateProjectResult {
  projectName: string
  summary: string
  documentClass: string
  files: { path: string; content: string }[]
  usedMemories: MemoryRecord[]
}

export async function generateLatexProject(request: GenerateProjectRequest): Promise<GenerateProjectResult> {
  const apiKey = getAnthropicApiKey()
  if (!apiKey) throw new MissingApiKeyError('anthropic')

  const mem0Client = resolveMem0Client(getMem0ApiKey())
  const userId = getOrCreateMem0UserId()
  const memories = await mem0Client.searchMemories(request.prompt, userId, 5).catch(() => [])

  const system = buildSystemPrompt()
  const userMessage = buildUserMessage(
    request.prompt,
    memories.map((m) => m.text),
  )
  const toolInput = await callCreateLatexProjectTool(apiKey, system, userMessage)

  const sectionNames = toolInput.files
    .filter((f) => f.path.startsWith('sections/'))
    .map((f) => f.path)
    .join(', ')
  const memoryNote =
    `Generated a "${toolInput.document_class}" LaTeX project (${toolInput.project_name}) from the prompt: ` +
    `"${request.prompt}". Inferred preferences: format=${toolInput.document_class}` +
    (sectionNames ? `, sections=${sectionNames}` : '') +
    '.'
  mem0Client.addMemory(memoryNote, userId).catch((err: unknown) => {
    console.warn('mem0 write failed (non-fatal)', err)
  })

  return {
    projectName: toolInput.project_name,
    summary: toolInput.summary,
    documentClass: toolInput.document_class,
    files: toolInput.files,
    usedMemories: memories,
  }
}
