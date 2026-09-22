import { StreamLanguage } from '@codemirror/language'
import { stex } from '@codemirror/legacy-modes/mode/stex'

// CodeMirror 6 has no official first-party LaTeX grammar yet; the CM5-era
// stex stream-parser (maintained by the CodeMirror project under
// legacy-modes) gives real token-based highlighting with no custom grammar
// work. A proper Lezer grammar is a reasonable post-v1 upgrade.
export const latexLanguage = StreamLanguage.define(stex)
