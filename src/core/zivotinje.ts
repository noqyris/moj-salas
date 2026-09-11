/*
 * Životinje: pasivna proizvodnja (prototip L666–669, L1072–1081, kartica L845–855).
 *
 * D3 — kapacitet ograničava ZALIHU: kad je kokošinjac/štala pun, proizvodnja staje. Pri kupljenju
 *      `z.t = max(z.t, now − kap·I) + n·I`, pa se višak iznad kapaciteta odbacuje, a delimičan
 *      napredak (kad nije bilo puno) ostaje. Prototipova linija `if (z.t > now) z.t = now` je i dalje
 *      mrtav kod (z.t + n·I ≤ now po konstrukciji) i izostavljena je.
 * D4 — sat vraćen unazad: broj spremnih je u [0, kap]; `pokupi` odbija kad nema ničega.
 */
import { ZIV, type ZivotinjaId } from '../config'
import { ODBIJENO, type Igra, type Rezultat } from './dogadjaji'
import type { Stanje } from './types'
import { dodajXp } from './xp'

const VIBRACIJA_POKUPI = 14

/** Broj spremnih proizvoda, u [0, kap]; 0 za nekupljenu životinju. */
export function zivSpremno(s: Stanje, id: ZivotinjaId, now: number): number {
  const z = s.ziv[id]
  if (!z.k) return 0
  const Z = ZIV[id]
  return Math.max(0, Math.min(Z.kap, Math.floor((now - z.t) / (Z.interval * 1000))))
}

/** „Pokupi": sve spremno odjednom (najviše kap), XP po komadu. */
export function pokupi(g: Igra, id: ZivotinjaId, now: number): Rezultat {
  const s = g.s
  const n = zivSpremno(s, id, now)
  if (n <= 0) return ODBIJENO
  const Z = ZIV[id]
  const z = s.ziv[id]
  const I = Z.interval * 1000
  s.mag[Z.proizvod] += n
  s.stat.ubrano += n
  z.t = Math.max(z.t, now - Z.kap * I) + n * I
  return {
    ok: true,
    dogadjaji: [
      { tip: 'zvuk', id: 'zetva' },
      { tip: 'vibracija', obrazac: VIBRACIJA_POKUPI },
      ...dodajXp(g, n * Z.xpPo, { vrsta: 'zivotinja', id }),
      { tip: 'poruka', poruka: { id: 'pokupljeno', n, zivotinja: id } },
    ],
    cuvaj: 'odlozeno',
  }
}

export interface PogledZivotinje {
  /** Spremno za kupljenje, u [0, kap]. Dugme „Pokupi" je `disabled` kad je n ≤ 0. */
  n: number
  /** Traka: 1 kad je puno, inače deo tekućeg intervala (izraz 1:1 sa prototipom). */
  udeo: number
}

export function pogledZivotinje(s: Stanje, id: ZivotinjaId, now: number): PogledZivotinje {
  const Z = ZIV[id]
  const n = zivSpremno(s, id, now)
  const udeo = n >= Z.kap ? 1 : (((now - s.ziv[id].t) / 1000) % Z.interval) / Z.interval
  return { n, udeo }
}
