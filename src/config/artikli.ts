import { KULTURE, REDOSLED, type KulturaId } from './kulture'
import { PROIZVODI, PROIZVODI_REDOSLED, type ProizvodId } from './proizvodi'

/** Sve što može u magacin. Redosled je prototipov `SVI_KLJUCEVI`: određuje fazni pomak cene na
 *  pijaci (indeks · 1.7), redosled redova na tezgi i ključeve magacina u sejvu. */
export const SVI_KLJUCEVI = [...REDOSLED, ...PROIZVODI_REDOSLED] as const
export type ArtikalId = KulturaId | ProizvodId

export function jeArtikal(k: unknown): k is ArtikalId {
  return typeof k === 'string' && (SVI_KLJUCEVI as readonly string[]).includes(k)
}

export function jeKulturaArtikal(k: ArtikalId): k is KulturaId {
  return (REDOSLED as readonly string[]).includes(k)
}

/** Bazna tržišna cena artikla (prototip `SVE_CENE[k].cena`). */
export function baznaCena(k: ArtikalId): number {
  return jeKulturaArtikal(k) ? KULTURE[k].cena : PROIZVODI[k].cena
}
