import { snippetCompletion, type Completion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete'

/** Labels and citation keys defined anywhere in the project, for \ref/\cite. */
export interface ProjectSymbols {
  labels: string[]
  citeKeys: string[]
}

const ENVIRONMENTS = [
  'itemize', 'enumerate', 'description', 'equation', 'equation*', 'align', 'align*', 'gather', 'multline',
  'figure', 'table', 'tabular', 'center', 'abstract', 'quote', 'verbatim', 'theorem', 'proof', 'lemma',
  'definition', 'frame', 'columns', 'block', 'minipage', 'cases', 'matrix', 'pmatrix', 'bmatrix', 'algorithmic',
]

const COMMANDS: Completion[] = [
  ...['section', 'subsection', 'subsubsection', 'paragraph', 'chapter', 'part'].map((name) =>
    snippetCompletion(`\\${name}{\${title}}`, { label: `\\${name}`, type: 'keyword', detail: 'heading' }),
  ),
  ...['textbf', 'textit', 'emph', 'underline', 'texttt', 'textsc', 'mathbf', 'mathrm', 'mathcal', 'mathbb'].map(
    (name) => snippetCompletion(`\\${name}{\${}}`, { label: `\\${name}`, type: 'function', detail: 'format' }),
  ),
  snippetCompletion('\\frac{${num}}{${den}}', { label: '\\frac', type: 'function', detail: 'math' }),
  snippetCompletion('\\sqrt{${}}', { label: '\\sqrt', type: 'function', detail: 'math' }),
  snippetCompletion('\\label{${key}}', { label: '\\label', type: 'function' }),
  snippetCompletion('\\ref{${key}}', { label: '\\ref', type: 'function' }),
  snippetCompletion('\\cref{${key}}', { label: '\\cref', type: 'function' }),
  snippetCompletion('\\eqref{${key}}', { label: '\\eqref', type: 'function' }),
  snippetCompletion('\\cite{${key}}', { label: '\\cite', type: 'function' }),
  snippetCompletion('\\citep{${key}}', { label: '\\citep', type: 'function' }),
  snippetCompletion('\\input{${file}}', { label: '\\input', type: 'function' }),
  snippetCompletion('\\include{${file}}', { label: '\\include', type: 'function' }),
  snippetCompletion('\\usepackage{${package}}', { label: '\\usepackage', type: 'function' }),
  snippetCompletion('\\includegraphics[width=\\linewidth]{${file}}', { label: '\\includegraphics', type: 'function' }),
  snippetCompletion('\\caption{${text}}', { label: '\\caption', type: 'function' }),
  snippetCompletion('\\footnote{${text}}', { label: '\\footnote', type: 'function' }),
  snippetCompletion('\\url{${url}}', { label: '\\url', type: 'function' }),
  snippetCompletion('\\href{${url}}{${text}}', { label: '\\href', type: 'function' }),
  ...['item', 'centering', 'maketitle', 'tableofcontents', 'newpage', 'clearpage', 'noindent', 'hline', 'toprule',
    'midrule', 'bottomrule', 'today', 'LaTeX', 'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'theta', 'lambda',
    'mu', 'pi', 'sigma', 'phi', 'omega', 'sum', 'int', 'infty', 'partial', 'nabla', 'cdot', 'times', 'leq', 'geq',
    'neq', 'approx', 'rightarrow', 'Rightarrow', 'ldots', 'quad'].map((name) => ({ label: `\\${name}`, type: 'keyword' })),
  ...ENVIRONMENTS.map((env) =>
    snippetCompletion(`\\begin{${env}}\n\t\${}\n\\end{${env}}`, { label: `\\begin{${env}}`, type: 'class', detail: 'environment' }),
  ),
]

const REF_COMMAND_RE = /\\(?:ref|cref|Cref|eqref|autoref|pageref|nameref)\{([^}]*)$/
const CITE_COMMAND_RE = /\\(?:cite|citep|citet|citealp|citeauthor|citeyear|nocite)(?:\[[^\]]*\])*\{(?:[^}]*,)?\s*([^,}]*)$/

/** Builds a completion source. `getSymbols` is read lazily on each request so
 * the latest labels/keys across all project files are offered. */
export function latexCompletionSource(getSymbols: () => ProjectSymbols) {
  return (context: CompletionContext): CompletionResult | null => {
    const line = context.state.doc.lineAt(context.pos)
    const before = line.text.slice(0, context.pos - line.from)

    const ref = REF_COMMAND_RE.exec(before)
    if (ref) {
      return {
        from: context.pos - ref[1].length,
        options: getSymbols().labels.map((label) => ({ label, type: 'variable', detail: 'label' })),
        validFor: /^[^},]*$/,
      }
    }
    const cite = CITE_COMMAND_RE.exec(before)
    if (cite) {
      return {
        from: context.pos - cite[1].length,
        options: getSymbols().citeKeys.map((key) => ({ label: key, type: 'text', detail: 'bib' })),
        validFor: /^[^},\s]*$/,
      }
    }

    const word = context.matchBefore(/\\[A-Za-z]*/)
    if (!word || (word.from === word.to && !context.explicit)) return null
    return { from: word.from, options: COMMANDS, validFor: /^\\[A-Za-z]*$/ }
  }
}

/** Scans project sources for \label{…} names and .bib entry keys. */
export function collectProjectSymbols(files: { path: string; content: string }[]): ProjectSymbols {
  const labels = new Set<string>()
  const citeKeys = new Set<string>()
  for (const file of files) {
    if (file.path.endsWith('.tex')) {
      for (const m of file.content.matchAll(/\\label\{([^}]+)\}/g)) labels.add(m[1])
    } else if (file.path.endsWith('.bib')) {
      for (const m of file.content.matchAll(/@\w+\s*\{\s*([^,\s]+)\s*,/g)) citeKeys.add(m[1])
    }
  }
  return { labels: [...labels].sort(), citeKeys: [...citeKeys].sort() }
}
