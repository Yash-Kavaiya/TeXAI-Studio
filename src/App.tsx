import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Editor, type EditorHandle } from './components/Editor/Editor'
import { Toolbar } from './components/Toolbar/Toolbar'
import { SplitPane } from './components/layout/SplitPane'
import { FileTree } from './components/FileTree/FileTree'
import { PdfPreview } from './components/PdfPreview/PdfPreview'
import { LogPanel } from './components/LogPanel/LogPanel'
import { ProjectSwitcher } from './components/ProjectSwitcher/ProjectSwitcher'
import { SettingsPanel } from './components/settings/SettingsPanel'
import { parseLatexLog } from './engine/logParser'
import type { LogEntry } from './engine/types'
import { useAutosave } from './hooks/useAutosave'
import { useCompile } from './hooks/useCompile'
import { useProjectStore } from './state/projectStore'
import { setMeta } from './storage/metaRepo'
import { loadProjectData } from './storage/loadProject'
import { ensureBootstrapped } from './storage/bootstrap'
import './App.css'

function App() {
  const { projectId, projectName, files, activeFilePath, rootFile, loadProject, setActiveFile, updateFileContent } =
    useProjectStore()
  const { compile, compiling, pdfBytes, log } = useCompile()
  const editorRef = useRef<EditorHandle>(null)
  const [pendingJumpLine, setPendingJumpLine] = useState<number | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  const switchToProject = useCallback(
    async (id: string) => {
      const project = await loadProjectData(id)
      loadProject(project)
      await setMeta({ lastOpenedProjectId: id })
    },
    [loadProject],
  )

  useEffect(() => {
    async function boot() {
      const targetProjectId = await ensureBootstrapped()
      if (targetProjectId) {
        const project = await loadProjectData(targetProjectId)
        loadProject(project)
      }
    }
    boot().catch(console.error)
  }, [loadProject])

  useAutosave(files)

  const activeFile = files.find((f) => f.path === activeFilePath)
  const logEntries = useMemo(() => parseLatexLog(log), [log])

  // Once the editor for the target file has (re)mounted, apply the jump.
  // The setState-in-effect here is intentional: jumpToLine needs the new
  // file's CodeMirror instance to exist first, which only happens after
  // activeFilePath's change has propagated through a render.
  useEffect(() => {
    if (pendingJumpLine !== null) {
      editorRef.current?.jumpToLine(pendingJumpLine)
      // eslint-disable-next-line react/set-state-in-effect
      setPendingJumpLine(null)
    }
  }, [activeFilePath, pendingJumpLine])

  function handleJumpToEntry(entry: LogEntry) {
    if (entry.line === undefined) return
    if (entry.file && entry.file !== activeFilePath && files.some((f) => f.path === entry.file)) {
      setActiveFile(entry.file)
      setPendingJumpLine(entry.line)
    } else {
      editorRef.current?.jumpToLine(entry.line)
    }
  }

  return (
    <div className="app">
      <Toolbar
        projectSlot={
          projectId ? (
            <ProjectSwitcher
              currentProjectId={projectId}
              currentProjectName={projectName}
              onSwitchProject={(id) => void switchToProject(id)}
            />
          ) : (
            <span className="toolbar-project-name">Loading…</span>
          )
        }
        onCompile={() => compile(projectId, files, rootFile)}
        compiling={compiling}
        onOpenSettings={() => setShowSettings(true)}
      />
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      <SplitPane
        left={<FileTree files={files} activePath={activeFilePath} onSelectFile={setActiveFile} />}
        center={
          activeFile ? (
            <Editor
              key={`${projectId}:${activeFile.path}`}
              ref={editorRef}
              value={activeFile.content}
              onChange={(value) => updateFileContent(activeFile.path, value)}
            />
          ) : (
            <div className="pane-placeholder">No file selected</div>
          )
        }
        right={<PdfPreview pdfBytes={pdfBytes} />}
      />
      <div className="log-panel-container">
        <LogPanel entries={logEntries} onJumpToEntry={handleJumpToEntry} />
      </div>
    </div>
  )
}

export default App
