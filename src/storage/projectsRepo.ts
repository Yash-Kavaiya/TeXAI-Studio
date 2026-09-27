import { getDb, type ProjectRecord } from './db'

export async function createProject(project: ProjectRecord): Promise<void> {
  const db = await getDb()
  await db.put('projects', project)
}

export async function getProject(id: string): Promise<ProjectRecord | undefined> {
  const db = await getDb()
  return db.get('projects', id)
}

export async function listProjects(): Promise<ProjectRecord[]> {
  const db = await getDb()
  const projects = await db.getAll('projects')
  // Most recently created first, so new projects appear at the top.
  return projects.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function touchProject(id: string, updatedAt: string): Promise<void> {
  const db = await getDb()
  const project = await db.get('projects', id)
  if (!project) return
  await db.put('projects', { ...project, updatedAt })
}

export async function renameProject(id: string, name: string): Promise<void> {
  const db = await getDb()
  const project = await db.get('projects', id)
  if (!project) return
  await db.put('projects', { ...project, name, updatedAt: new Date().toISOString() })
}

/** Deletes a project and every file in it, atomically. */
export async function deleteProject(id: string): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(['projects', 'files'], 'readwrite')
  const fileIds = await tx.objectStore('files').index('by-project').getAllKeys(id)
  await Promise.all([
    tx.objectStore('projects').delete(id),
    ...fileIds.map((fileId) => tx.objectStore('files').delete(fileId)),
    tx.done,
  ])
}
