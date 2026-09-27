import { useEffect, useRef, useState } from 'react'
import type { TreeNode } from './buildTree'

/** The single row currently being renamed or confirming deletion. */
export interface NodeEdit {
  path: string
  mode: 'rename' | 'delete'
}

interface FileTreeNodeProps {
  node: TreeNode
  depth: number
  activePath: string
  rootFile: string
  onSelectFile: (path: string) => void
  edit: NodeEdit | null
  setEdit: (edit: NodeEdit | null) => void
  onRename: (path: string, newName: string) => Promise<void>
  onDelete: (path: string) => Promise<void>
  busy: boolean
}

export function FileTreeNode(props: FileTreeNodeProps) {
  const { node, depth, activePath, rootFile, onSelectFile, edit, setEdit, onRename, onDelete, busy } = props
  const style = { paddingLeft: `${depth * 14 + 8}px` }
  const isFolder = node.type === 'folder'
  const editing = edit?.path === node.path ? edit.mode : null
  // The main file (and any folder holding it) can't be renamed or deleted.
  const isProtected = node.path === rootFile || rootFile.startsWith(`${node.path}/`)

  const row = (
    <div
      className={`file-tree-row ${isFolder ? 'file-tree-folder' : 'file-tree-file'}${node.path === activePath ? ' active' : ''}`}
      style={style}
      onClick={isFolder || editing ? undefined : () => onSelectFile(node.path)}
    >
      {editing === 'rename' ? (
        <RenameInput
          initial={node.name}
          busy={busy}
          onSubmit={(name) => (name === node.name ? setEdit(null) : void onRename(node.path, name))}
          onCancel={() => setEdit(null)}
        />
      ) : (
        <span className="file-tree-name">{isFolder ? `${node.name}/` : node.name}</span>
      )}
      {editing === 'delete' ? (
        <span className="file-tree-confirm" onClick={(e) => e.stopPropagation()}>
          Delete{isFolder ? ' folder' : ''}?
          <button type="button" className="file-tree-icon danger" disabled={busy} onClick={() => void onDelete(node.path)}>
            Yes
          </button>
          <button type="button" className="file-tree-icon" disabled={busy} onClick={() => setEdit(null)}>
            No
          </button>
        </span>
      ) : (
        !editing &&
        !isProtected && (
          <span className="file-tree-row-actions" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="file-tree-icon"
              title={`Rename ${node.name}`}
              aria-label={`Rename ${node.name}`}
              onClick={() => setEdit({ path: node.path, mode: 'rename' })}
            >
              ✎
            </button>
            <button
              type="button"
              className="file-tree-icon"
              title={`Delete ${node.name}`}
              aria-label={`Delete ${node.name}`}
              onClick={() => setEdit({ path: node.path, mode: 'delete' })}
            >
              ✕
            </button>
          </span>
        )
      )}
    </div>
  )

  if (!isFolder) return row
  return (
    <div>
      {row}
      {node.children?.map((child) => (
        <FileTreeNode key={child.path} {...props} node={child} depth={depth + 1} />
      ))}
    </div>
  )
}

function RenameInput(props: { initial: string; busy: boolean; onSubmit: (name: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(props.initial)
  const inputRef = useRef<HTMLInputElement>(null)

  // Select the stem so typing replaces the name but keeps the extension.
  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    const dot = props.initial.lastIndexOf('.')
    input.focus()
    input.setSelectionRange(0, dot > 0 ? dot : props.initial.length)
  }, [props.initial])

  return (
    <form
      className="file-tree-rename"
      onSubmit={(e) => {
        e.preventDefault()
        props.onSubmit(value.trim())
      }}
    >
      <input
        ref={inputRef}
        className="file-tree-input"
        value={value}
        aria-label="New name"
        disabled={props.busy}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && props.onCancel()}
      />
    </form>
  )
}
