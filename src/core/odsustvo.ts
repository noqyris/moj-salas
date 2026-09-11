/*
 * Povratak u igru (prototip L1166–1216): rezime odsustva i dnevni poklon. Ništa od ovoga ne
 * dodeljuje proizvode — mašine završava prvi tick, useve i životinje igrač sam kupi.
 */
import {
  DOBRODOSLICA_PRAG_S,
  KULTURE,
  MASINE,
  MASINE_REDOSLED,
  ZIV,
  ZIV_REDOSLED,
  dnevniPoklon,
  type MasinaId,
  type ProizvodId,
} from '../config'
import type { Igra } from './dogadjaji'
import type { Stanje } from './types'
import { nivoIzXp } from './xp'
import { zivSpremno } from './zivotinje'

export interface RezimeOdsustva {
  /** `(pre − videnoPre) / 1000`; negativno ako je sat vraćen. */
  odsutanS: number
  /** Usevi koji su sazreli u (videnoPre, pre] — ne oni zreli već pri odlasku. */
  sazrelo: number
  /** Kupljene mašine čija je tura gotova do `pre` (bez donje granice), redom MASINE (D16). */
  gotoveMasine: MasinaId[]
  /** Razlika spremnih (obe vrednosti su ograničene kapacitetom), samo pozitivne, redom ZIV. */
  skupilo: Partial<Record<ProizvodId, number>>
}

/** Rezime za „Dobro došao nazad". `videnoPre` = `s.videno || pre`, pročitan PRE bilo kakvog čuvanja. */
export function rezimeOdsustva(s: Stanje, videnoPre: number, pre: number): RezimeOdsustva {
  let sazrelo = 0
  for (const p of s.parcele) {
    if (!p.c) continue
    const g = p.t + KULTURE[p.c].vreme * 1000
    if (g > videnoPre && g <= pre) sazrelo++
  }
  const gotoveMasine: MasinaId[] = []
  for (const id of MASINE_REDOSLED) {
    const m = s.masine[id]
    if (m.k && m.t > 0 && m.t + MASINE[id].vreme * 1000 <= pre) gotoveMasine.push(id)
  }
  const skupilo: Partial<Record<ProizvodId, number>> = {}
  for (const id of ZIV_REDOSLED) {
    if (!s.ziv[id].k) continue
    const d = zivSpremno(s, id, pre) - zivSpremno(s, id, videnoPre)
    if (d > 0) skupilo[ZIV[id].proizvod] = d
  }
  return { odsutanS: (pre - videnoPre) / 1000, sazrelo, gotoveMasine, skupilo }
}

/** Kartica se prikazuje posle STROGO dužeg odsustva od praga, i samo ako ima šta da se javi. */
export function prikaziDobrodoslicu(r: RezimeOdsustva): boolean {
  return (
    r.odsutanS > DOBRODOSLICA_PRAG_S &&
    (r.sazrelo > 0 || r.gotoveMasine.length > 0 || Object.keys(r.skupilo).length > 0)
  )
}

/**
 * Dnevni poklon pri startu: samo ako je igrač bar jednom sadio i datum je otišao NAPRED (D5;
 * poređenje 'YYYY-MM-DD' stringova, '' je najmanji). Novac se dodaje odmah; vraća iznos ili null.
 */
export function uzmiDnevniPoklon(g: Igra, danas: string): number | null {
  const s = g.s
  if (!(s.sadio && s.poklonDan < danas)) return null
  s.poklonDan = danas
  const dar = dnevniPoklon(nivoIzXp(s.xp).lvl)
  s.novac += dar
  return dar
}
