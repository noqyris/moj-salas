// `npm run parity:gen` — regeneriše tests/fixtures/parity/*.jsonl iz zakrpljenog prototipa.
// Generator je TypeScript; Vite-ov module runner ga učitava bez posebnog koraka build-a.
import { fileURLToPath } from 'node:url'
import { runnerImport } from 'vite'

// Dnevni poklon zavisi od lokalnog dana — isto kao test.env.TZ u vite.config.mts.
process.env.TZ = 'Europe/Belgrade'

const { module } = await runnerImport(fileURLToPath(new URL('./upis.ts', import.meta.url)))
await module.upisiSveFiksture((linija) => console.log(linija))
