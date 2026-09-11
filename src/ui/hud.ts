/*
 * HUD: novac sa brojanjem i nivo sa XP trakom (prototip L671–684, L765–769).
 * `#novac` se piše ISKLJUČIVO iz requestAnimationFrame okvira: ništa sinhrono pri pozivu,
 * NOVAC_BROJANJE_MS ease-out cubic od PRIKAZANE (razlomljene) vrednosti do cilja; novi cilj
 * otkazuje tekući okvir. Prikazana vrednost počinje od 0 (boot broji od nule) i reset je ne nuluje.
 * Kao u prototipu, `u` nije ograničen odozdo (06/04 B6 — nije odobreno odstupanje).
 */
import { NOVAC_BROJANJE_MS } from '../config'
import { fmt } from '../i18n/format'
import type { Clock, Timers } from '../platform/tipovi'
import { $ } from './dom'

export interface HudZavisnosti {
  koren: ParentNode
  sat: Pick<Clock, 'perfNow'>
  tajmeri: Pick<Timers, 'raf' | 'cancelRaf'>
}

/** Nivo kako ga vraća core `nivoIzXp(xp)`: nivo, XP u tekućem nivou, XP do sledećeg. */
export interface PrikazNivoa {
  readonly lvl: number
  readonly u: number
  readonly do: number
}

export interface Hud {
  /** Broji `#novac` do `cilj` (pozivaoc prosleđuje `s.novac` u trenutku poziva). */
  crtajNovac(cilj: number): void
  crtajNivo(n: PrikazNivoa): void
  /** Trenutno prikazana (razlomljena) vrednost novca. */
  prikazanNovac(): number
}

export function napraviHud({ koren, sat, tajmeri }: HudZavisnosti): Hud {
  let novacPrikaz = 0
  let novacAnim: number | null = null

  return {
    crtajNovac(cilj) {
      if (novacAnim !== null) tajmeri.cancelRaf(novacAnim)
      const start = novacPrikaz
      const t0 = sat.perfNow()
      const korak = (tt: number): void => {
        const u = Math.min(1, (tt - t0) / NOVAC_BROJANJE_MS)
        novacPrikaz = start + (cilj - start) * (1 - Math.pow(1 - u, 3))
        $(koren, '#novac').textContent = fmt(novacPrikaz)
        if (u < 1) novacAnim = tajmeri.raf(korak)
        else novacPrikaz = cilj
      }
      novacAnim = tajmeri.raf(korak)
    },
    crtajNivo(n) {
      $(koren, '#nivoBr').textContent = String(n.lvl)
      $(koren, '#xpTraka').style.width = Math.min(100, (n.u / n.do) * 100) + '%'
    },
    prikazanNovac: () => novacPrikaz,
  }
}
