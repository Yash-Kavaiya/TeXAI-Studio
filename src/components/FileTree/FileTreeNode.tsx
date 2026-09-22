import type { TreeNode } from './buildTree'

interface FileTreeNodeProps {
  node: TreeNode
  activePath: string
  onSelectFile: (path: string) => void
  depth: number
}

export function FileTreeNode({ node, activePath, onSelectFile, depth }: FileTreeNodeProps) {
  const style = { paddingLeft: `${depth * 14 + 8}px` }

  if (node.type === 'folder') {
    return (
      <div>
        <div className="file-tree-folder" style={style}>
          {node.name}/
        </div>
        {node.children?.map((child) => (
          <FileTreeNode
            key={child.path}
            node={child}
            activePath={activePath}
            onSelectFile={onSelectFile}
            depth={depth + 1}
          />
        ))}
      </div>
    )
  }

  return (
    <div
      className={`file-tree-file${node.path === activePath ? ' active' : ''}`}
      style={style}
      onClick={() => onSelectFile(node.path)}
    >
      {node.name}
    </div>
  )
}
