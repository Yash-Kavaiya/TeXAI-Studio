import { useEffect, useState } from 'react'
import { listProjects } from '../../storage/projectsRepo'
import type { ProjectRecord } from '../../storage/db'
import { NewProjectModal } from './NewProjectModal'
import './ProjectSwitcher.css'

interface ProjectSwitcherProps {
  currentProjectId: string
  currentProjectName: string
  onSwitchProject: (projectId: string) => void
}

export function ProjectSwitcher({ currentProjectId, currentProjectName, onSwitchProject }: ProjectSwitcherProps) {
  const [open, setOpen] = useState(false)
  const [showNewProjectModal, setShowNewProjectModal] = useState(false)
  const [projects, setProjects] = useState<ProjectRecord[]>([])

  useEffect(() => {
    if (open) {
      listProjects().then(setProjects).catch(console.error)
    }
  }, [open])

  function handleCreated(projectId: string) {
    setShowNewProjectModal(false)
    setOpen(false)
    onSwitchProject(projectId)
  }

  return (
    <div className="project-switcher">
      <button type="button" className="project-switcher-trigger" onClick={() => setOpen((v) => !v)}>
        {currentProjectName} <span className="project-switcher-caret">▾</span>
      </button>
      {open && (
        <div className="project-switcher-menu">
          {projects.map((project) => (
            <div
              key={project.id}
              className={`project-switcher-item${project.id === currentProjectId ? ' active' : ''}`}
              onClick={() => {
                setOpen(false)
                if (project.id !== currentProjectId) onSwitchProject(project.id)
              }}
            >
              {project.name}
            </div>
          ))}
          <div className="project-switcher-item project-switcher-new" onClick={() => setShowNewProjectModal(true)}>
            + New Project
          </div>
        </div>
      )}
      {showNewProjectModal && (
        <NewProjectModal onCreated={handleCreated} onClose={() => setShowNewProjectModal(false)} />
      )}
    </div>
  )
}
