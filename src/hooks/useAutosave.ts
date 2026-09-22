import { useEffect } from 'react'
import { updateFileContent } from '../storage/filesRepo'
import type { ProjectFile } from '../state/projectStore'

const AUTOSAVE_DELAY_MS = 800

/** Debounced write-through from the in-memory project store to IndexedDB.
 * Re-arms on every keystroke (via the `files` array changing) and only
 * actually persists once typing pauses. */
export function useAutosave(files: ProjectFile[]) {
  useEffect(() => {
    if (files.length === 0) return
    const timer = setTimeout(() => {
      const now = new Date().toISOString()
      for (const file of files) {
        void updateFileContent(file.id, file.content, now)
      }
    }, AUTOSAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [files])
}
