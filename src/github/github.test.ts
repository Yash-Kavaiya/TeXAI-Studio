import { describe, expect, it } from 'vitest'
import { base64ToBytes, bytesToBase64, gitBlobSha, utf8 } from './encoding'
import { parseRepoRef, type TreeEntry } from './githubApi'
import { planPush } from './pushPlan'
import { WORKFLOW_PATH, buildPdfWorkflow, pdfOutputPath } from './workflowTemplate'
import { filesFromEntries } from '../storage/projectZip'

const blob = async (path: string, text: string): Promise<TreeEntry> => ({
  path,
  mode: '100644',
  type: 'blob',
  sha: await gitBlobSha(utf8(text)),
})

describe('encoding', () => {
  it('computes git blob SHAs like `git hash-object`', async () => {
    // printf 'hello\n' | git hash-object --stdin
    expect(await gitBlobSha(utf8('hello\n'))).toBe('ce013625030ba8dba906f756967f9e9ca394464a')
    // git hash-object /dev/null
    expect(await gitBlobSha(new Uint8Array())).toBe('e69de29bb2d1d6434b8b29ae775ad8c2e48c5391')
  })

  it('round-trips base64, including GitHub’s line-wrapped form', () => {
    const bytes = new Uint8Array(200_000).map((_, i) => i % 256)
    const b64 = bytesToBase64(bytes)
    const wrapped = b64.replace(/(.{60})/g, '$1\n')
    expect(base64ToBytes(wrapped)).toEqual(bytes)
  })
})

describe('parseRepoRef', () => {
  it.each([
    ['octo/paper', { owner: 'octo', repo: 'paper' }],
    ['https://github.com/octo/paper', { owner: 'octo', repo: 'paper' }],
    ['https://github.com/octo/paper.git', { owner: 'octo', repo: 'paper' }],
    ['github.com/octo/my.paper/tree/main/doc', { owner: 'octo', repo: 'my.paper' }],
  ])('parses %s', (input, expected) => {
    expect(parseRepoRef(input)).toEqual(expected)
  })

  it('rejects garbage', () => {
    expect(parseRepoRef('not a repo')).toBeNull()
  })
})

describe('planPush', () => {
  it('uploads only new or changed files', async () => {
    const remote = [await blob('main.tex', 'same'), await blob('refs.bib', 'old')]
    const plan = await planPush({
      files: [
        { path: 'main.tex', content: 'same' },
        { path: 'refs.bib', content: 'new' },
        { path: 'sections/intro.tex', content: 'intro' },
        { path: 'figures/', content: '' },
      ],
      remote,
      dir: '',
    })
    expect(plan.upserts.map((u) => [u.path, u.existed]).sort()).toEqual([
      ['refs.bib', true],
      ['sections/intro.tex', false],
    ])
    expect(plan.deletes).toEqual([])
  })

  it('deletes removed project files but leaves other repo files alone', async () => {
    const remote = [
      await blob('main.tex', 'x'),
      await blob('old.tex', 'gone'),
      await blob('README.md', 'readme'),
      await blob('src/app.js', 'code'),
      await blob('main.pdf', 'pdf'),
    ]
    const plan = await planPush({
      files: [{ path: 'main.tex', content: 'x' }],
      remote,
      dir: '',
      keep: ['main.pdf'],
    })
    expect(plan.deletes).toEqual(['old.tex'])
    expect(plan.deletes).not.toContain('src/app.js')
    expect(plan.deletes).not.toContain('main.pdf')
  })

  it('scopes paths and deletions to the project folder', async () => {
    const remote = [await blob('paper/main.tex', 'a'), await blob('paper/old.tex', 'b'), await blob('other/x.tex', 'c')]
    const plan = await planPush({
      files: [{ path: 'main.tex', content: 'changed' }],
      extras: [{ path: WORKFLOW_PATH, bytes: utf8('wf') }],
      remote,
      dir: 'paper',
    })
    expect(plan.upserts.map((u) => u.path).sort()).toEqual([WORKFLOW_PATH, 'paper/main.tex'])
    expect(plan.deletes).toEqual(['paper/old.tex'])
  })

  it('commits binary files byte-for-byte', async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47])
    const plan = await planPush({ files: [{ path: 'fig.png', content: '', data: png }], remote: [], dir: '' })
    expect(plan.upserts[0].bytes).toBe(png)
  })
})

describe('buildPdfWorkflow', () => {
  it('builds the root file at the repo root', () => {
    const yml = buildPdfWorkflow({ rootFile: 'main.tex', dir: '', branch: 'main' })
    expect(yml).toContain("branches: ['main']")
    expect(yml).toContain("root_file: 'main.tex'")
    expect(yml).toContain("working_directory: '.'")
    expect(yml).toContain("path: 'main.pdf'")
    expect(yml).toContain('softprops/action-gh-release')
    expect(yml).not.toContain('paths:')
  })

  it('handles a project folder and a nested root file', () => {
    const yml = buildPdfWorkflow({ rootFile: 'src/thesis.tex', dir: 'docs', branch: "it's" })
    expect(yml).toContain("branches: ['it''s']")
    expect(yml).toContain("root_file: 'thesis.tex'")
    expect(yml).toContain("working_directory: 'docs/src'")
    expect(yml).toContain("path: 'docs/src/thesis.pdf'")
    expect(yml).toContain("- 'docs/**'")
    expect(pdfOutputPath('src/thesis.tex', 'docs')).toBe('docs/src/thesis.pdf')
  })

  it('has no tabs (YAML forbids them for indentation)', () => {
    expect(buildPdfWorkflow({ rootFile: 'main.tex', dir: 'a', branch: 'main' })).not.toMatch(/\t/)
  })
})

describe('filesFromEntries', () => {
  it('unwraps a single top-level folder and reports it', () => {
    const result = filesFromEntries(
      { 'paper/main.tex': utf8('\\documentclass{article}'), 'paper/fig.png': new Uint8Array([1]) },
      'test',
    )
    expect(result.unwrapped).toBe('paper')
    expect(result.rootFile).toBe('main.tex')
    expect(result.files.map((f) => f.path).sort()).toEqual(['fig.png', 'main.tex'])
  })

  it('throws when there is no .tex file', () => {
    expect(() => filesFromEntries({ 'a.md': utf8('x') }, 'octo/repo')).toThrow('No .tex files found in octo/repo.')
  })
})
