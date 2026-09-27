import { useRef, useState } from 'react'
import { buildTree } from './buildTree'
import { FileTreeNode, type NodeEdit } from './FileTreeNode'
import './FileTree.css'

/** Each resolves to an error message to show, or null on success. */
export interface FileTreeActions {
  create: (input: string, type: 'file' | 'folder') => Promise<string | null>
  rename: (path: string, newName: string) => Promise<string | null>
  remove: (path: string) => Promise<string | null>
  /** Resolves to the names of any files that were skipped as unsupported. */
  upload: (files: File[]) => Promise<string[]>
}

interface FileTreeProps {
  files: { path: string }[]
  activePath: string
  /** The project's main file — it can't be renamed or deleted. */
  rootFile: string
  onSelectFile: (path: string) => void
  /** Accepted file extensions for the upload picker, e.g. ".png,.tex". */
  uploadAccept: string
  actions: FileTreeActions
}

export function FileTree({ files, activePath, rootFile, onSelectFile, uploadAccept, actions }: FileTreeProps) {
  const tree = buildTree(files)
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [creating, setCreating] = useState<'file' | 'folder' | null>(null)
  const [draft, setDraft] = useState('')
  const [edit, setEdit] = useState<NodeEdit | null>(null)

  /** Runs an action, surfacing its error (or a thrown one) in the notice line. */
  async function run(action: () => Promise<string | null>): Promise<boolean> {
    setBusy(true)
    setNotice(null)
    try {
      const error = await action()
      if (error) setNotice(error)
      return !error
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err))
      return false
    } finally {
      setBusy(false)
    }
  }

  function startCreate(type: 'file' | 'folder') {
    setEdit(null)
    setNotice(null)
    setDraft('')
    setCreating(type)
  }

  async function submitCreate() {
    if (!creating) return
    if (await run(() => actions.create(draft, creating))) setCreating(null)
  }

  async function handlePicked(list: FileList | null) {
    if (!list || list.length === 0) return
    await run(async () => {
      const skipped = await actions.upload([...list])
      return skipped.length > 0 ? `Skipped unsupported: ${skipped.join(', ')}` : null
    })
    // Reset so picking the same file again still fires onChange.
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="file-tree">
      <div className="file-tree-header">
        <span>Files</span>
        <div className="file-tree-header-actions">
          <button type="button" className="file-tree-button" onClick={() => startCreate('file')} disabled={busy} title="New file">
            + File
          </button>
          <button type="button" className="file-tree-button" onClick={() => startCreate('folder')} disabled={busy} title="New folder">
            + Folder
          </button>
          <button
            type="button"
            className="file-tree-button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            title="Upload images (PNG, JPG, PDF) or .tex/.bib/.sty/.cls files"
          >
            Upload
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={uploadAccept}
          hidden
          onChange={(e) => void handlePicked(e.target.files)}
        />
      </div>
      {creating && (
        <form
          className="file-tree-create"
          onSubmit={(e) => {
            e.preventDefault()
            void submitCreate()
          }}
        >
          <input
            autoFocus
            className="file-tree-input"
            value={draft}
            placeholder={creating === 'file' ? 'sections/discussion.tex' : 'figures'}
            aria-label={creating === 'file' ? 'New file path' : 'New folder path'}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setCreating(null)}
            disabled={busy}
          />
        </form>
      )}
      {notice && <div className="file-tree-notice">{notice}</div>}
      {tree.map((node) => (
        <FileTreeNode
          key={node.path}
          node={node}
          depth={0}
          activePath={activePath}
          rootFile={rootFile}
          onSelectFile={onSelectFile}
          edit={edit}
          setEdit={(next) => {
            setCreating(null)
            setNotice(null)
            setEdit(next)
          }}
          onRename={async (path, name) => {
            if (await run(() => actions.rename(path, name))) setEdit(null)
          }}
          onDelete={async (path) => {
            if (await run(() => actions.remove(path))) setEdit(null)
          }}
          busy={busy}
        />
      ))}
    </div>
  )
}
