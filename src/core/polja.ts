/*
 * Njive: rast, sadnja, zalivanje, žetva, kupovina parcela (prototip L770–778, L972–1019, L1048–1054).
 * Rast je čisto `now − p.t`; svaka provera zadržava TAČAN izraz iz prototipa (deljenje sa 1000,
 * `>=`), da granični testovi važe bit za bit.
 */
import {
  FAZA_2_OD,
  FAZA_3_OD,
  KULTURE,
  MAX_PARCELA,
  SAVET_ZALIVANJE_ODLAGANJE_MS,
  ZALIVANJE_UDEO,
  cenaParcele,
  type KulturaId,
} from '../config'
import { ODBIJENO, type Dogadjaj, type Igra, type Rezultat } from './dogadjaji'
import { VIBRACIJA_KUPOVINA, proveriKupovinu } from './radnja'
import { praznaParcela } from './stanje'
import type { Parcela, Stanje } from './types'
import { dodajXp, nivoIzXp } from './xp'

// Obrasci vibracije iz prototipa (ms).
const VIBRACIJA_SADNJA = 12
const VIBRACIJA_ZALIVANJE = 10
const VIBRACIJA_ZETVA = 18
const VIBRACIJA_UBERI_SVE: readonly number[] = [15, 25, 15]

export type Faza = 1 | 2 | 3

/** Vizuelna faza biljke za udeo rasta `u` (1 = klica). Tačno 0.35 i 0.8 već pripadaju višoj fazi. */
export function fazaBiljke(u: number): Faza {
  return u < FAZA_2_OD ? 1 : u < FAZA_3_OD ? 2 : 3
}

export type PogledParcele =
  | { vrsta: 'prazna' }
  | { vrsta: 'zrela'; c: KulturaId }
  | {
      vrsta: 'raste'
      c: KulturaId
      faza: Faza
      /** Udeo rasta za traku (< 1; negativan ako je sat vraćen unazad). */
      udeo: number
      /** Sekunde do zrenja, nezaokružene (UI ih formatira sa `vremeTxt`). */
      preostaloS: number
      zalivena: boolean
    }

/** Model pločice parcele (prototip `crtajNjive`, L791–807). */
export function pogledParcele(p: Parcela, now: number): PogledParcele {
  if (!p.c) return { vrsta: 'prazna' }
  const K = KULTURE[p.c]
  const proslo = (now - p.t) / 1000
  const udeo = Math.min(1, proslo / K.vreme)
  if (udeo >= 1) return { vrsta: 'zrela', c: p.c }
  return {
    vrsta: 'raste',
    c: p.c,
    faza: fazaBiljke(udeo),
    udeo,
    preostaloS: K.vreme - proslo,
    zalivena: p.z,
  }
}

/** Potpis njiva: po jedan znak/token po parceli (`x` prazna, `z` zrela, `f1`–`f3` faza), spojeno. */
export function potpisNjiva(s: Stanje, now: number): string {
  return s.parcele
    .map((p) => {
      if (!p.c) return 'x'
      const u = (now - p.t) / 1000 / KULTURE[p.c].vreme
      return u >= 1 ? 'z' : 'f' + fazaBiljke(u)
    })
    .join('')
}

function jeZrela(p: Parcela, now: number): p is Parcela & { c: KulturaId } {
  return p.c !== null && (now - p.t) / 1000 >= KULTURE[p.c].vreme
}

export function zrelihUseva(s: Stanje, now: number): number {
  return s.parcele.filter((p) => jeZrela(p, now)).length
}

/**
 * Sadnja kulture `k` na parcelu `i`. D2: tiho odbija indeks van opsega, zauzetu parcelu,
 * zaključanu kulturu i nedovoljno novca (prototip je proveravao samo novac).
 * XP se ne dobija pri sadnji. Savet o zalivanju ide samo posle prve sadnje u igri.
 */
export function posadi(g: Igra, i: number, k: KulturaId, now: number): Rezultat {
  const s = g.s
  const p = s.parcele[i]
  const K = KULTURE[k]
  if (!p || p.c || nivoIzXp(s.xp).lvl < K.nivo || s.novac < K.seme) return ODBIJENO
  const prvi = !s.sadio
  s.novac -= K.seme
  s.parcele[i] = { c: k, t: now, z: false }
  s.sadio = true
  const dogadjaji: Dogadjaj[] = [
    { tip: 'zvuk', id: 'sadnja' },
    { tip: 'vibracija', obrazac: VIBRACIJA_SADNJA },
  ]
  if (prvi) {
    dogadjaji.push({
      tip: 'poruka',
      poruka: { id: 'savetZalivanje' },
      odlozenoMs: SAVET_ZALIVANJE_ODLAGANJE_MS,
    })
  }
  return { ok: true, dogadjaji, cuvaj: 'odlozeno' }
}

/**
 * Zalivanje: jednom po usevu, skida 25 % PREOSTALOG vremena (`Math.round`, pola naviše).
 * Prazna parcela ili (skoro) zreo usev: tiho. Već zaliveno: zvuk + poruka, bez promene.
 * Nema ponovnog crtanja — traku i fazu sustiže sledeći tick.
 */
export function zalij(g: Igra, i: number, now: number): Rezultat {
  const p = g.s.parcele[i]
  if (!p || !p.c) return ODBIJENO
  if (p.z) {
    return {
      ok: false,
      dogadjaji: [
        { tip: 'zvuk', id: 'tap' },
        { tip: 'poruka', poruka: { id: 'vecZaliveno' } },
      ],
      cuvaj: 'ne',
    }
  }
  const preostalo = KULTURE[p.c].vreme * 1000 - (now - p.t)
  if (preostalo <= 0) return ODBIJENO
  p.z = true
  p.t -= Math.round(preostalo * ZALIVANJE_UDEO)
  return {
    ok: true,
    dogadjaji: [
      { tip: 'zvuk', id: 'voda' },
      { tip: 'vibracija', obrazac: VIBRACIJA_ZALIVANJE },
      { tip: 'kapi', i },
      { tip: 'poruka', poruka: { id: 'zaliveno' } },
    ],
    cuvaj: 'odlozeno',
  }
}

/** Prototip `uberiJedan`: +1 u magacin, +1 ubrano, parcela postaje NOV prazan objekat. */
function uberiJedan(s: Stanje, i: number, k: KulturaId): number {
  s.mag[k]++
  s.stat.ubrano++
  s.parcele[i] = praznaParcela()
  return KULTURE[k].xp
}

/**
 * Žetva jedne parcele. D1: tiho odbija sve osim postojeće, zasađene i zrele parcele (dupli tap
 * u prototipu je pisao `mag["null"]` i bacao grešku). UI crta njivu tek posle 180 ms.
 */
export function uberi(g: Igra, i: number, now: number): Rezultat {
  const p = g.s.parcele[i]
  if (!p || !jeZrela(p, now)) return ODBIJENO
  const xp = uberiJedan(g.s, i, p.c)
  return {
    ok: true,
    dogadjaji: [
      { tip: 'zvuk', id: 'zetva' },
      { tip: 'vibracija', obrazac: VIBRACIJA_ZETVA },
      ...dodajXp(g, xp, { vrsta: 'parcela', i }),
    ],
    cuvaj: 'odlozeno',
  }
}

/** „Uberi sve": sve zrele parcele redom, JEDAN `dodajXp` sa zbirom, poruka posle level-up-ova. */
export function uberiSve(g: Igra, now: number): Rezultat {
  const s = g.s
  let xp = 0
  let br = 0
  s.parcele.forEach((p, i) => {
    if (jeZrela(p, now)) {
      xp += uberiJedan(s, i, p.c)
      br++
    }
  })
  if (!br) return ODBIJENO
  return {
    ok: true,
    dogadjaji: [
      { tip: 'zvuk', id: 'zetva' },
      { tip: 'vibracija', obrazac: VIBRACIJA_UBERI_SVE },
      ...dodajXp(g, xp, { vrsta: 'uberiSve' }),
      { tip: 'poruka', poruka: { id: 'ubranoSve', br } },
    ],
    cuvaj: 'odlozeno',
  }
}

/** Cena sledeće parcele (argument je TRENUTNI broj parcela), ili null kad ih već ima MAX_PARCELA. */
export function sledecaCenaParcele(s: Stanje): number | null {
  return s.parcele.length < MAX_PARCELA ? cenaParcele(s.parcele.length) : null
}

/**
 * Kupovina parcele. D7: na MAX_PARCELA tiho odbija, a cenu računa core (prototip je primao cenu
 * uhvaćenu pri crtanju). Prolazi kroz anti-softlock proveru.
 */
export function kupiParcelu(g: Igra, _now: number): Rezultat {
  const s = g.s
  const cena = sledecaCenaParcele(s)
  if (cena === null) return ODBIJENO
  const odbij = proveriKupovinu(s, cena)
  if (odbij) return odbij
  s.novac -= cena
  s.parcele.push(praznaParcela())
  return {
    ok: true,
    dogadjaji: [
      { tip: 'zvuk', id: 'zetva' },
      { tip: 'vibracija', obrazac: VIBRACIJA_KUPOVINA },
      { tip: 'poruka', poruka: { id: 'novaParcela' } },
    ],
    cuvaj: 'odlozeno',
  }
}
