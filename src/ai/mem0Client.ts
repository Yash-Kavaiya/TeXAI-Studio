export interface MemoryRecord {
  id?: string
  text: string
}

export interface Mem0Client {
  searchMemories(query: string, userId: string, limit?: number): Promise<MemoryRecord[]>
  addMemory(text: string, userId: string): Promise<void>
}

const MEM0_API_BASE = 'https://api.mem0.ai/v1'

// Verified empirically (browser devtools fetch spike, response type "cors",
// real JSON body readable) that api.mem0.ai does answer direct browser
// requests — mem0's docs discourage client-side keys for security reasons,
// not because of a CORS block. We follow the same bring-your-own-key
// security posture already used for the Anthropic key.
export function createMem0HttpClient(apiKey: string): Mem0Client {
  const headers = {
    Authorization: `Token ${apiKey}`,
    'Content-Type': 'application/json',
  }

  return {
    async searchMemories(query, userId, limit = 5) {
      const res = await fetch(`${MEM0_API_BASE}/memories/search/`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, user_id: userId, top_k: limit }),
      })
      if (!res.ok) throw new Error(`mem0 search failed: ${res.status}`)
      const data: unknown = await res.json()
      const items = Array.isArray(data) ? data : []
      return items.map((item: { id?: string; memory: string }) => ({ id: item.id, text: item.memory }))
    },

    async addMemory(text, userId) {
      const res = await fetch(`${MEM0_API_BASE}/memories/`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ messages: [{ role: 'user', content: text }], user_id: userId }),
      })
      if (!res.ok) throw new Error(`mem0 add failed: ${res.status}`)
    },
  }
}

// Zero-backend fallback used when no mem0 key is configured. No semantic
// search — substring match (boosted) plus recency is enough for short
// preference notes like "prefers IEEEtran format".
const LOCAL_STORE_KEY = 'texai.ai.localMemories'

interface StoredMemory {
  id: string
  userId: string
  text: string
  createdAt: string
}

function readLocalMemories(): StoredMemory[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORE_KEY)
    return raw ? (JSON.parse(raw) as StoredMemory[]) : []
  } catch {
    return []
  }
}

function writeLocalMemories(memories: StoredMemory[]): void {
  localStorage.setItem(LOCAL_STORE_KEY, JSON.stringify(memories))
}

export function createLocalMemoryStore(): Mem0Client {
  return {
    async searchMemories(query, userId, limit = 5) {
      const q = query.toLowerCase()
      const mine = readLocalMemories()
        .filter((m) => m.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      const matched = mine.filter((m) => m.text.toLowerCase().includes(q))
      const rest = mine.filter((m) => !m.text.toLowerCase().includes(q))
      return [...matched, ...rest].slice(0, limit).map((m) => ({ id: m.id, text: m.text }))
    },

    async addMemory(text, userId) {
      const all = readLocalMemories()
      all.push({ id: crypto.randomUUID(), userId, text, createdAt: new Date().toISOString() })
      writeLocalMemories(all)
    },
  }
}

export function resolveMem0Client(mem0ApiKey: string | null): Mem0Client {
  return mem0ApiKey ? createMem0HttpClient(mem0ApiKey) : createLocalMemoryStore()
}

export async function testMem0Key(apiKey: string): Promise<boolean> {
  const client = createMem0HttpClient(apiKey)
  await client.searchMemories('connection test', 'texai-connection-test', 1)
  return true
}
