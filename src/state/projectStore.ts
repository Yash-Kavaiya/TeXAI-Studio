import { create } from 'zustand'

export interface ProjectFile {
  id: string
  path: string
  content: string
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
}))
