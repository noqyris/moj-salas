/*
 * Radnja: kupovina zgrada i zaštita od zaključavanja igre (prototip L660–665, L1041–1064).
 */
import { KULTURE, MASINE, SOFTLOCK_REZERVA_KULTURA, ZIV, jeMasina, type ZgradaId } from '../config'
import { ODBIJENO, type Igra, type Rezultat } from './dogadjaji'
import type { Stanje } from './types'
import { nivoIzXp } from './xp'

/** Vibracija posle kupovine parcele ili zgrade (prototip `vibro(20)`). */
export const VIBRACIJA_KUPOVINA = 20

/** „Nešto proizvodi": usev na parceli (i zreo), mašina koja radi, ili BILO KOJA kupljena životinja. */
export function nestoRaste(s: Stanje): boolean {
  return (
    s.parcele.some((p) => p.c) ||
    Object.values(s.masine).some((m) => m.t > 0) ||
    Object.values(s.ziv).some((z) => z.k)
  )
}

/** Magacin prazan: SVAKA vrednost je tačno 0 (prolazi kroz sve ključeve, kao prototip). */
export function magPrazan(s: Stanje): boolean {
  return Object.values(s.mag).every((v) => v === 0)
}

export type IshodKupovine = 'ok' | 'nemasNovca' | 'ostaviZaSeme'

/** Anti-softlock: kupovina ne sme da ostavi igrača bez para za seme kad ništa ne proizvodi. */
export function pametnaKupovina(s: Stanje, cena: number): IshodKupovine {
  if (s.novac < cena) return 'nemasNovca'
  if (s.novac - cena < KULTURE[SOFTLOCK_REZERVA_KULTURA].seme && !nestoRaste(s) && magPrazan(s)) {
    return 'ostaviZaSeme'
  }
  return 'ok'
}

/** Zajednička provera obe kupovine: `null` = sme, inače odbijen Rezultat (zvuk greške + poruka). */
export function proveriKupovinu(s: Stanje, cena: number): Rezultat | null {
  const ishod = pametnaKupovina(s, cena)
  if (ishod === 'ok') return null
  return {
    ok: false,
    dogadjaji: [
      { tip: 'zvuk', id: 'greska' },
      { tip: 'poruka', poruka: { id: ishod } },
    ],
    cuvaj: 'ne',
  }
}

function definicija(id: ZgradaId): { cena: number; nivo: number } {
  return jeMasina(id) ? MASINE[id] : ZIV[id]
}

function kupljena(s: Stanje, id: ZgradaId): boolean {
  return jeMasina(id) ? s.masine[id].k : s.ziv[id].k
}

export type StanjeZgrade = 'kupljeno' | 'dostupno' | 'zakljucano'

/** Kartica u radnji: kupljeno ✓, može da se kupi (nivo dovoljan), ili zaključano. */
export function stanjeZgrade(s: Stanje, id: ZgradaId): StanjeZgrade {
  if (kupljena(s, id)) return 'kupljeno'
  return nivoIzXp(s.xp).lvl >= definicija(id).nivo ? 'dostupno' : 'zakljucano'
}

/**
 * Kupovina mašine ili životinje. D7: odbija (tiho) već kupljenu zgradu i zgradu iznad nivoa —
 * u prototipu je to čuvao samo UI. Životinja počinje da proizvodi od `now`.
 */
export function kupiZgradu(g: Igra, id: ZgradaId, now: number): Rezultat {
  const s = g.s
  if (stanjeZgrade(s, id) !== 'dostupno') return ODBIJENO
  const D = definicija(id)
  const odbij = proveriKupovinu(s, D.cena)
  if (odbij) return odbij
  s.novac -= D.cena
  if (jeMasina(id)) {
    s.masine[id].k = true
  } else {
    s.ziv[id].k = true
    s.ziv[id].t = now
  }
  return {
    ok: true,
    dogadjaji: [
      { tip: 'zvuk', id: 'zetva' },
      { tip: 'vibracija', obrazac: VIBRACIJA_KUPOVINA },
      { tip: 'poruka', poruka: { id: 'zgradaNaFarmi', zgrada: id } },
    ],
    cuvaj: 'odlozeno',
  }
}
