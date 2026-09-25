import { useRef, useState } from 'react'
import { buildTree } from './buildTree'
import { FileTreeNode } from './FileTreeNode'
import './FileTree.css'

interface FileTreeProps {
  files: { path: string }[]
  activePath: string
  onSelectFile: (path: string) => void
  /** Accepted file extensions for the upload picker, e.g. ".png,.tex". */
  uploadAccept: string
  /** Resolves to the names of any files that were skipped as unsupported. */
  onUpload: (files: File[]) => Promise<string[]>
}

export function FileTree({ files, activePath, onSelectFile, uploadAccept, onUpload }: FileTreeProps) {
  const tree = buildTree(files)
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  async function handlePicked(list: FileList | null) {
    if (!list || list.length === 0) return
    setUploading(true)
    setNotice(null)
    try {
      const skipped = await onUpload([...list])
      if (skipped.length > 0) setNotice(`Skipped unsupported: ${skipped.join(', ')}`)
    } catch (err) {
      setNotice(`Upload failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setUploading(false)
      // Reset so picking the same file again still fires onChange.
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="file-tree">
      <div className="file-tree-header">
        <span>Files</span>
        <button
          type="button"
          className="file-tree-upload"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          title="Upload images (PNG, JPG, PDF) or .tex/.bib/.sty/.cls files"
        >
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={uploadAccept}
          hidden
          onChange={(e) => void handlePicked(e.target.files)}
        />
      </div>
      {notice && <div className="file-tree-notice">{notice}</div>}
      {tree.map((node) => (
        <FileTreeNode key={node.path} node={node} activePath={activePath} onSelectFile={onSelectFile} depth={0} />
      ))}
    </div>
  )
}
