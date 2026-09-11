/*
 * Čisti modeli prikaza koji ne pripadaju jednom modulu: tačkice u navigaciji (prototip L937–948)
 * i list semena (L955–968).
 */
import {
  KULTURE,
  MASINE,
  MASINE_REDOSLED,
  REDOSLED,
  SVI_KLJUCEVI,
  ZIV,
  ZIV_REDOSLED,
  type KulturaId,
  type ZgradaId,
} from '../config'
import { mozeIsporuka } from './narudzbine'
import { zrelihUseva } from './polja'
import { stanjeZgrade } from './radnja'
import type { Stanje } from './types'
import { nivoIzXp } from './xp'
import { zivSpremno } from './zivotinje'

export interface NavTacke {
  /** Ima zrelih useva ili spremnih jaja/mleka. */
  farma: boolean
  /** Neka narudžbina može odmah da se isporuči. */
  narudzbine: boolean
  /** Ima robe za prodaju, a nijedna narudžbina nije isporučiva. */
  pijaca: boolean
  /** Neka zgrada je otključana, nekupljena i ima dovoljno novca (anti-softlock se NE gleda, 1:1). */
  radnja: boolean
}

export function navTacke(s: Stanje, now: number): NavTacke {
  const farma = zrelihUseva(s, now) > 0 || ZIV_REDOSLED.some((id) => zivSpremno(s, id, now) > 0)
  const narudzbine = s.narudzbe.some((o) => mozeIsporuka(s, o))
  const pijaca = SVI_KLJUCEVI.some((k) => s.mag[k] > 0) && !narudzbine
  const mozeKupiti = (id: ZgradaId, cena: number) =>
    stanjeZgrade(s, id) === 'dostupno' && s.novac >= cena
  const radnja =
    MASINE_REDOSLED.some((id) => mozeKupiti(id, MASINE[id].cena)) ||
    ZIV_REDOSLED.some((id) => mozeKupiti(id, ZIV[id].cena))
  return { farma, narudzbine, pijaca, radnja }
}

export interface OpcijaSemena {
  k: KulturaId
  /** Nivo je ispod nivoa kulture (🔒). */
  zakljucano: boolean
  /** Dugme je aktivno: otključano i ima dovoljno novca za seme. */
  moze: boolean
}

/** Stavke lista semena, redom REDOSLED (sve kulture, i zaključane). */
export function opcijeSemena(s: Stanje): OpcijaSemena[] {
  const { lvl } = nivoIzXp(s.xp)
  return REDOSLED.map((k) => {
    const zakljucano = KULTURE[k].nivo > lvl
    return { k, zakljucano, moze: !(zakljucano || s.novac < KULTURE[k].seme) }
  })
}
