/*
 * Grafika igre: sprajtovi iz prototipa (sprajtovi.ts), statički SVG iz HTML-a (staticki.ts) i
 * pomoćnici koji biraju sprajt kao prototip.
 */
import { jeKulturaArtikal, type ArtikalId, type KulturaId } from '../config'
import type { Otkljucavanje } from '../core/dogadjaji'
import { ART, KLICA } from './sprajtovi'

export * from './sprajtovi'
export * from './staticki'

/** Ikonica artikla (prototip `ikonica`, L526): kultura → zrela biljka `ART['<k>3']`, proizvod → `ART[k]`.
 *  Koriste je list semena, tezga, stavke narudžbina i level-up pločice kultura. */
export function ikonica(k: ArtikalId): string {
  return jeKulturaArtikal(k) ? ART[`${k}3` as const] : ART[k]
}

/** Biljka na parceli po fazi rasta (crtajNjive L796/L801): 1 → KLICA (ista za sve kulture),
 *  2 → `ART['<c>2']`, 3 → `ART['<c>3']`. Zrela parcela crta fazu 3. */
export function biljka(c: KulturaId, faza: 1 | 2 | 3): string {
  return faza === 1 ? KLICA : ART[`${c}${faza}` as const]
}

/** Ikonica pločice „Otključano" u level-up kartici (prikaziNivo L715–721): kultura → `ikonica(k)`,
 *  mašina/životinja → `ART[id]`, aukcija → `ART.katanac`. */
export function ikonicaOtkljucavanja(o: Otkljucavanje): string {
  switch (o.vrsta) {
    case 'kultura':
      return ikonica(o.id)
    case 'masina':
    case 'zivotinja':
      return ART[o.id]
    case 'aukcija':
      return ART.katanac
  }
}
