import { createProject } from './projectsRepo'
import { bulkAddFiles, inferFileKind } from './filesRepo'

export interface ProjectTemplateInput {
  name: string
  rootFile: string
  /** `data` carries raw bytes for binary files (images); `content` is then empty. */
  files: { path: string; content: string; data?: Uint8Array }[]
}

/** The single place that creates a Project + its Files together — used by
 * both the blank-project path and (later) the AI-generated-project path, so
 * there's one project-creation code path, not two. */
export async function createProjectWithFiles(input: ProjectTemplateInput): Promise<string> {
  const projectId = crypto.randomUUID()
  const now = new Date().toISOString()

  await createProject({
    id: projectId,
    name: input.name,
    rootFile: input.rootFile,
    createdAt: now,
    updatedAt: now,
  })

  await bulkAddFiles(
    input.files.map((file) => ({
      id: crypto.randomUUID(),
      projectId,
      path: file.path,
      kind: inferFileKind(file.path),
      content: file.content,
      ...(file.data ? { data: file.data } : {}),
      updatedAt: now,
    })),
  )

  return projectId
}
