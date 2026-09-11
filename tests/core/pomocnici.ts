/*
 * Pomoćnici za core testove (grana core-igra). Nisu test fajl (vitest skuplja samo *.test.ts).
 */
import { expect } from 'vitest'
import type { Dogadjaj, Igra, Rezultat } from '../../src/core/dogadjaji'
import { igraIzStanja } from '../../src/core/igra'
import { osigurajNarudzbe } from '../../src/core/narudzbine'
import { dekodirajSejv } from '../../src/core/sejv/dekoder'
import type { Rng, Stanje } from '../../src/core/types'
import { T0, stanje } from '../helpers'

/** Igra nad test-stanjem (helpers `stanje(o)`), bez dopune narudžbina. */
export function igra(o: Partial<Stanje> = {}): Igra {
  return igraIzStanja(stanje(o))
}

/**
 * Oponaša SaveController: `videno = now` tačno kad akcija traži čuvanje (ugovor §4, 07 §d.2 #8).
 */
export function pecat(g: Igra, now: number, r: Rezultat): Rezultat {
  if (r.cuvaj !== 'ne') g.s.videno = now
  return r
}

/**
 * Učitavanje kao pri boot-u (07 §0.3 `loadGame`): sirovi sejv → PRAVI dekoder → sesija → dopuna
 * narudžbina. Test-sejvovi su ispravni, pa dekoder mora da vrati `ok` bez ijedne popravke —
 * inače je fikstura pogrešna i test bi tiho proveravao ispravljeno umesto zadatog stanja.
 */
export function ucitajIgru(raw: string, rng: Rng, now: number = T0): Igra {
  const d = dekodirajSejv(raw, now)
  if (d.vrsta !== 'ok' || d.popravke.length > 0) {
    throw new Error(`test-sejv nije čist: ${JSON.stringify(d.vrsta === 'ok' ? d.popravke : d)}`)
  }
  const g = igraIzStanja(d.stanje)
  osigurajNarudzbe(g, rng)
  return g
}

/**
 * Proverava da je akcija odbijena BEZ ikakve promene (duboko, uključujući `videno`, `brojacN`,
 * `prosliNivo`) i sa `cuvaj: 'ne'`. Vraća događaje za dalje provere.
 */
export function odbijeno(g: Igra, akcija: () => Rezultat): Dogadjaj[] {
  const pre = structuredClone(g)
  const r = akcija()
  expect(r.ok).toBe(false)
  expect(r.cuvaj).toBe('ne')
  expect(g).toEqual(pre)
  return r.dogadjaji
}

/** rng koji broji izvlačenja (za zlatne vektore sa mulberry32). */
export function brojac(rng: Rng): Rng & { pozivi(): number } {
  let n = 0
  const f = () => {
    n++
    return rng()
  }
  return Object.assign(f, { pozivi: () => n })
}

/** Samo 'nivo' događaji, kao `[nivo, bonus]` parovi. */
export function nivoi(d: readonly Dogadjaj[]): [number, number][] {
  return d.flatMap((e) => (e.tip === 'nivo' ? [[e.nivo, e.bonus] as [number, number]] : []))
}
