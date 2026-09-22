import { useRef, useState } from 'react'
import { PdfTeXEngineClient } from '../engine/PdfTeXEngineClient'
import type { CompileResult } from '../engine/types'
import type { ProjectFile } from '../state/projectStore'
import { dirname } from '../utils/paths'

export function useCompile() {
  const [compiling, setCompiling] = useState(false)
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | undefined>(undefined)
  const [log, setLog] = useState<string>('')
  const engineRef = useRef<PdfTeXEngineClient | null>(null)

  async function compile(files: ProjectFile[], rootFile: string): Promise<CompileResult> {
    setCompiling(true)
    try {
      if (!engineRef.current) {
        engineRef.current = new PdfTeXEngineClient()
        await engineRef.current.loadEngine()
        engineRef.current.setTexliveEndpoint(`${window.location.origin}/texlive-pkgs/`)
      }
      const engine = engineRef.current

      const dirs = new Set<string>()
      for (const file of files) {
        const dir = dirname(file.path)
        if (dir) dirs.add(dir)
      }
      for (const dir of [...dirs].sort((a, b) => a.split('/').length - b.split('/').length)) {
        engine.makeMemFSFolder(dir)
      }
      for (const file of files) {
        engine.writeMemFSFile(file.path, file.content)
      }
      engine.setEngineMainFile(rootFile)

      const result = await engine.compileLaTeX()
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
