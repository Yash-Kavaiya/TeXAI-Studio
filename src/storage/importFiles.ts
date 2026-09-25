import { bulkAddFiles, inferFileKind } from './filesRepo'
import type { ProjectFile } from '../state/projectStore'

// pdfTeX can embed PNG, JPEG and PDF graphics — nothing else (no SVG/GIF).
const IMAGE_RE = /\.(png|jpe?g|pdf)$/i
const TEXT_RE = /\.(tex|bib|sty|cls|bst|txt)$/i

export const IMPORT_ACCEPT = '.png,.jpg,.jpeg,.pdf,.tex,.bib,.sty,.cls,.bst,.txt'

/** Persists files picked from the user's disk into a project. Images land in
 * figures/ when the project has that folder (AI templates always do), text
 * files at the project root. A file whose path already exists replaces it,
 * keeping its id so the unique [projectId, path] index stays satisfied. */
export async function importFiles(
  projectId: string,
  existing: ProjectFile[],
  picked: File[],
): Promise<{ imported: ProjectFile[]; skipped: string[] }> {
  const hasFiguresDir = existing.some((f) => f.path.startsWith('figures/'))
  const imported: ProjectFile[] = []
  const skipped: string[] = []

  for (const file of picked) {
    const isImage = IMAGE_RE.test(file.name)
    if (!isImage && !TEXT_RE.test(file.name)) {
      skipped.push(file.name)
      continue
    }
    const path = isImage && hasFiguresDir ? `figures/${file.name}` : file.name
    const id = existing.find((f) => f.path === path)?.id ?? crypto.randomUUID()
    imported.push(
      isImage
        ? { id, path, content: '', data: new Uint8Array(await file.arrayBuffer()) }
        : { id, path, content: await file.text() },
    )
  }

  const now = new Date().toISOString()
  await bulkAddFiles(
    imported.map((file) => ({ ...file, projectId, kind: inferFileKind(file.path), updatedAt: now })),
  )
  return { imported, skipped }
}
