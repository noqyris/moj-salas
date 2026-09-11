/*
 * Sesija (`Igra`): stanje + izvedene vrednosti koje se NE čuvaju (prototip L704, L735, L1152–1161,
 * L1168–1169).
 */
import type { Igra, Rezultat } from './dogadjaji'
import { osigurajNarudzbe } from './narudzbine'
import { pocetnoStanje } from './stanje'
import type { Rng, Stanje } from './types'
import { nivoIzXp } from './xp'

/**
 * Sesija nad učitanim stanjem: `prosliNivo` = nivo iz XP-a (level-up-ovi se ne ponavljaju pri
 * učitavanju), `brojacN` = najveći ID + 1 (prazna tabla → 1). NE dopunjava narudžbine — to je
 * sledeći korak boot-a (`osigurajNarudzbe`), posle računanja `brojacN`.
 */
export function igraIzStanja(s: Stanje): Igra {
  return {
    s,
    prosliNivo: nivoIzXp(s.xp).lvl,
    brojacN: s.narudzbe.reduce((m, o) => Math.max(m, o.id || 0), 0) + 1,
  }
}

/** Šta reset prenosi iz stare igre (D6): podešavanje zvuka i dan već uzetog poklona. */
export interface ZadrziPriResetu {
  mute: boolean
  poklonDan: string
}

/** Nova igra (reset): početno stanje, ID-jevi narudžbina kreću od 1, odmah 2 narudžbine. */
export function novaIgra(now: number, rng: Rng, zadrzi?: ZadrziPriResetu): Igra {
  const s = pocetnoStanje(now)
  if (zadrzi) {
    s.mute = zadrzi.mute
    s.poklonDan = zadrzi.poklonDan
  }
  const g = igraIzStanja(s)
  osigurajNarudzbe(g, rng)
  return g
}

/** Zvuk uključen/isključen. „tap" se čuje samo kad je zvuk posle prebacivanja UKLJUČEN. */
export function prebaciZvuk(g: Igra): Rezultat {
  g.s.mute = !g.s.mute
  return {
    ok: true,
    dogadjaji: g.s.mute ? [] : [{ tip: 'zvuk', id: 'tap' }],
    cuvaj: 'odlozeno',
  }
}
