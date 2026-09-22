import { getMeta, setMeta } from './metaRepo'
import { listProjects } from './projectsRepo'
import { seedDemoProject } from './seed'

// React StrictMode double-invokes effects in dev, which would otherwise race
// two concurrent "is it seeded yet?" checks into seeding twice. Caching the
// in-flight promise at module scope means every caller within this page
// load shares the same seed attempt instead of starting their own.
let bootstrapPromise: Promise<string | undefined> | undefined

export function ensureBootstrapped(): Promise<string | undefined> {
  if (!bootstrapPromise) {
    bootstrapPromise = resolveInitialProjectId()
  }
  return bootstrapPromise
}

async function resolveInitialProjectId(): Promise<string | undefined> {
  const meta = await getMeta()
  if (!meta.seeded) {
    const projectId = await seedDemoProject()
    await setMeta({ seeded: true, lastOpenedProjectId: projectId })
    return projectId
  }

  if (meta.lastOpenedProjectId) {
    const existing = await listProjects()
    if (existing.some((p) => p.id === meta.lastOpenedProjectId)) {
      return meta.lastOpenedProjectId
    }
    return existing[0]?.id
  }

  const existing = await listProjects()
  return existing[0]?.id
}
