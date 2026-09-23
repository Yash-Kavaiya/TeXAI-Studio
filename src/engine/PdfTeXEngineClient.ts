import type { CompileResult, EngineStatus } from './types'

const ENGINE_WORKER_PATH = '/texlive/swiftlatexpdftex.js'

interface EngineMessage {
  result?: 'ok' | 'failed'
  cmd?: string
  log?: string
  status?: number
  pdf?: ArrayBuffer
}

/**
 * Thin TypeScript client for the vendored SwiftLaTeX pdfTeX WASM worker
 * (public/texlive/swiftlatexpdftex.js + .wasm). Reimplements the small
 * postMessage protocol used by SwiftLaTeX's own PdfTeXEngine.js wrapper
 * rather than loading that file as a second classic script.
 */
export class PdfTeXEngineClient {
  private worker: Worker | undefined
  private status: EngineStatus = 'init'

  async loadEngine(): Promise<void> {
    if (this.worker !== undefined) {
      throw new Error('Engine already loaded')
    }
    this.status = 'init'
    await new Promise<void>((resolve, reject) => {
      const worker = new Worker(ENGINE_WORKER_PATH)
      worker.onmessage = (ev: MessageEvent<EngineMessage>) => {
        if (ev.data.result === 'ok') {
          this.status = 'ready'
          resolve()
        } else {
          this.status = 'error'
          reject(new Error('Failed to load pdfTeX engine'))
        }
      }
      worker.onerror = (ev) => {
        this.status = 'error'
        reject(new Error(`pdfTeX worker error: ${ev.message}`))
      }
      this.worker = worker
    })
  }

  isReady(): boolean {
    return this.status === 'ready'
  }

  private requireWorker(): Worker {
    if (this.status !== 'ready' || this.worker === undefined) {
      throw new Error('Engine is not ready yet')
    }
    return this.worker
  }

  setTexliveEndpoint(url: string): void {
    this.requireWorker().postMessage({ cmd: 'settexliveurl', url })
  }

  setEngineMainFile(filename: string): void {
    this.requireWorker().postMessage({ cmd: 'setmainfile', url: filename })
  }

  writeMemFSFile(filename: string, content: string | Uint8Array): void {
    this.requireWorker().postMessage({ cmd: 'writefile', url: filename, src: content })
  }

  /** Clears the engine's working directory (project files, .aux, .bbl…)
   * while keeping the downloaded TeX package cache. */
  flushWorkDir(): void {
    this.requireWorker().postMessage({ cmd: 'flushcache' })
  }

  makeMemFSFolder(folder: string): void {
    if (folder === '' || folder === '/') return
    this.requireWorker().postMessage({ cmd: 'mkdir', url: folder })
  }

  async compileLaTeX(): Promise<CompileResult> {
    const worker = this.requireWorker()
    this.status = 'busy'
    const result = await new Promise<CompileResult>((resolve) => {
      worker.onmessage = (ev: MessageEvent<EngineMessage>) => {
        const data = ev.data
        if (data.cmd !== 'compile') return
        this.status = 'ready'
        resolve({
          status: data.status ?? -254,
          log: data.log ?? 'No log',
          pdf: data.pdf ? new Uint8Array(data.pdf) : undefined,
        })
      }
      worker.postMessage({ cmd: 'compilelatex' })
    })
    return result
  }

  dispose(): void {
    this.worker?.postMessage({ cmd: 'grace' })
    this.worker = undefined
    this.status = 'init'
  }
}
