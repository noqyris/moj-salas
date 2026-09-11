/*
 * Pijaca: cene koje osciliraju sa apsolutnim vremenom (prototip L585–590) i prodaja (L1020–1028).
 */
import {
  PIJACA_MIN_CENA,
  PIJACA_PRAG_DOLE,
  PIJACA_PRAG_GORE,
  SVI_KLJUCEVI,
  baznaCena,
  pijacaMnozilac,
  type ArtikalId,
} from '../config'
import { ODBIJENO, type Igra, type Rezultat } from './dogadjaji'
import type { Stanje } from './types'

/** Najviše novčića koji lete ka novčaniku po akciji (prototip `Math.min(broj, 6)`). */
export const NOVCICA_MAX = 6

export type Smer = -1 | 0 | 1

export interface TrzisnaCena {
  cena: number
  /** Iz NEZAOKRUŽENOG množioca: 1 = ▲ dobra cena, −1 = ▼ slaba, 0 = prosek. */
  smer: Smer
}

/** Cena artikla u trenutku `now` (epoch ms — ista za sve igrače u istom trenutku). */
export function trzisnaCena(k: ArtikalId, now: number): TrzisnaCena {
  const baza = baznaCena(k)
  const idx = SVI_KLJUCEVI.indexOf(k)
  const m = pijacaMnozilac(now, idx)
  return {
    cena: Math.max(PIJACA_MIN_CENA, Math.round(baza * m)),
    smer: m >= PIJACA_PRAG_GORE ? 1 : m <= PIJACA_PRAG_DOLE ? -1 : 0,
  }
}

/** Artikli na tezgi: svi sa `mag > 0`, redosledom SVI_KLJUCEVI. */
export function robaNaTezgi(s: Stanje): ArtikalId[] {
  return SVI_KLJUCEVI.filter((k) => s.mag[k] > 0)
}

/** „Prodaj sve": ceo komad artikla po ceni u trenutku klika. Bez XP-a i bez vibracije. */
export function prodaj(g: Igra, k: ArtikalId, now: number): Rezultat {
  const s = g.s
  const kom = s.mag[k]
  if (!kom) return ODBIJENO
  const { cena } = trzisnaCena(k, now)
  const zarada = cena * kom
  s.mag[k] = 0
  s.novac += zarada
  s.stat.zaradjeno += zarada
  return {
    ok: true,
    dogadjaji: [
      { tip: 'novcici', sidro: { vrsta: 'prodaja', artikal: k }, broj: Math.min(kom, NOVCICA_MAX) },
      { tip: 'poruka', poruka: { id: 'prodato', kom, artikal: k, zarada } },
    ],
    cuvaj: 'odlozeno',
  }
}
