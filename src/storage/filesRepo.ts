import { getDb, type FileKind, type FileRecord } from './db'

export function inferFileKind(path: string): FileKind {
  if (path.endsWith('.tex') || path.endsWith('.cls') || path.endsWith('.sty')) return 'tex'
  if (path.endsWith('.bib')) return 'bib'
  if (/\.(png|jpe?g|gif|svg|pdf)$/i.test(path)) return 'image'
  return 'other'
}

export async function listFilesByProject(projectId: string): Promise<FileRecord[]> {
  const db = await getDb()
  return db.getAllFromIndex('files', 'by-project', projectId)
}

export async function bulkAddFiles(files: FileRecord[]): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('files', 'readwrite')
  await Promise.all([...files.map((file) => tx.store.put(file)), tx.done])
}

export async function updateFileContent(fileId: string, content: string, updatedAt: string): Promise<void> {
  const db = await getDb()
  const file = await db.get('files', fileId)
  if (!file) return
  await db.put('files', { ...file, content, updatedAt })
}
