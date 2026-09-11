/*
 * Zajednički pomoćnici za testove. Sva vremena su relativna u odnosu na fiksni T0,
 * a vremenska zona je fiksirana na Europe/Belgrade (vite.config.mts → test.env.TZ).
 */
import type { ArtikalId } from '../../src/config'
import type { Narudzba, Stanje } from '../../src/core/types'

export { mulberry32 } from '../../src/core/rng'

/** 15. 1. 2026. u 10:00 po beogradskom vremenu; lokalni dan '2026-01-15'. */
export const T0 = Date.UTC(2026, 0, 15, 9, 0, 0)
export const DAN_T0 = '2026-01-15'

/** Lokalni kalendarski dan — ista semantika kao prototip (`toLocaleDateString('sv')`). */
export const danKljuc = (now: number): string => new Date(now).toLocaleDateString('sv')

/** Skriptovani rng: vraća zadate vrednosti redom i BACA kad ih nestane — tako test
 *  zakucava i tačan broj izvlačenja, ne samo rezultat. */
export function niz(...vrednosti: number[]): (() => number) & { pozivi(): number } {
  let i = 0
  const f = () => {
    const v = vrednosti[i]
    if (v === undefined) throw new Error(`rng iscrpljen posle ${i} izvlačenja`)
    i++
    return v
  }
  return Object.assign(f, { pozivi: () => i })
}

export const MAG0: Record<ArtikalId, number> = {
  psenica: 0,
  sargarepa: 0,
  paprika: 0,
  bundeva: 0,
  grozdje: 0,
  brasno: 0,
  ajvar: 0,
  jaje: 0,
  mleko: 0,
}

/** Stanje za testove: prazna farma na T0, zvuk isključen, igrač je već sadio i današnji
 *  poklon je uzet (da start ne dodaje novac). Prepiši šta ti treba. */
export function stanje(o: Partial<Stanje> = {}): Stanje {
  return {
    v: 3,
    novac: 50,
    xp: 0,
    parcele: [
      { c: null, t: 0, z: false },
      { c: null, t: 0, z: false },
    ],
    mag: { ...MAG0 },
    masine: { mlin: { k: false, t: 0 }, kazan: { k: false, t: 0 } },
    ziv: { kokosinjac: { k: false, t: 0 }, stala: { k: false, t: 0 } },
    narudzbe: [],
    mute: true,
    sadio: true,
    stat: { ubrano: 0, zaradjeno: 0, isporuke: 0 },
    poklonDan: DAN_T0,
    videno: T0,
    ...o,
  }
}

export function narudzba(id: number, k: ArtikalId, kom: number, din: number, xp: number): Narudzba {
  return {
    id,
    ime: 'Baka Mira',
    emoji: '👵',
    boja: '#ffe0e6',
    msg: 'Za unučiće spremam ručak…',
    stavke: [{ k, kom }],
    din,
    xp,
  }
}
