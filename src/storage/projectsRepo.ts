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
  return db.getAll('projects')
}

export async function touchProject(id: string, updatedAt: string): Promise<void> {
  const db = await getDb()
  const project = await db.get('projects', id)
  if (!project) return
  await db.put('projects', { ...project, updatedAt })
}
