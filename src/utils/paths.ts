/** Directory portion of a path, or '' if the path has no directory component. */
export function dirname(path: string): string {
  const idx = path.lastIndexOf('/')
  return idx === -1 ? '' : path.slice(0, idx)
}
