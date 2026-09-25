import { getProject } from './projectsRepo'
import { listFilesByProject } from './filesRepo'

export async function loadProjectData(projectId: string) {
  const project = await getProject(projectId)
  if (!project) throw new Error(`Project ${projectId} not found`)
  const files = await listFilesByProject(projectId)
  return {
    projectId: project.id,
    projectName: project.name,
    rootFile: project.rootFile,
    files: files.map((f) => ({ id: f.id, path: f.path, content: f.content, data: f.data })),
  }
}
