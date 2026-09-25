import { create } from 'zustand'

export interface ProjectFile {
  id: string
  path: string
  content: string
  /** Raw bytes for binary files (images); `content` is empty for these. */
  data?: Uint8Array
}

interface LoadedProject {
  projectId: string
  projectName: string
  rootFile: string
  files: ProjectFile[]
}

interface ProjectState {
  projectId: string
  projectName: string
  files: ProjectFile[]
  activeFilePath: string
  rootFile: string
  loadProject: (project: LoadedProject) => void
  setActiveFile: (path: string) => void
  updateFileContent: (path: string, content: string) => void
  upsertFiles: (files: ProjectFile[]) => void
}

export const useProjectStore = create<ProjectState>((set) => ({
  projectId: '',
  projectName: '',
  files: [],
  activeFilePath: '',
  rootFile: 'main.tex',
  loadProject: ({ projectId, projectName, rootFile, files }) =>
    set({ projectId, projectName, rootFile, files, activeFilePath: rootFile }),
  setActiveFile: (path) => set({ activeFilePath: path }),
  updateFileContent: (path, content) =>
    set((state) => ({
      files: state.files.map((f) => (f.path === path ? { ...f, content } : f)),
    })),
  upsertFiles: (incoming) =>
    set((state) => {
      const incomingPaths = new Set(incoming.map((f) => f.path))
      return { files: [...state.files.filter((f) => !incomingPaths.has(f.path)), ...incoming] }
    }),
}))
