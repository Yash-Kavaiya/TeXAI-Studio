import { buildTree } from './buildTree'
import { FileTreeNode } from './FileTreeNode'
import './FileTree.css'

interface FileTreeProps {
  files: { path: string }[]
  activePath: string
  onSelectFile: (path: string) => void
}

export function FileTree({ files, activePath, onSelectFile }: FileTreeProps) {
  const tree = buildTree(files)

  return (
    <div className="file-tree">
      {tree.map((node) => (
        <FileTreeNode key={node.path} node={node} activePath={activePath} onSelectFile={onSelectFile} depth={0} />
      ))}
    </div>
  )
}
