// `node tools/readme/generisi.mjs` — osvežava tabelu balansa u README.md iz src/config (između oznaka)
// i formatira README Prettier-om. tests/dokumentacija/readme.test.ts pada dok se ovo ne pokrene posle
// promene balansa. Generator je TypeScript; Vite-ov module runner ga učitava bez build koraka.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as prettier from 'prettier'
import { runnerImport } from 'vite'

const koren = new URL('../../', import.meta.url)
const pkg = JSON.parse(readFileSync(new URL('package.json', koren), 'utf8'))
const putanja = fileURLToPath(new URL('README.md', koren))

const { module } = await runnerImport(fileURLToPath(new URL('./balans.ts', import.meta.url)), {
  // i18n (podnaslov table) čita verziju kao i build (vite.config.mts → define).
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
})
const novo = module.uReadme(readFileSync(putanja, 'utf8'), module.tabelaBalansa())
const opcije = (await prettier.resolveConfig(putanja)) ?? {}
writeFileSync(putanja, await prettier.format(novo, { ...opcije, filepath: putanja }))
console.log('README.md: tabela balansa osvežena')
