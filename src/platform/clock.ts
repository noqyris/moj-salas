import type { Clock } from './tipovi'

/** Lokalni kalendarski dan 'YYYY-MM-DD' za trenutak `now` — isti izraz kao prototip (L1203), da se
 *  već sačuvani `poklonDan` i dalje poredi tačno. Zona je zona uređaja. */
export function lokalniDan(now: number): string {
  return new Date(now).toLocaleDateString('sv')
}

/** Pravi sat. `Date.now()` i `performance.now()` se čitaju u trenutku poziva (lažni tajmeri u
 *  testovima ih mogu zameniti i posle pravljenja sata). */
export function createClock(): Clock {
  return {
    now: () => Date.now(),
    perfNow: () => performance.now(),
    danas: lokalniDan,
  }
}
