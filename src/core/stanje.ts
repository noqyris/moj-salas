import {
  MASINE_REDOSLED,
  POCETNE_PARCELE,
  POCETNI_NOVAC,
  SVI_KLJUCEVI,
  ZIV_REDOSLED,
  type ArtikalId,
  type MasinaId,
  type ZivotinjaId,
} from '../config'
import type { Masina, Parcela, Stanje, Zivotinja } from './types'

export function praznaParcela(): Parcela {
  return { c: null, t: 0, z: false }
}

/** Nova igra (prototip `POCETNO()`): 50 din, 2 prazne parcele, prazan magacin, bez zgrada. */
export function pocetnoStanje(now: number): Stanje {
  return {
    v: 3,
    novac: POCETNI_NOVAC,
    xp: 0,
    parcele: Array.from({ length: POCETNE_PARCELE }, praznaParcela),
    mag: Object.fromEntries(SVI_KLJUCEVI.map((k) => [k, 0])) as Record<ArtikalId, number>,
    masine: Object.fromEntries(MASINE_REDOSLED.map((id) => [id, { k: false, t: 0 }])) as Record<
      MasinaId,
      Masina
    >,
    ziv: Object.fromEntries(ZIV_REDOSLED.map((id) => [id, { k: false, t: 0 }])) as Record<
      ZivotinjaId,
      Zivotinja
    >,
    narudzbe: [],
    mute: false,
    sadio: false,
    stat: { ubrano: 0, zaradjeno: 0, isporuke: 0 },
    poklonDan: '',
    videno: now,
  }
}
