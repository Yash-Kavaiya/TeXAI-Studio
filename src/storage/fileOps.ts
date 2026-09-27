import { bulkAddFiles, deleteFiles, inferFileKind, moveFiles } from './filesRepo'
import type { ProjectFile } from '../state/projectStore'
import { dirname, validateNewPath } from '../utils/paths'

/** Every file at `path` or inside it (for a folder, including its "path/" marker). */
function filesAt(files: ProjectFile[], path: string): ProjectFile[] {
  return files.filter((f) => f.path === path || f.path.startsWith(`${path}/`))
}

function guardRootFile(affected: ProjectFile[], rootFile: string, verb: string): string | null {
  return affected.some((f) => f.path === rootFile)
    ? `${rootFile} is the project’s main file and can’t be ${verb}.`
    : null
}

export async function createEntry(
  projectId: string,
  files: ProjectFile[],
  input: string,
  type: 'file' | 'folder',
): Promise<{ file: ProjectFile } | { error: string }> {
  const result = validateNewPath(
    input,
    files.map((f) => f.path),
  )
  if ('error' in result) return result
  // Folders only exist as "path/" markers until a file is added inside.
  const file: ProjectFile = {
    id: crypto.randomUUID(),
    path: type === 'folder' ? `${result.path}/` : result.path,
    content: '',
  }
  await bulkAddFiles([
    { ...file, projectId, kind: inferFileKind(file.path), updatedAt: new Date().toISOString() },
  ])
  return { file }
}

export async function renameEntry(
  files: ProjectFile[],
  path: string,
  newName: string,
  rootFile: string,
): Promise<{ moves: { from: string; to: string }[] } | { error: string }> {
  const affected = filesAt(files, path)
  const rootError = guardRootFile(affected, rootFile, 'renamed')
  if (rootError) return { error: rootError }
  if (newName.includes('/')) return { error: 'Names can’t contain “/”.' }

  const dir = dirname(path)
  const others = files.filter((f) => !affected.includes(f)).map((f) => f.path)
  const result = validateNewPath(dir ? `${dir}/${newName}` : newName, others)
  if ('error' in result) return result

  const moves = affected.map((f) => ({ id: f.id, from: f.path, to: result.path + f.path.slice(path.length) }))
  await moveFiles(
    moves.map((m) => ({ id: m.id, path: m.to })),
    new Date().toISOString(),
  )
  return { moves }
}

export async function deleteEntry(
  files: ProjectFile[],
  path: string,
  rootFile: string,
): Promise<{ paths: string[] } | { error: string }> {
  const affected = filesAt(files, path)
  const rootError = guardRootFile(affected, rootFile, 'deleted')
  if (rootError) return { error: rootError }
  await deleteFiles(affected.map((f) => f.id))
  return { paths: affected.map((f) => f.path) }
}
