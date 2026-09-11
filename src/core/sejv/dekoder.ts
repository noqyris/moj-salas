/*
 * Čist dekoder sejva (01 §h.2): sirov string iz skladišta → vrsta + NOVO stanje. Nikad ne baca
 * i nikad ne vraća delimično spojeno stanje (prototip je mogao, 01 B3).
 *
 * Šta sa kojom vrstom radi kontroler (D9): `prazan` → nova igra; `neispravan` → nova igra, ali
 * sirovi original prvo ide u KLJUC_REZERVE; `buduci` → nova igra samo u memoriji (readOnly);
 * `ok` sa popravkama → rezerva originala pa normalan rad (D10).
 */
import { NAJSTARIJA_VERZIJA_SEJVA, VERZIJA_SEJVA } from '../../config'
import { pocetnoStanje } from '../stanje'
import type { Stanje } from '../types'
import { pokreniMigracije } from './migracije'
import { normalizujV3 } from './normalizuj'
import { jeObjekat } from './tipovi'

export type DekodiranSejv =
  /** `null` (ključ ne postoji) ili '' — nova igra. */
  | { vrsta: 'prazan'; stanje: Stanje }
  /** Učitano; `popravke` je prazno ⇔ ništa iz originala nije izgubljeno. */
  | { vrsta: 'ok'; stanje: Stanje; izVerzije: 2 | 3; popravke: string[] }
  /** Ne može da se pročita: nevažeći JSON, nije objekat, ili nepodržana verzija (1, '3', 2.5…). */
  | { vrsta: 'neispravan'; stanje: Stanje; razlog: 'json' | 'nije-objekat' | 'verzija' }
  /** Sejv iz novijeg builda (ceo `v` > VERZIJA_SEJVA) — ne sme da se pregazi. */
  | { vrsta: 'buduci'; stanje: Stanje; verzija: number }

/** Verzije koje lanac migracija ume da učita (sada tačno 2 i 3; strogo, kao prototip L554). */
function jePodrzanaVerzija(v: unknown): v is 2 | 3 {
  return (
    typeof v === 'number' &&
    Number.isInteger(v) &&
    v >= NAJSTARIJA_VERZIJA_SEJVA &&
    v <= VERZIJA_SEJVA
  )
}

/**
 * `now` MORA biti startni `pre` (uzet pre čitanja skladišta): tada sejv bez `videno` dobija
 * `videno = pre` i nema lažnog „Dobro došao nazad" (prototip L1172).
 */
export function dekodirajSejv(raw: string | null, now: number): DekodiranSejv {
  if (raw === null || raw === '') return { vrsta: 'prazan', stanje: pocetnoStanje(now) }
  let p: unknown
  try {
    p = JSON.parse(raw)
  } catch {
    return { vrsta: 'neispravan', stanje: pocetnoStanje(now), razlog: 'json' }
  }
  if (!jeObjekat(p))
    return { vrsta: 'neispravan', stanje: pocetnoStanje(now), razlog: 'nije-objekat' }
  const v = p.v
  if (typeof v === 'number' && Number.isInteger(v) && v > VERZIJA_SEJVA) {
    return { vrsta: 'buduci', stanje: pocetnoStanje(now), verzija: v }
  }
  if (!jePodrzanaVerzija(v))
    return { vrsta: 'neispravan', stanje: pocetnoStanje(now), razlog: 'verzija' }
  const popravke: string[] = []
  const migrirano = pokreniMigracije(p, popravke)
  const n = normalizujV3(migrirano, now)
  return { vrsta: 'ok', stanje: n.stanje, izVerzije: v, popravke: [...popravke, ...n.popravke] }
}

/** Stanje → string za skladište. Isti oblik kao prototipov `JSON.stringify(S)` (L574). */
export function kodirajSejv(s: Stanje): string {
  return JSON.stringify(s)
}
