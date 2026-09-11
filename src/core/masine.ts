/*
 * Mašine (prototip L1065–1071, tick L1102–1118, kartica L834–840). Tura se završava SAMO u ticku,
 * i daje tačno jedan proizvod bez obzira na to koliko je tick zakasnio.
 */
import { MASINE, MASINE_REDOSLED, type MasinaId } from '../config'
import { ODBIJENO, type Cuvanje, type Dogadjaj, type Igra, type Rezultat } from './dogadjaji'
import type { Stanje } from './types'
import { dodajXp } from './xp'

/** Pokreće turu: troši ulaz odmah; XP stiže tek na kraju ture. D7: nekupljena mašina se odbija. */
export function pokreniMasinu(g: Igra, id: MasinaId, now: number): Rezultat {
  const s = g.s
  const M = MASINE[id]
  const m = s.masine[id]
  if (!m.k || m.t > 0 || s.mag[M.ulazK] < M.ulazN) return ODBIJENO
  s.mag[M.ulazK] -= M.ulazN
  m.t = now
  return { ok: true, dogadjaji: [{ tip: 'zvuk', id: 'sadnja' }], cuvaj: 'odlozeno' }
}

export interface RezultatTika {
  dogadjaji: Dogadjaj[]
  /** Neka tura je završena → UI ponovo crta zgrade, tezgu i narudžbine. */
  strukturno: boolean
  cuvaj: Cuvanje
}

/**
 * Mašinski deo ticka, redom mlin pa kazan: svaka završena tura → `t = 0`, +1 proizvod, zvuk,
 * poruka, XP (može level-up). Bez vibracije i bez `stat.ubrano`.
 */
export function tikMasina(g: Igra, now: number): RezultatTika {
  const s = g.s
  const dogadjaji: Dogadjaj[] = []
  let strukturno = false
  for (const id of MASINE_REDOSLED) {
    const m = s.masine[id]
    if (!m.k || !m.t) continue
    const M = MASINE[id]
    const proslo = (now - m.t) / 1000
    if (proslo >= M.vreme) {
      m.t = 0
      s.mag[M.izlaz]++
      dogadjaji.push(
        { tip: 'zvuk', id: 'zetva' },
        { tip: 'poruka', poruka: { id: 'masinaGotova', masina: id } },
        ...dodajXp(g, M.xp, { vrsta: 'masina', id }),
      )
      strukturno = true
    }
  }
  return { dogadjaji, strukturno, cuvaj: strukturno ? 'odlozeno' : 'ne' }
}

export type PogledMasine =
  /** `moze` = pokretanje bi uspelo (kupljena i ima dovoljno ulaza) — dugme nije `disabled`. */
  | { radi: false; moze: boolean }
  /** `udeo` ∈ [0, 1] za traku; `preostaloS` nezaokruženo (može biti ≤ 0 dok tick ne završi turu). */
  | { radi: true; udeo: number; preostaloS: number }

export function pogledMasine(s: Stanje, id: MasinaId, now: number): PogledMasine {
  const M = MASINE[id]
  const m = s.masine[id]
  if (m.t > 0) {
    const proslo = (now - m.t) / 1000
    return { radi: true, udeo: Math.min(1, proslo / M.vreme), preostaloS: M.vreme - proslo }
  }
  return { radi: false, moze: m.k && s.mag[M.ulazK] >= M.ulazN }
}
