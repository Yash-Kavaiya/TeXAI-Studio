import type { LogEntry } from './types'

// pdfTeX logs file opens as "(path" and closes as ")", interleaved with
// everything else it prints. A token right after "(" is only treated as a
// file open if it looks like a path (starts with "/" or "." or contains a
// dotted extension before whitespace/paren) — this avoids misreading prose
// parentheticals like "(see the transcript file)" as file opens.
const FILENAME_LIKE_RE = /^([./]|.*\.[a-zA-Z0-9]{1,5}$)/

function looksLikeFilename(token: string): boolean {
  return FILENAME_LIKE_RE.test(token)
}

/** Scans the raw log character-by-character, tracking which file is
 * "currently open" at every position so errors/warnings can be attributed
 * to the right file even when they occur deep inside a nested \input. */
function buildFileContextMap(log: string): Map<number, string> {
  const contextAtIndex = new Map<number, string>()
  const stack: string[] = []
  let lastKnownFile: string | undefined

  for (let i = 0; i < log.length; i++) {
    const ch = log[i]
    if (ch === '(') {
      const tokenMatch = /^([^\s()]+)/.exec(log.slice(i + 1, i + 200))
      if (tokenMatch && looksLikeFilename(tokenMatch[1])) {
        stack.push(tokenMatch[1])
        lastKnownFile = tokenMatch[1]
      }
    } else if (ch === ')') {
      if (stack.length > 0) {
        stack.pop()
        lastKnownFile = stack[stack.length - 1]
      }
    }
    contextAtIndex.set(i, lastKnownFile ?? '')
  }
  return contextAtIndex
}

function fileAt(contextAtIndex: Map<number, string>, index: number): string | undefined {
  const file = contextAtIndex.get(index)
  return file ? normalizeFilePath(file) : undefined
}

/** The engine's VFS paths are absolute ("/tex/..." for package files,
 * "main.tex" for project files); strip the leading slash so paths line up
 * with the project's own file paths for jump-to-error. */
function normalizeFilePath(path: string): string {
  return path.startsWith('/') ? path.slice(1) : path
}

const FATAL_ERROR_RE = /^! (.+)$/
const LINE_REF_RE = /^l\.(\d+)/
const LATEX_WARNING_RE = /^LaTeX Warning: (.+?)(?: on input line (\d+)\.)?$/
const PACKAGE_WARNING_RE = /^Package (\S+) Warning: (.+?)(?: on input line (\d+)\.)?$/

export function parseLatexLog(log: string): LogEntry[] {
  const entries: LogEntry[] = []
  const lines = log.split('\n')
  const contextAtIndex = buildFileContextMap(log)

  let charIndex = 0
  const lineStartIndex: number[] = []
  for (const line of lines) {
    lineStartIndex.push(charIndex)
    charIndex += line.length + 1
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const file = fileAt(contextAtIndex, lineStartIndex[i])

    const fatalMatch = FATAL_ERROR_RE.exec(line)
    // Skip pdfTeX's generic "==> Fatal error occurred" summary line — it's
    // a content-free echo of whatever specific "!" error already fired.
    if (fatalMatch && !/^\s*==> Fatal error occurred/.test(fatalMatch[1])) {
      let lineNumber: number | undefined
      for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
        const lineRefMatch = LINE_REF_RE.exec(lines[j])
        if (lineRefMatch) {
          lineNumber = Number(lineRefMatch[1])
          break
        }
      }
      entries.push({
        level: 'error',
        file,
        line: lineNumber,
        message: fatalMatch[1],
        raw: line,
      })
      continue
    }

    const latexWarningMatch = LATEX_WARNING_RE.exec(line)
    if (latexWarningMatch) {
      entries.push({
        level: 'warning',
        file,
        line: latexWarningMatch[2] ? Number(latexWarningMatch[2]) : undefined,
        message: latexWarningMatch[1],
        raw: line,
      })
      continue
    }

    const packageWarningMatch = PACKAGE_WARNING_RE.exec(line)
    if (packageWarningMatch) {
      entries.push({
        level: 'warning',
        file,
        line: packageWarningMatch[3] ? Number(packageWarningMatch[3]) : undefined,
        message: `${packageWarningMatch[1]}: ${packageWarningMatch[2]}`,
        raw: line,
      })
    }
  }

  return entries
}
