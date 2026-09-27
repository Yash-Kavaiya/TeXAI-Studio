import { useEffect, useRef, useState } from 'react'
import { deleteProject, listProjects, renameProject } from '../../storage/projectsRepo'
import type { ProjectRecord } from '../../storage/db'
import { createProjectWithFiles } from '../../storage/projectFactory'
import { projectFromZip } from '../../storage/projectZip'
import { NewProjectModal } from './NewProjectModal'
import './ProjectSwitcher.css'

interface ProjectSwitcherProps {
  currentProjectId: string
  currentProjectName: string
  onSwitchProject: (projectId: string) => void
  onProjectRenamed: (projectId: string, name: string) => void
  /** Called after a project (possibly the open one) has been deleted. */
  onProjectDeleted: (projectId: string) => void
  /** Downloads the open project as a .zip. */
  onExportCurrent: () => void
}

type Edit = { id: string; mode: 'rename' | 'delete' }

export function ProjectSwitcher({
  currentProjectId,
  currentProjectName,
  onSwitchProject,
  onProjectRenamed,
  onProjectDeleted,
  onExportCurrent,
}: ProjectSwitcherProps) {
  const [open, setOpen] = useState(false)
  const [showNewProjectModal, setShowNewProjectModal] = useState(false)
  const [projects, setProjects] = useState<ProjectRecord[]>([])
  const [edit, setEdit] = useState<Edit | null>(null)
  const [draft, setDraft] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const zipInputRef = useRef<HTMLInputElement>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    listProjects().then(setProjects).catch(console.error)
    // Close on outside click or Escape.
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) close()
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function close() {
    setOpen(false)
    setEdit(null)
    setNotice(null)
  }

  async function importZip(file: File | undefined) {
    if (zipInputRef.current) zipInputRef.current.value = ''
    if (!file) return
    setNotice(null)
    try {
      const { skipped, ...project } = await projectFromZip(file)
      const projectId = await createProjectWithFiles(project)
      onSwitchProject(projectId)
      if (skipped.length > 0) {
        setProjects(await listProjects())
        setNotice(`Imported. Skipped unsupported files: ${skipped.join(', ')}`)
      } else {
        close()
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err))
    }
  }

  function handleCreated(projectId: string) {
    setShowNewProjectModal(false)
    close()
    onSwitchProject(projectId)
  }

  async function submitRename(project: ProjectRecord) {
    const name = draft.trim()
    if (name && name !== project.name) {
      await renameProject(project.id, name)
      setProjects((list) => list.map((p) => (p.id === project.id ? { ...p, name } : p)))
      onProjectRenamed(project.id, name)
    }
    setEdit(null)
  }

  async function confirmDelete(project: ProjectRecord) {
    await deleteProject(project.id)
    setProjects((list) => list.filter((p) => p.id !== project.id))
    setEdit(null)
    if (project.id === currentProjectId) close()
    onProjectDeleted(project.id)
  }

  return (
    <div className="project-switcher" ref={rootRef}>
      <button
        type="button"
        className="project-switcher-trigger"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
      >
        {currentProjectName} <span className="project-switcher-caret">▾</span>
      </button>
      {open && (
        <div className="project-switcher-menu">
          {projects.map((project) => {
            const mode = edit?.id === project.id ? edit.mode : null
            return (
              <div
                key={project.id}
                className={`project-switcher-item${project.id === currentProjectId ? ' active' : ''}`}
                onClick={
                  mode
                    ? undefined
                    : () => {
                        close()
                        if (project.id !== currentProjectId) onSwitchProject(project.id)
                      }
                }
              >
                {mode === 'rename' ? (
                  <form
                    className="project-switcher-rename"
                    onSubmit={(e) => {
                      e.preventDefault()
                      void submitRename(project)
                    }}
                  >
                    <input
                      autoFocus
                      value={draft}
                      aria-label="Project name"
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          e.stopPropagation()
                          setEdit(null)
                        }
                      }}
                      onBlur={() => void submitRename(project)}
                    />
                  </form>
                ) : (
                  <span className="project-switcher-name">{project.name}</span>
                )}
                {mode === 'delete' ? (
                  <span className="project-switcher-confirm" onClick={(e) => e.stopPropagation()}>
                    Delete project and its files?
                    <button type="button" className="danger" onClick={() => void confirmDelete(project)}>
                      Yes
                    </button>
                    <button type="button" onClick={() => setEdit(null)}>
                      No
                    </button>
                  </span>
                ) : (
                  !mode && (
                    <span className="project-switcher-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        aria-label={`Rename project ${project.name}`}
                        title="Rename"
                        onClick={() => {
                          setDraft(project.name)
                          setEdit({ id: project.id, mode: 'rename' })
                        }}
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete project ${project.name}`}
                        title="Delete"
                        onClick={() => setEdit({ id: project.id, mode: 'delete' })}
                      >
                        ✕
                      </button>
                    </span>
                  )
                )}
              </div>
            )
          })}
          {notice && <div className="project-switcher-notice">{notice}</div>}
          <div className="project-switcher-item project-switcher-new" onClick={() => setShowNewProjectModal(true)}>
            + New Project
          </div>
          <div className="project-switcher-item project-switcher-footer" onClick={() => zipInputRef.current?.click()}>
            Import .zip…
          </div>
          <div
            className="project-switcher-item project-switcher-footer"
            onClick={() => {
              onExportCurrent()
              close()
            }}
          >
            Download project (.zip)
          </div>
          <input
            ref={zipInputRef}
            type="file"
            accept=".zip,application/zip"
            hidden
            onChange={(e) => void importZip(e.target.files?.[0])}
          />
        </div>
      )}
      {showNewProjectModal && (
        <NewProjectModal onCreated={handleCreated} onClose={() => setShowNewProjectModal(false)} />
      )}
    </div>
  )
}
