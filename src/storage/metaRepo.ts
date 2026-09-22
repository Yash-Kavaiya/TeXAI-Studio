import { getDb, type MetaRecord } from './db'

const META_KEY = 'app' as const

const DEFAULT_META: MetaRecord = { key: META_KEY, seeded: false }

export async function getMeta(): Promise<MetaRecord> {
  const db = await getDb()
  return (await db.get('meta', META_KEY)) ?? DEFAULT_META
}

export async function setMeta(patch: Partial<Omit<MetaRecord, 'key'>>): Promise<void> {
  const db = await getDb()
  const current = await getMeta()
  await db.put('meta', { ...current, ...patch, key: META_KEY })
}
