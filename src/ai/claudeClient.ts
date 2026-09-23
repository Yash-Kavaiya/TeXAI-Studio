import Anthropic from '@anthropic-ai/sdk'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { CreateLatexProjectInputSchema, type CreateLatexProjectInput } from './latexProjectTool'
import { ClaudeRefusalError, MalformedOutputError } from './errors'

export const CLAUDE_MODEL = 'claude-sonnet-5'
const CREATE_LATEX_PROJECT_TOOL_NAME = 'create_latex_project'

export function getAnthropicClient(apiKey: string): Anthropic {
  // Anthropic's supported "bring your own key" browser pattern — the SDK
  // sets the anthropic-dangerous-direct-browser-access header automatically.
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
}

/** Near-zero-cost auth check: fetches model metadata rather than generating. */
export async function testAnthropicKey(apiKey: string): Promise<boolean> {
  const client = getAnthropicClient(apiKey)
  await client.models.retrieve(CLAUDE_MODEL)
  return true
}

/** Temporary debug helper (Phase 7): proves a real message-generation round
 * trip works, not just auth. No tools, no structured output. */
export async function debugPrompt(apiKey: string, prompt: string): Promise<string> {
  const client = getAnthropicClient(apiKey)
  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 256,
    messages: [{ role: 'user', content: prompt }],
  })
  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
}

export async function callCreateLatexProjectTool(
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
): Promise<CreateLatexProjectInput> {
  const client = getAnthropicClient(apiKey)

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 16000,
    system: systemPrompt,
    tools: [
      {
        name: CREATE_LATEX_PROJECT_TOOL_NAME,
        description: 'Create a complete, compileable multi-file LaTeX project scaffold.',
        strict: true,
        input_schema: zodToJsonSchema(CreateLatexProjectInputSchema) as Anthropic.Tool.InputSchema,
      },
    ],
    tool_choice: { type: 'tool', name: CREATE_LATEX_PROJECT_TOOL_NAME },
    messages: [{ role: 'user', content: userMessage }],
  })

  if (response.stop_reason === 'refusal') {
    throw new ClaudeRefusalError(response.stop_details)
  }

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock =>
      block.type === 'tool_use' && block.name === CREATE_LATEX_PROJECT_TOOL_NAME,
  )
  if (!toolUse) {
    throw new MalformedOutputError('No create_latex_project tool_use block in response')
  }

  const parsed = CreateLatexProjectInputSchema.safeParse(toolUse.input)
  if (!parsed.success) {
    throw new MalformedOutputError(parsed.error.message)
  }
  return parsed.data
}
