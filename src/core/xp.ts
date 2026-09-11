/*
 * XP i nivoi (prototip L528–529, L704–730). `dodajXp` je JEDINI put kojim se dodaje XP.
 */
import {
  AUKCIJA_NIVO,
  KULTURE,
  MASINE,
  MASINE_REDOSLED,
  MAX_NIVO,
  REDOSLED,
  ZIV,
  ZIV_REDOSLED,
  nivoBonus,
  xpZaNivo,
} from '../config'
import type { Dogadjaj, Igra, Otkljucavanje, Sidro } from './dogadjaji'

export interface NivoInfo {
  /** Trenutni nivo, 1..MAX_NIVO. */
  lvl: number
  /** XP skupljen UNUTAR trenutnog nivoa (na MAX_NIVO raste bez granice). */
  u: number
  /** XP potreban da se završi trenutni nivo: `xpZaNivo(lvl)`. */
  do: number
}

/** Nivo iz ukupnog XP-a — petlja 1:1 sa prototipom (`>=`, zaustavlja se na MAX_NIVO). */
export function nivoIzXp(xp: number): NivoInfo {
  let l = 1
  let ostatak = xp
  while (ostatak >= xpZaNivo(l) && l < MAX_NIVO) {
    ostatak -= xpZaNivo(l)
    l++
  }
  return { lvl: l, u: ostatak, do: xpZaNivo(l) }
}

/** Šta level-up kartica za nivo `l` najavljuje: kulture (REDOSLED), mašine, životinje, pa aukcija. */
export function otkljucanoNaNivou(l: number): Otkljucavanje[] {
  const o: Otkljucavanje[] = []
  for (const id of REDOSLED) if (KULTURE[id].nivo === l) o.push({ vrsta: 'kultura', id })
  for (const id of MASINE_REDOSLED) if (MASINE[id].nivo === l) o.push({ vrsta: 'masina', id })
  for (const id of ZIV_REDOSLED) if (ZIV[id].nivo === l) o.push({ vrsta: 'zivotinja', id })
  if (l === AUKCIJA_NIVO) o.push({ vrsta: 'aukcija' })
  return o
}

/**
 * Dodaje `n` XP i sustiže `prosliNivo`: za SVAKI pređeni nivo, rastućim redom, bonus odmah ide u
 * novac (pre bilo kakve potvrde u UI-ju) i emituje se jedan događaj 'nivo'.
 * Vraća `[xp, ...nivo]` — pozivalac ih ubacuje na mesto gde je prototip zvao `dodajXp`.
 */
export function dodajXp(g: Igra, n: number, sidro: Sidro): Dogadjaj[] {
  g.s.xp += n
  const dogadjaji: Dogadjaj[] = [{ tip: 'xp', iznos: n, sidro }]
  const { lvl } = nivoIzXp(g.s.xp)
  while (lvl > g.prosliNivo) {
    g.prosliNivo++
    const bonus = nivoBonus(g.prosliNivo)
    g.s.novac += bonus
    dogadjaji.push({
      tip: 'nivo',
      nivo: g.prosliNivo,
      bonus,
      otkljucano: otkljucanoNaNivou(g.prosliNivo),
    })
  }
  return dogadjaji
}
