import { useEffect, useRef, useState } from 'react'
import { getDocument, type PDFDocumentProxy } from 'pdfjs-dist'
import './pdfjsSetup'
import './PdfPreview.css'

interface PdfPreviewProps {
  pdfBytes: Uint8Array | undefined
  /** Name for the Download button's file, without extension. */
  fileName: string
}

const ZOOM_STEP = 0.1
const MIN_ZOOM = 0.25
const MAX_ZOOM = 4
// Horizontal padding inside the scroll area (see .pdf-preview-pages).
const PAGE_GUTTER = 32

export function PdfPreview({ pdfBytes, fileName }: PdfPreviewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const pagesRef = useRef<HTMLDivElement>(null)
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  // Width of page 1 at 100%, used to compute the fit-to-width scale.
  const [pageWidth, setPageWidth] = useState(0)
  const [containerWidth, setContainerWidth] = useState(0)
  const [zoom, setZoom] = useState<'fit' | number>('fit')

  // Parse each new PDF once; zoom changes only re-render its pages.
  useEffect(() => {
    if (!pdfBytes) return
    let cancelled = false
    // pdf.js detaches/transfers the buffer it's given, so hand it a copy.
    const loadingTask = getDocument({ data: pdfBytes.slice() })
    loadingTask.promise
      .then(async (loaded) => {
        const firstPage = await loaded.getPage(1)
        if (cancelled) return
        setPageWidth(firstPage.getViewport({ scale: 1 }).width)
        setDoc(loaded)
      })
      .catch((err) => {
        if (!cancelled) console.error('[pdf-preview] load failed', err)
      })
    return () => {
      cancelled = true
      // destroy() (unlike doc.cleanup()) cancels in-flight page renders and
      // terminates this document's pdf.js worker — otherwise every compile
      // leaks a worker. Already-drawn canvases stay on screen until the next
      // document replaces them, so recompiling doesn't flash an empty pane.
      loadingTask.destroy().catch(() => {})
    }
  }, [pdfBytes])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const observer = new ResizeObserver(() => setContainerWidth(el.clientWidth))
    observer.observe(el)
    return () => observer.disconnect()
  }, [pdfBytes])

  const fitScale = pageWidth > 0 && containerWidth > 0 ? (containerWidth - PAGE_GUTTER) / pageWidth : 1
  const scale = clamp(zoom === 'fit' ? fitScale : zoom)
  // Round so sub-pixel resize jitter doesn't trigger a re-render.
  const renderScale = Math.round(scale * 100) / 100

  useEffect(() => {
    const pages = pagesRef.current
    const scroller = scrollRef.current
    if (!doc || !pages || !scroller) return
    let cancelled = false
    const pixelRatio = window.devicePixelRatio || 1

    async function render(pdf: PDFDocumentProxy) {
      const canvases: HTMLCanvasElement[] = []
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum)
        if (cancelled) return
        const viewport = page.getViewport({ scale: renderScale })
        const canvas = document.createElement('canvas')
        canvas.className = 'pdf-preview-page'
        // Back the canvas with device pixels so text stays sharp on HiDPI screens.
        canvas.width = Math.floor(viewport.width * pixelRatio)
        canvas.height = Math.floor(viewport.height * pixelRatio)
        canvas.style.width = `${Math.floor(viewport.width)}px`
        canvas.style.height = `${Math.floor(viewport.height)}px`
        await page.render({
          canvas,
          canvasContext: canvas.getContext('2d')!,
          viewport,
          transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0],
        }).promise
        if (cancelled) return
        canvases.push(canvas)
      }
      // Swap all pages at once, keeping the reader at the same relative spot.
      const ratio = scroller!.scrollHeight > 0 ? scroller!.scrollTop / scroller!.scrollHeight : 0
      pages!.replaceChildren(...canvases)
      scroller!.scrollTop = ratio * scroller!.scrollHeight
    }

    render(doc).catch((err) => {
      if (!cancelled) console.error('[pdf-preview] render failed', err)
    })
    return () => {
      cancelled = true
    }
  }, [doc, renderScale])

  function download() {
    if (!pdfBytes) return
    const url = URL.createObjectURL(new Blob([pdfBytes.slice()], { type: 'application/pdf' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `${fileName || 'document'}.pdf`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  if (!pdfBytes) {
    return <div className="pane-placeholder">Compile to see a PDF preview</div>
  }

  return (
    <div className="pdf-preview">
      <div className="pdf-preview-toolbar">
        <button type="button" onClick={() => setZoom(clamp(scale - ZOOM_STEP))} aria-label="Zoom out" title="Zoom out">
          −
        </button>
        <span className="pdf-preview-zoom" aria-live="polite">
          {Math.round(scale * 100)}%
        </span>
        <button type="button" onClick={() => setZoom(clamp(scale + ZOOM_STEP))} aria-label="Zoom in" title="Zoom in">
          +
        </button>
        <button
          type="button"
          className={zoom === 'fit' ? 'active' : undefined}
          onClick={() => setZoom('fit')}
          title="Fit page width to the pane"
        >
          Fit width
        </button>
        <div className="pdf-preview-spacer" />
        <button type="button" onClick={download} title="Download the compiled PDF">
          Download PDF
        </button>
      </div>
      <div ref={scrollRef} className="pdf-preview-scroll">
        <div ref={pagesRef} className="pdf-preview-pages" />
      </div>
    </div>
  )
}

function clamp(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 100) / 100))
}
