import { useRef, useState } from 'react'
import { PdfTeXEngineClient } from '../engine/PdfTeXEngineClient'
import type { CompileResult } from '../engine/types'
import type { ProjectFile } from '../state/projectStore'
import { dirname } from '../utils/paths'

const TEXLIVE_PKGS_PATH = '/texlive-pkgs/'
const MAX_PASSES = 3
// Resolving \cite/\ref needs repeated passes (latex → bibtex → latex → latex);
// these log lines are pdfTeX/LaTeX telling us another pass would change output.
const RERUN_PATTERN =
  /Rerun to get|There were undefined (references|citations)|Label\(s\) may have changed|Citation `[^']*' on page \d+ undefined|No file [^\s]+\.bbl/

// BibTeX in the vendored engine never calls the remote package hook, so it
// can only read .bst files already in the working directory — we put them there.
function findBibStyles(files: ProjectFile[]): string[] {
  const styles = new Set<string>()
  for (const file of files) {
    if (!file.path.endsWith('.tex')) continue
    for (const match of file.content.matchAll(/\\bibliographystyle\{([^}]+)\}/g)) {
      styles.add(match[1].trim())
    }
  }
  return [...styles].filter((style) => !files.some((f) => f.path === `${style}.bst`))
}

export function useCompile() {
  const [compiling, setCompiling] = useState(false)
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | undefined>(undefined)
  const [log, setLog] = useState<string>('')
  const engineRef = useRef<PdfTeXEngineClient | null>(null)
  const lastProjectIdRef = useRef<string | null>(null)
  const bstCacheRef = useRef(new Map<string, string | null>())

  async function fetchBibStyle(style: string): Promise<string | null> {
    const cache = bstCacheRef.current
    if (!cache.has(style)) {
      // Mirror filenames are all lowercase (see the worker's case-folded lookups).
      const res = await fetch(`${TEXLIVE_PKGS_PATH}bst/${encodeURIComponent(style.toLowerCase())}.bst`)
      cache.set(style, res.ok ? await res.text() : null)
    }
    return cache.get(style) ?? null
  }

  async function compile(projectId: string, files: ProjectFile[], rootFile: string): Promise<CompileResult> {
    setCompiling(true)
    try {
      if (!engineRef.current) {
        engineRef.current = new PdfTeXEngineClient()
        await engineRef.current.loadEngine()
        engineRef.current.setTexliveEndpoint(`${window.location.origin}${TEXLIVE_PKGS_PATH}`)
      }
      const engine = engineRef.current

      // Stale .aux/.bbl/section files from a previously compiled project
      // would otherwise leak into this one's working directory.
      if (lastProjectIdRef.current !== projectId) {
        engine.flushWorkDir()
        lastProjectIdRef.current = projectId
      }

      const dirs = new Set<string>()
      for (const file of files) {
        const dir = file.path.endsWith('/') ? file.path.slice(0, -1) : dirname(file.path)
        const segments = dir ? dir.split('/') : []
        for (let i = 1; i <= segments.length; i++) dirs.add(segments.slice(0, i).join('/'))
      }
      for (const dir of [...dirs].sort((a, b) => a.split('/').length - b.split('/').length)) {
        engine.makeMemFSFolder(dir)
      }
      for (const file of files) {
        if (!file.path.endsWith('/')) engine.writeMemFSFile(file.path, file.data ?? file.content)
      }
      for (const style of findBibStyles(files)) {
        const bst = await fetchBibStyle(style)
        if (bst) engine.writeMemFSFile(`${style}.bst`, bst)
      }
      engine.setEngineMainFile(rootFile)

      let result = await engine.compileLaTeX()
      for (let pass = 1; pass < MAX_PASSES && result.status === 0 && RERUN_PATTERN.test(result.log); pass++) {
        result = await engine.compileLaTeX()
      }

      setLog(result.log)
      if (result.status === 0 && result.pdf) {
        setPdfBytes(result.pdf)
      } else {
        console.error('[compile] failed, status:', result.status, result.log)
      }
      return result
    } finally {
      setCompiling(false)
    }
  }

  return { compile, compiling, pdfBytes, log }
}
