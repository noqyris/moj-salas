/*
 * CLAUDE.md pravilo 1 (i ugovor §0.8) pod `npm test`, ne samo pod ESLint-om (07 §0.2):
 *  - src/core i src/config se prevode sa `lib: ES2022` BEZ DOM-a i bez Node tipova — svaki
 *    `document`, `window`, `localStorage`, `navigator`, `setTimeout`, `performance`, `process`…
 *    je greška prevođenja;
 *  - AST (ne regex, pa komentari i stringovi ne smetaju): nema `Date` (vreme stiže kao `now`),
 *    nema `Math.random` (nasumičnost stiže kao `rng`), nema importa iz ui/platform/art/i18n.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const KOREN = fileURLToPath(new URL('../../', import.meta.url))
const fajlovi = (dir: string): string[] =>
  readdirSync(join(KOREN, dir), { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.ts'))
    .map((f) => join(KOREN, dir, f))
const CISTI = [...fajlovi('src/core'), ...fajlovi('src/config')]

describe('core i config su čisti (bez DOM-a, vremena, nasumičnosti i spoljnih slojeva)', () => {
  it('ima šta da se proveri', () => {
    expect(CISTI.length).toBeGreaterThanOrEqual(20)
    expect(CISTI.some((f) => f.endsWith('sejv/kontroler.ts'))).toBe(true)
  })

  it('prevode se sa lib ES2022, bez DOM i Node tipova', () => {
    const program = ts.createProgram(CISTI, {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      lib: ['lib.es2022.d.ts'],
      types: [],
      strict: true,
      noUncheckedIndexedAccess: true,
      verbatimModuleSyntax: true,
      isolatedModules: true,
      noEmit: true,
      skipLibCheck: true,
    })
    const greske = ts.getPreEmitDiagnostics(program).map((d) => {
      const gde = d.file ? relative(KOREN, d.file.fileName) : '?'
      return `${gde}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`
    })
    expect(greske).toEqual([])
    // i nijedan fajl van src/core i src/config nije ušao u program preko importa
    const van = program
      .getSourceFiles()
      .map((f) => relative(KOREN, f.fileName))
      .filter((f) => !f.startsWith('node_modules') && !/^src\/(core|config)\//.test(f))
    expect(van).toEqual([])
  })

  it('AST: bez Date, Math.random i importa iz ui/platform/art/i18n', () => {
    const prekrsaji: string[] = []
    for (const putanja of CISTI) {
      const izvor = ts.createSourceFile(
        putanja,
        readFileSync(putanja, 'utf8'),
        ts.ScriptTarget.ES2022,
        true,
      )
      const gde = (n: ts.Node) =>
        `${relative(KOREN, putanja)}:${izvor.getLineAndCharacterOfPosition(n.getStart()).line + 1}`
      const obidji = (n: ts.Node): void => {
        if (ts.isIdentifier(n) && n.text === 'Date') prekrsaji.push(`${gde(n)} Date`)
        if (
          ts.isPropertyAccessExpression(n) &&
          ts.isIdentifier(n.expression) &&
          n.expression.text === 'Math' &&
          n.name.text === 'random'
        ) {
          prekrsaji.push(`${gde(n)} Math.random`)
        }
        if (
          (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) &&
          n.moduleSpecifier &&
          ts.isStringLiteral(n.moduleSpecifier) &&
          /(^|\/)(ui|platform|art|i18n)(\/|$)/.test(n.moduleSpecifier.text)
        ) {
          prekrsaji.push(`${gde(n)} import ${n.moduleSpecifier.text}`)
        }
        ts.forEachChild(n, obidji)
      }
      obidji(izvor)
    }
    expect(prekrsaji).toEqual([])
  })
})
