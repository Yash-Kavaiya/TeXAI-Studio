import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { EditorState, Prec } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { searchKeymap } from '@codemirror/search'
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete'
import { bracketMatching, defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { latexLanguage } from './latexLanguage'
import { latexCompletionSource, type ProjectSymbols } from './latexCompletions'
import './Editor.css'

export interface EditorHandle {
  jumpToLine: (line: number) => void
}

interface EditorProps {
  value: string
  onChange: (value: string) => void
  /** Labels and citation keys across the project, offered inside \ref{} / \cite{}. */
  getSymbols: () => ProjectSymbols
  /** Ctrl/Cmd+S and Ctrl/Cmd+Enter. */
  onCompileShortcut: () => void
}

export const Editor = forwardRef<EditorHandle, EditorProps>(function Editor({ value, onChange, getSymbols, onCompileShortcut }, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  // Read through refs so the once-mounted editor always sees the latest props.
  const getSymbolsRef = useRef(getSymbols)
  getSymbolsRef.current = getSymbols
  const onCompileRef = useRef(onCompileShortcut)
  onCompileRef.current = onCompileShortcut

  useImperativeHandle(
    ref,
    () => ({
      jumpToLine(lineNumber: number) {
        const view = viewRef.current
        if (!view) return
        const clamped = Math.min(Math.max(lineNumber, 1), view.state.doc.lines)
        const line = view.state.doc.line(clamped)
        view.dispatch({
          selection: { anchor: line.from, head: line.to },
          effects: EditorView.scrollIntoView(line.from, { y: 'center' }),
        })
        view.focus()
      },
    }),
    [],
  )

  useEffect(() => {
    if (!containerRef.current) return

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        history(),
        bracketMatching(),
        closeBrackets(),
        // Pair only brackets: quotes/apostrophes are ordinary prose in LaTeX.
        EditorState.languageData.of(() => [{ closeBrackets: { brackets: ['(', '[', '{'] } }]),
        autocompletion({ override: [latexCompletionSource(() => getSymbolsRef.current())] }),
        Prec.highest(
          keymap.of([
            { key: 'Mod-s', preventDefault: true, run: () => (onCompileRef.current(), true) },
            { key: 'Mod-Enter', preventDefault: true, run: () => (onCompileRef.current(), true) },
          ]),
        ),
        latexLanguage,
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        keymap.of([...closeBracketsKeymap, ...completionKeymap, ...defaultKeymap, ...historyKeymap, ...searchKeymap]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString())
          }
        }),
        EditorView.theme({
          '&': { height: '100%' },
          '.cm-scroller': { fontFamily: 'var(--mono)', fontSize: '13px', overflow: 'auto' },
        }),
      ],
    })

    const view = new EditorView({ state, parent: containerRef.current })
    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
    // Editor is mounted once; external value changes are synced by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep the editor in sync when `value` changes from outside (e.g. switching
  // the active file), without clobbering the doc on every local keystroke.
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== value) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } })
    }
  }, [value])

  return <div ref={containerRef} className="editor-container" />
})
