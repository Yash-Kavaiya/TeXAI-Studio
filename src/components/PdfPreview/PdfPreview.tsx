import { useEffect, useRef } from 'react'
import { getDocument } from 'pdfjs-dist'
import './pdfjsSetup'
import './PdfPreview.css'

interface PdfPreviewProps {
  pdfBytes: Uint8Array | undefined
}

export function PdfPreview({ pdfBytes }: PdfPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!pdfBytes || !containerRef.current) return

    let cancelled = false
    // pdf.js detaches/transfers the buffer it's given, so hand it a copy.
    const loadingTask = getDocument({ data: pdfBytes.slice() })

    async function render() {
      const doc = await loadingTask.promise
      if (cancelled) return

      const container = containerRef.current!
      container.innerHTML = ''

      for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
        const page = await doc.getPage(pageNum)
        if (cancelled) return

        const viewport = page.getViewport({ scale: 1.5 })
        const canvas = document.createElement('canvas')
        canvas.className = 'pdf-preview-page'
        canvas.width = viewport.width
        canvas.height = viewport.height
        container.appendChild(canvas)

        const context = canvas.getContext('2d')!
        await page.render({ canvasContext: context, viewport, canvas }).promise
      }
    }

    render().catch((err) => {
      if (!cancelled) console.error('[pdf-preview] render failed', err)
    })

    return () => {
      cancelled = true
      // destroy() (unlike doc.cleanup()) cancels in-flight page renders and
      // terminates this document's pdf.js worker — otherwise every compile
      // leaks a worker.
      loadingTask.destroy().catch(() => {})
    }
  }, [pdfBytes])

  if (!pdfBytes) {
    return <div className="pane-placeholder">Compile to see a PDF preview</div>
  }

  return <div ref={containerRef} className="pdf-preview" />
}
