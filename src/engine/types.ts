export type EngineStatus = 'init' | 'ready' | 'busy' | 'error'

export interface CompileResult {
  status: number
  log: string
  pdf?: Uint8Array
}

export interface EngineFile {
  path: string
  content: string | Uint8Array
}

export type LogLevel = 'error' | 'warning'

export interface LogEntry {
  level: LogLevel
  file?: string
  line?: number
  message: string
  raw: string
}
