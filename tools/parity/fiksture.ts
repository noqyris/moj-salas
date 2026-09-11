/*
 * Čitanje fikstura pariteta (`tests/fixtures/parity/<ime>.jsonl`). Namerno bez generatora i
 * jsdom-a, da test reprodukcije ostane lak. Pravljenje: tools/parity/upis.ts (`npm run parity:gen`).
 */
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dekodirajTrag, type Trag } from './kodek'

export const DIR_FIKSTURA = fileURLToPath(new URL('../../tests/fixtures/parity/', import.meta.url))

export const putanjaFiksture = (ime: string): string => `${DIR_FIKSTURA}${ime}.jsonl`

export function procitajFiksturu(ime: string): Trag {
  return dekodirajTrag(readFileSync(putanjaFiksture(ime), 'utf8'))
}

/** Imena `*.jsonl` fajlova koji trenutno postoje u direktorijumu fikstura, sortirana. */
export function postojeceFiksture(): string[] {
  return readdirSync(DIR_FIKSTURA)
    .filter((f) => f.endsWith('.jsonl'))
    .map((f) => f.slice(0, -'.jsonl'.length))
    .sort()
}
