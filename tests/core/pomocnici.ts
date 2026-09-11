/*
 * Pomoćnici za core testove (grana core-igra). Nisu test fajl (vitest skuplja samo *.test.ts).
 */
import { expect } from 'vitest'
import type { Dogadjaj, Igra, Rezultat } from '../../src/core/dogadjaji'
import { igraIzStanja } from '../../src/core/igra'
import { osigurajNarudzbe } from '../../src/core/narudzbine'
import type { Rng, Stanje } from '../../src/core/types'
import { stanje } from '../helpers'

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
 * Učitavanje kao pri boot-u: sirovi sejv → sesija → dopuna narudžbina.
 * NAPOMENA (integracija): dekoder sejva piše grana core-sejv paralelno, pa ovde ide samo JSON
 * krug. Kad `src/core/sejv` postoji, zameniti sa `dekodirajSejv(raw, now).stanje` / `kodirajSejv`.
 */
export function ucitajIgru(raw: string, rng: Rng): Igra {
  const g = igraIzStanja(JSON.parse(raw) as Stanje)
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
