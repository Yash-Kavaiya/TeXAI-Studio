import { create } from 'zustand'
import type { GithubLink } from '../storage/db'

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
  github?: GithubLink
}

interface ProjectState {
  projectId: string
  projectName: string
  files: ProjectFile[]
  activeFilePath: string
  rootFile: string
  github: GithubLink | undefined
  loadProject: (project: LoadedProject) => void
  setActiveFile: (path: string) => void
  setProjectName: (name: string) => void
  setGithub: (github: GithubLink | undefined) => void
  updateFileContent: (path: string, content: string) => void
  upsertFiles: (files: ProjectFile[]) => void
  removeFiles: (paths: string[]) => void
  moveFiles: (moves: { from: string; to: string }[]) => void
}

export const useProjectStore = create<ProjectState>((set) => ({
  projectId: '',
  projectName: '',
  files: [],
  activeFilePath: '',
  rootFile: 'main.tex',
  github: undefined,
  loadProject: ({ projectId, projectName, rootFile, files, github }) =>
    set({ projectId, projectName, rootFile, files, github, activeFilePath: rootFile }),
  setActiveFile: (path) => set({ activeFilePath: path }),
  setProjectName: (name) => set({ projectName: name }),
  setGithub: (github) => set({ github }),
  updateFileContent: (path, content) =>
    set((state) => ({
      files: state.files.map((f) => (f.path === path ? { ...f, content } : f)),
    })),
  upsertFiles: (incoming) =>
    set((state) => {
      const incomingPaths = new Set(incoming.map((f) => f.path))
      return { files: [...state.files.filter((f) => !incomingPaths.has(f.path)), ...incoming] }
    }),
  removeFiles: (paths) =>
    set((state) => {
      const removed = new Set(paths)
      return {
        files: state.files.filter((f) => !removed.has(f.path)),
        activeFilePath: removed.has(state.activeFilePath) ? state.rootFile : state.activeFilePath,
      }
    }),
  moveFiles: (moves) =>
    set((state) => {
      const to = new Map(moves.map((m) => [m.from, m.to]))
      return {
        files: state.files.map((f) => (to.has(f.path) ? { ...f, path: to.get(f.path)! } : f)),
        activeFilePath: to.get(state.activeFilePath) ?? state.activeFilePath,
      }
    }),
}))
