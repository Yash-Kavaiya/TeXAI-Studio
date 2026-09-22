import { createProjectWithFiles } from './projectFactory'
import mainTex from './sampleProject/main.tex?raw'
import equationTex from './sampleProject/sections/equation.tex?raw'

export async function seedDemoProject(): Promise<string> {
  return createProjectWithFiles({
    name: 'Mass-Energy Equivalence (sample)',
    rootFile: 'main.tex',
    files: [
      { path: 'main.tex', content: mainTex },
      { path: 'sections/equation.tex', content: equationTex },
    ],
  })
}
