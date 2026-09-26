import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Editor, type EditorHandle } from './components/Editor/Editor'
import { Toolbar } from './components/Toolbar/Toolbar'
import { SplitPane } from './components/layout/SplitPane'
import { FileTree, type FileTreeActions } from './components/FileTree/FileTree'
import { PdfPreview } from './components/PdfPreview/PdfPreview'
import { LogPanel } from './components/LogPanel/LogPanel'
import { ProjectSwitcher } from './components/ProjectSwitcher/ProjectSwitcher'
import { SettingsPanel } from './components/settings/SettingsPanel'
import { BinaryFilePreview } from './components/BinaryFilePreview/BinaryFilePreview'
import { parseLatexLog } from './engine/logParser'
import { collectProjectSymbols } from './components/Editor/latexCompletions'
import type { LogEntry } from './engine/types'
import { useAutosave } from './hooks/useAutosave'
import { useCompile } from './hooks/useCompile'
import { useProjectStore } from './state/projectStore'
import { setMeta } from './storage/metaRepo'
import { loadProjectData } from './storage/loadProject'
import { ensureBootstrapped } from './storage/bootstrap'
import { listProjects } from './storage/projectsRepo'
import { createProjectWithFiles } from './storage/projectFactory'
import blankMainTex from './storage/blankProject/main.tex?raw'
import { projectToZip } from './storage/projectZip'
import { downloadBytes, safeFileName } from './utils/download'
import { IMPORT_ACCEPT, importFiles } from './storage/importFiles'
import { createEntry, deleteEntry, renameEntry } from './storage/fileOps'
import './App.css'

function App() {
  const {
    projectId,
    projectName,
    files,
    activeFilePath,
    rootFile,
    loadProject,
    setActiveFile,
    updateFileContent,
    upsertFiles,
    removeFiles,
    moveFiles,
    setProjectName,
  } = useProjectStore()
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
  const projectSymbols = useMemo(() => collectProjectSymbols(files), [files])

  const handleCompile = useCallback(() => {
    if (projectId && !compiling) void compile(projectId, files, rootFile)
  }, [compile, compiling, projectId, files, rootFile])

  // Ctrl/Cmd+S and Ctrl/Cmd+Enter compile from anywhere. Inside the editor
  // CodeMirror handles them first and marks the event as handled.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || !(event.ctrlKey || event.metaKey)) return
      if (event.key === 's' || event.key === 'Enter') {
        event.preventDefault()
        handleCompile()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleCompile])

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

  const fileTreeActions: FileTreeActions = {
    async create(input, type) {
      const result = await createEntry(projectId, files, input, type)
      if ('error' in result) return result.error
      upsertFiles([result.file])
      if (type === 'file') setActiveFile(result.file.path)
      return null
    },
    async rename(path, newName) {
      const result = await renameEntry(files, path, newName, rootFile)
      if ('error' in result) return result.error
      moveFiles(result.moves)
      return null
    },
    async remove(path) {
      const result = await deleteEntry(files, path, rootFile)
      if ('error' in result) return result.error
      removeFiles(result.paths)
      return null
    },
    async upload(picked) {
      const { imported, skipped } = await importFiles(projectId, files, picked)
      upsertFiles(imported)
      if (imported.length > 0) setActiveFile(imported[imported.length - 1].path)
      return skipped
    },
  }

  async function handleProjectDeleted(deletedId: string) {
    if (deletedId !== projectId) return
    // The open project is gone: fall back to the newest remaining one, or
    // start a fresh blank project so the editor is never left empty.
    const [next] = await listProjects()
    const nextId =
      next?.id ??
      (await createProjectWithFiles({
        name: 'Untitled Project',
        rootFile: 'main.tex',
        files: [{ path: 'main.tex', content: blankMainTex }],
      }))
    await switchToProject(nextId)
  }

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
              onProjectRenamed={(id, name) => id === projectId && setProjectName(name)}
              onProjectDeleted={(id) => void handleProjectDeleted(id)}
              onExportCurrent={() =>
                downloadBytes(projectToZip(files), `${safeFileName(projectName, 'project')}.zip`, 'application/zip')
              }
            />
          ) : (
            <span className="toolbar-project-name">Loading…</span>
          )
        }
        onCompile={handleCompile}
        compiling={compiling}
        onOpenSettings={() => setShowSettings(true)}
      />
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      <SplitPane
        left={
          <FileTree
            files={files}
            activePath={activeFilePath}
            onSelectFile={setActiveFile}
            rootFile={rootFile}
            uploadAccept={IMPORT_ACCEPT}
            actions={fileTreeActions}
          />
        }
        center={
          activeFile?.data ? (
            <BinaryFilePreview path={activeFile.path} data={activeFile.data} />
          ) : activeFile ? (
            <Editor
              key={`${projectId}:${activeFile.path}`}
              ref={editorRef}
              value={activeFile.content}
              onChange={(value) => updateFileContent(activeFile.path, value)}
              getSymbols={() => projectSymbols}
              onCompileShortcut={handleCompile}
            />
          ) : (
            <div className="pane-placeholder">No file selected</div>
          )
        }
        right={<PdfPreview pdfBytes={pdfBytes} fileName={projectName} />}
      />
      <div className="log-panel-container">
        <LogPanel entries={logEntries} rawLog={log} onJumpToEntry={handleJumpToEntry} />
      </div>
    </div>
  )
}

export default App
