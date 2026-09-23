import { buildTree, type TreeNode } from '../FileTree/buildTree'
import './FileTreePreview.css'

interface FileTreePreviewProps {
  files: { path: string }[]
}

export function FileTreePreview({ files }: FileTreePreviewProps) {
  const tree = buildTree(files)
  return (
    <div className="file-tree-preview">
      {tree.map((node) => (
        <PreviewNode key={node.path} node={node} depth={0} />
      ))}
    </div>
  )
}

function PreviewNode({ node, depth }: { node: TreeNode; depth: number }) {
  const style = { paddingLeft: `${depth * 14}px` }
  if (node.type === 'folder') {
    return (
      <div>
        <div className="file-tree-preview-folder" style={style}>
          {node.name}/
        </div>
        {node.children?.map((child) => (
          <PreviewNode key={child.path} node={child} depth={depth + 1} />
        ))}
      </div>
    )
  }
  return (
    <div className="file-tree-preview-file" style={style}>
      {node.name}
    </div>
  )
}
