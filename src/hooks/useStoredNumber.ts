import { useCallback, useState } from 'react'

/** A number remembered in localStorage (a per-browser UI preference). Storage
 * can be unavailable (private mode, blocked site data), so every access is
 * guarded and falls back to `initial`. */
export function useStoredNumber(key: string, initial: number): [number, (value: number) => void] {
  const [value, setValue] = useState(() => {
    try {
      const stored = Number(localStorage.getItem(key))
      return localStorage.getItem(key) !== null && Number.isFinite(stored) ? stored : initial
    } catch {
      return initial
    }
  })

  const store = useCallback(
    (next: number) => {
      setValue(next)
      try {
        localStorage.setItem(key, String(next))
      } catch {
        // Not persisted this session; the in-memory value still applies.
      }
    },
    [key],
  )

  return [value, store]
}
