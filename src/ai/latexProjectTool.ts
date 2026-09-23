// zod-to-json-schema only understands Zod v3-shaped schemas. The installed
// `zod` resolves to v4, whose internal schema representation is different —
// feeding it a v4-built schema silently produces an EMPTY JSON schema (no
// properties at all, verified empirically), not an error. Zod v4 ships a
// `zod/v3` compat build specifically for this; import from there instead.
import { z } from 'zod/v3'

export const LatexFileEntrySchema = z
  .object({
    path: z
      .string()
      .describe(
        "Relative path from project root, forward slashes. Folder markers use a trailing slash " +
          "with empty content, e.g. 'figures/'. Examples: 'main.tex', 'sections/introduction.tex', " +
          "'references.bib', 'figures/'.",
      ),
    content: z.string().describe('Full file content; empty string for folder markers.'),
  })
  .strict()

export const CreateLatexProjectInputSchema = z
  .object({
    project_name: z.string().describe("Short human-readable name, e.g. 'IEEE Computer Vision Paper'."),
    summary: z.string().describe('1-3 sentence plain-language summary shown in the chat UI.'),
    document_class: z
      .string()
      .describe("LaTeX class used, e.g. 'IEEEtran', 'acmart', 'llncs', 'article'."),
    files: z
      .array(LatexFileEntrySchema)
      .min(1)
      .describe(
        'All project files/folders. Must include a compileable main.tex that \\input/\\include every ' +
          'sections/*.tex file, and a references.bib if \\cite is used anywhere.',
      ),
  })
  .strict()

export type CreateLatexProjectInput = z.infer<typeof CreateLatexProjectInputSchema>
