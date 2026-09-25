import { useEffect, useState } from 'react'
import './BinaryFilePreview.css'

interface BinaryFilePreviewProps {
  path: string
  data: Uint8Array
}

const IMAGE_MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' }

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** Shown in place of the text editor for images: a preview (PNG/JPEG) plus
 * the \includegraphics line to reference the file from LaTeX. */
export function BinaryFilePreview({ path, data }: BinaryFilePreviewProps) {
  const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase()
  const mime = IMAGE_MIME[ext]
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!mime) return
    const objectUrl = URL.createObjectURL(new Blob([data.slice()], { type: mime }))
    // eslint-disable-next-line react/set-state-in-effect
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [data, mime])

  const graphicsPath = path.replace(/\.(png|jpe?g|pdf)$/i, '')

  return (
    <div className="binary-preview">
      <div className="binary-preview-meta">
        <strong>{path}</strong> · {formatSize(data.byteLength)}
      </div>
      <code className="binary-preview-snippet">\includegraphics[width=\linewidth]{`{${graphicsPath}}`}</code>
      {mime && url ? (
        <img className="binary-preview-image" src={url} alt={path} />
      ) : (
        <div className="binary-preview-note">PDF graphics are embedded at compile time; no inline preview.</div>
      )}
    </div>
  )
}
