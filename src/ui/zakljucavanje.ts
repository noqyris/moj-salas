/*
 * D15 — zaštita od duplog tapa. Posle akcije koja pomera redove, OBLAST te akcije ignoriše tapove
 * ZAKLJUCAVANJE_TAPA_MS (vreme po `clock.perfNow()`):
 *   prodaja → '#tezga' · isporuka/odbijanje → '#narudzbeKuca' · prikaz sledeće overlay kartice →
 *   '#nivoOk' · otvaranje lista semena → '#veo' · „Uberi sve" → '#njive'.
 * Oblasti se NE zaključavaju međusobno (referenca-sim TEST 1 klikne parcelu pa seme u istoj ms).
 * Zaključavanje je po imenu oblasti, ne po DOM pretku, pa radi i za handler odvojenog elementa.
 */
import { ZAKLJUCAVANJE_TAPA_MS } from '../config'
import type { Clock } from '../platform/tipovi'

export const OBLASTI_TAPA = ['#tezga', '#narudzbeKuca', '#nivoOk', '#veo', '#njive'] as const
export type OblastTapa = (typeof OBLASTI_TAPA)[number]

export interface Zakljucavanje {
  /** Od ovog trenutka oblast ignoriše tapove ZAKLJUCAVANJE_TAPA_MS (ponovni poziv produžava). */
  zakljucaj(oblast: OblastTapa): void
  /** Da li je oblast zaključana SADA (perfNow < kraj; tačno na kraju je otključana). */
  zakljucano(oblast: OblastTapa): boolean
  /** Omotač handlera: dok je oblast zaključana poziv se tiho ignoriše. */
  cuvaj<A extends unknown[]>(oblast: OblastTapa, fn: (...a: A) => void): (...a: A) => void
}

export function napraviZakljucavanje(sat: Pick<Clock, 'perfNow'>): Zakljucavanje {
  const kraj = new Map<OblastTapa, number>()
  const zakljucano = (oblast: OblastTapa): boolean => {
    const k = kraj.get(oblast)
    return k !== undefined && sat.perfNow() < k
  }
  return {
    zakljucaj(oblast) {
      kraj.set(oblast, sat.perfNow() + ZAKLJUCAVANJE_TAPA_MS)
    },
    zakljucano,
    cuvaj(oblast, fn) {
      return (...a) => {
        if (!zakljucano(oblast)) fn(...a)
      }
    },
  }
}
