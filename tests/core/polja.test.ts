import { describe, expect, it } from 'vitest'
import type { KulturaId } from '../../src/config'
import {
  fazaBiljke,
  kupiParcelu,
  pogledParcele,
  posadi,
  potpisNjiva,
  sledecaCenaParcele,
  uberi,
  uberiSve,
  zalij,
  zrelihUseva,
} from '../../src/core/polja'
import { praznaParcela } from '../../src/core/stanje'
import type { Parcela } from '../../src/core/types'
import { MAG0, T0 } from '../helpers'
import { igra, nivoi, odbijeno } from './pomocnici'

const zasadjena = (c: KulturaId, t: number, z = false): Parcela => ({ c, t, z })
const devetParcela = () => Array.from({ length: 9 }, praznaParcela)

describe('fazaBiljke', () => {
  it.each([
    [-3, 1],
    [0, 1],
    [0.3499, 1],
    [0.35, 2],
    [0.7999, 2],
    [0.8, 3],
    [0.999, 3],
  ])('u=%f → faza %i', (u, f) => {
    expect(fazaBiljke(u)).toBe(f)
  })
})

describe('potpisNjiva (03 §5, 07 R1 dopuna)', () => {
  it('pšenica: f1 [0,7000), f2 [7000,16000), f3 [16000,20000), z od 20000 ms', () => {
    const s = igra({ parcele: [zasadjena('psenica', T0), praznaParcela()] }).s
    expect(potpisNjiva(s, T0)).toBe('f1x')
    expect(potpisNjiva(s, T0 + 6999)).toBe('f1x')
    expect(potpisNjiva(s, T0 + 7000)).toBe('f2x')
    expect(potpisNjiva(s, T0 + 15_999)).toBe('f2x')
    expect(potpisNjiva(s, T0 + 16_000)).toBe('f3x')
    expect(potpisNjiva(s, T0 + 19_999)).toBe('f3x')
    expect(potpisNjiva(s, T0 + 20_000)).toBe('zx')
    expect(potpisNjiva(s, T0 + 9e9)).toBe('zx')
  })

  it('grožđe: f2 od 2 520 000, f3 od 5 760 000, z od 7 200 000 ms', () => {
    const s = igra({ parcele: [zasadjena('grozdje', T0)] }).s
    expect(potpisNjiva(s, T0 + 2_519_999)).toBe('f1')
    expect(potpisNjiva(s, T0 + 2_520_000)).toBe('f2')
    expect(potpisNjiva(s, T0 + 5_759_999)).toBe('f2')
    expect(potpisNjiva(s, T0 + 5_760_000)).toBe('f3')
    expect(potpisNjiva(s, T0 + 7_199_999)).toBe('f3')
    expect(potpisNjiva(s, T0 + 7_200_000)).toBe('z')
  })

  it.each([
    ['sargarepa', 90],
    ['paprika', 300],
    ['bundeva', 1800],
  ] as const)('%s: tačno 0.35 i 0.8 udela već pripadaju fazama 2 i 3', (c, vreme) => {
    const s = igra({ parcele: [zasadjena(c, T0)] }).s
    const f2 = vreme * 350 // 0.35 · vreme · 1000
    const f3 = vreme * 800
    expect(potpisNjiva(s, T0 + f2 - 1)).toBe('f1')
    expect(potpisNjiva(s, T0 + f2)).toBe('f2')
    expect(potpisNjiva(s, T0 + f3 - 1)).toBe('f2')
    expect(potpisNjiva(s, T0 + f3)).toBe('f3')
  })

  it('jedan token po parceli, spojeno: "zxf1"', () => {
    const s = igra({
      parcele: [zasadjena('psenica', T0 - 20_000), praznaParcela(), zasadjena('grozdje', T0)],
    }).s
    expect(potpisNjiva(s, T0)).toBe('zxf1')
  })
})

describe('pogledParcele i zrelihUseva', () => {
  it('prazna / raste (faza, udeo, preostalo, zalivena) / zrela', () => {
    expect(pogledParcele(praznaParcela(), T0)).toEqual({ vrsta: 'prazna' })
    const p = zasadjena('psenica', T0)
    expect(pogledParcele(p, T0 + 5000)).toEqual({
      vrsta: 'raste',
      c: 'psenica',
      faza: 1,
      udeo: 0.25,
      preostaloS: 15,
      zalivena: false,
    })
    expect(pogledParcele({ ...p, z: true }, T0 + 16_000)).toEqual({
      vrsta: 'raste',
      c: 'psenica',
      faza: 3,
      udeo: 0.8,
      preostaloS: 4,
      zalivena: true,
    })
    expect(pogledParcele(p, T0 + 20_000)).toEqual({ vrsta: 'zrela', c: 'psenica' })
  })

  it('sat vraćen 60 s: faza 1, negativan udeo, odbrojavanje 80 s (prototip „1:20")', () => {
    expect(pogledParcele(zasadjena('psenica', T0), T0 - 60_000)).toEqual({
      vrsta: 'raste',
      c: 'psenica',
      faza: 1,
      udeo: -3,
      preostaloS: 80,
      zalivena: false,
    })
  })

  it('C11: zalivena pri sadnji → zrela tačno 15 000 ms kasnije', () => {
    const g = igra({ parcele: [zasadjena('psenica', T0), praznaParcela()] })
    expect(zalij(g, 0, T0).ok).toBe(true)
    expect(zrelihUseva(g.s, T0 + 14_999)).toBe(0)
    expect(zrelihUseva(g.s, T0 + 15_000)).toBe(1)
  })

  it('broji samo zrele (prazne i one koje rastu ne)', () => {
    const s = igra({
      parcele: [
        zasadjena('psenica', T0 - 20_000),
        praznaParcela(),
        zasadjena('sargarepa', T0 - 89_999),
        zasadjena('sargarepa', T0 - 90_000),
      ],
    }).s
    expect(zrelihUseva(s, T0)).toBe(2)
  })
})

describe('posadi', () => {
  it('C05/C06: prva sadnja — parcela, novac 50→40, sadio, savet posle 700 ms, bez XP', () => {
    const g = igra({ sadio: false, novac: 50 })
    const r = posadi(g, 0, 'psenica', T0)
    expect(r).toEqual({
      ok: true,
      dogadjaji: [
        { tip: 'zvuk', id: 'sadnja' },
        { tip: 'vibracija', obrazac: 12 },
        { tip: 'poruka', poruka: { id: 'savetZalivanje' }, odlozenoMs: 700 },
      ],
      cuvaj: 'odlozeno',
    })
    expect(g.s.parcele[0]).toEqual({ c: 'psenica', t: T0, z: false })
    expect(g.s.novac).toBe(40)
    expect(g.s.sadio).toBe(true)
    expect(g.s.xp).toBe(0)
    expect(potpisNjiva(g.s, T0)).toBe('f1x')
  })

  it('savet samo prvi put u igri', () => {
    const g = igra({ sadio: false, novac: 50 })
    posadi(g, 0, 'psenica', T0)
    expect(posadi(g, 1, 'psenica', T0).dogadjaji).toEqual([
      { tip: 'zvuk', id: 'sadnja' },
      { tip: 'vibracija', obrazac: 12 },
    ])
    expect(g.s.novac).toBe(30)
  })

  it('sme da potroši poslednjih 10 din na pšenicu (seme nema anti-softlock)', () => {
    const g = igra({ novac: 10 })
    expect(posadi(g, 1, 'psenica', T0).ok).toBe(true)
    expect(g.s.novac).toBe(0)
  })

  it('kultura sa nivoa tačno dostignutog nivoa je dozvoljena (paprika na nivou 2)', () => {
    const g = igra({ xp: 30, novac: 80 })
    expect(posadi(g, 0, 'paprika', T0).ok).toBe(true)
    expect(g.s.novac).toBe(0)
  })

  describe('D2 zaštite (tiho odbijanje, stanje netaknuto)', () => {
    it('zauzeta parcela — dupli tap ne naplaćuje dvaput i ne resetuje rast', () => {
      const g = igra({ novac: 1000 })
      posadi(g, 0, 'psenica', T0)
      expect(odbijeno(g, () => posadi(g, 0, 'psenica', T0 + 50))).toEqual([])
      expect(odbijeno(g, () => posadi(g, 0, 'sargarepa', T0 + 50))).toEqual([])
    })
    it.each([-1, 2, 0.5, Number.NaN])('indeks van opsega: %f', (i) => {
      const g = igra({ novac: 1000 })
      odbijeno(g, () => posadi(g, i, 'psenica', T0))
    })
    it('zaključana kultura: paprika na nivou 1, grožđe na nivou 3', () => {
      const g1 = igra({ xp: 29, novac: 10_000 })
      odbijeno(g1, () => posadi(g1, 0, 'paprika', T0))
      const g3 = igra({ xp: 194, novac: 10_000 })
      odbijeno(g3, () => posadi(g3, 0, 'grozdje', T0))
    })
    it('nema dovoljno za seme: 9 din za pšenicu, 29 za šargarepu', () => {
      const g = igra({ novac: 9 })
      odbijeno(g, () => posadi(g, 0, 'psenica', T0))
      const g2 = igra({ novac: 29 })
      odbijeno(g2, () => posadi(g2, 0, 'sargarepa', T0))
    })
  })
})

describe('zalij', () => {
  it('uspeh: događaji tačno ovim redom, parcela menjana na mestu', () => {
    const g = igra({ parcele: [praznaParcela(), zasadjena('psenica', T0)] })
    const p = g.s.parcele[1]
    const r = zalij(g, 1, T0 + 1300)
    expect(r).toEqual({
      ok: true,
      dogadjaji: [
        { tip: 'zvuk', id: 'voda' },
        { tip: 'vibracija', obrazac: 10 },
        { tip: 'kapi', i: 1 },
        { tip: 'poruka', poruka: { id: 'zaliveno' } },
      ],
      cuvaj: 'odlozeno',
    })
    // 03 §6: pšenica zalivena 1,3 s posle sadnje pomera t za tačno 4 675 ms
    expect(g.s.parcele[1]).toBe(p)
    expect(p).toEqual({ c: 'psenica', t: T0 - 4675, z: true })
  })

  it('grožđe zaliveno pri sadnji: −1 800 000 ms, zrelo na 5 400 000, ne na 5 399 999', () => {
    const g = igra({ parcele: [zasadjena('grozdje', T0)] })
    zalij(g, 0, T0)
    expect(g.s.parcele[0]?.t).toBe(T0 - 1_800_000)
    expect(zrelihUseva(g.s, T0 + 5_399_999)).toBe(0)
    expect(zrelihUseva(g.s, T0 + 5_400_000)).toBe(1)
  })

  it('zaštite: van opsega i prazna parcela — tiho', () => {
    const g = igra()
    expect(odbijeno(g, () => zalij(g, 0, T0))).toEqual([])
    expect(odbijeno(g, () => zalij(g, 7, T0))).toEqual([])
  })

  it('zrela i već zalivena → „Već je zaliveno" (redosled provera kao u prototipu)', () => {
    const g = igra({ parcele: [zasadjena('psenica', T0 - 30_000, true)] })
    expect(odbijeno(g, () => zalij(g, 0, T0))).toEqual([
      { tip: 'zvuk', id: 'tap' },
      { tip: 'poruka', poruka: { id: 'vecZaliveno' } },
    ])
  })
})

describe('uberi', () => {
  it('C12: parcela prazna (nov objekat), mag +1, ubrano +1, xp +2, događaji', () => {
    const g = igra({ parcele: [zasadjena('psenica', T0 - 20_000, true), praznaParcela()] })
    const stara = g.s.parcele[0]
    const r = uberi(g, 0, T0)
    expect(r).toEqual({
      ok: true,
      dogadjaji: [
        { tip: 'zvuk', id: 'zetva' },
        { tip: 'vibracija', obrazac: 18 },
        { tip: 'xp', iznos: 2, sidro: { vrsta: 'parcela', i: 0 } },
      ],
      cuvaj: 'odlozeno',
    })
    expect(g.s.parcele[0]).toEqual({ c: null, t: 0, z: false })
    expect(g.s.parcele[0]).not.toBe(stara)
    expect(g.s.mag).toEqual({ ...MAG0, psenica: 1 })
    expect(g.s.stat).toEqual({ ubrano: 1, zaradjeno: 0, isporuke: 0 })
    expect(g.s.xp).toBe(2)
  })

  it('žetva koja diže nivo: nivo posle xp, bonus odmah', () => {
    const g = igra({ xp: 28, novac: 0, parcele: [zasadjena('psenica', T0 - 20_000)] })
    const d = uberi(g, 0, T0).dogadjaji
    expect(d.map((e) => e.tip)).toEqual(['zvuk', 'vibracija', 'xp', 'nivo'])
    expect(g.s.novac).toBe(80)
  })

  describe('D1 zaštite', () => {
    it('dupli tap: druga žetva iste parcele ne radi ništa (nema mag["null"])', () => {
      const g = igra({ parcele: [zasadjena('psenica', T0 - 20_000), praznaParcela()] })
      expect(uberi(g, 0, T0).ok).toBe(true)
      expect(odbijeno(g, () => uberi(g, 0, T0 + 60))).toEqual([])
      expect(Object.keys(g.s.mag)).toEqual(Object.keys(MAG0))
      expect(g.s.stat.ubrano).toBe(1)
    })
    it('nezrela (1 ms pre roka), prazna, van opsega', () => {
      const g = igra({ parcele: [zasadjena('grozdje', T0 - 7_199_999), praznaParcela()] })
      odbijeno(g, () => uberi(g, 0, T0))
      odbijeno(g, () => uberi(g, 1, T0))
      odbijeno(g, () => uberi(g, 2, T0))
      odbijeno(g, () => uberi(g, -1, T0))
    })
  })
})

describe('uberiSve', () => {
  it('bere sve zrele redom, jedan xp događaj sa zbirom, poruka na kraju', () => {
    const g = igra({
      parcele: [
        zasadjena('psenica', T0 - 20_000),
        praznaParcela(),
        zasadjena('sargarepa', T0 - 90_000),
        zasadjena('sargarepa', T0 - 1000),
        zasadjena('psenica', T0 - 99_000, true),
      ],
    })
    const r = uberiSve(g, T0)
    expect(r).toEqual({
      ok: true,
      dogadjaji: [
        { tip: 'zvuk', id: 'zetva' },
        { tip: 'vibracija', obrazac: [15, 25, 15] },
        { tip: 'xp', iznos: 9, sidro: { vrsta: 'uberiSve' } },
        { tip: 'poruka', poruka: { id: 'ubranoSve', br: 3 } },
      ],
      cuvaj: 'odlozeno',
    })
    expect(g.s.parcele.map((p) => p.c)).toEqual([null, null, null, 'sargarepa', null])
    expect(g.s.mag).toEqual({ ...MAG0, psenica: 2, sargarepa: 1 })
    expect(g.s.stat.ubrano).toBe(3)
  })

  it('radi i za jednu zrelu; poruka dolazi POSLE level-up-ova', () => {
    const g = igra({ xp: 25, novac: 0, parcele: [zasadjena('sargarepa', T0 - 90_000)] })
    const d = uberiSve(g, T0).dogadjaji
    expect(d.map((e) => e.tip)).toEqual(['zvuk', 'vibracija', 'xp', 'nivo', 'poruka'])
    expect(nivoi(d)).toEqual([[2, 80]])
  })

  it('bez zrelih: tiho odbijeno', () => {
    const g = igra({ parcele: [zasadjena('psenica', T0 - 19_999), praznaParcela()] })
    expect(odbijeno(g, () => uberiSve(g, T0))).toEqual([])
  })
})

describe('parcele: cena i kupovina', () => {
  it('cena sledeće parcele po TRENUTNOM broju: 150 … 17 010, pa null na 9', () => {
    const cene = []
    for (let n = 2; n <= 9; n++) {
      cene.push(sledecaCenaParcele(igra({ parcele: Array.from({ length: n }, praznaParcela) }).s))
    }
    expect(cene).toEqual([150, 330, 730, 1600, 3510, 7730, 17010, null])
  })

  it('kupovina: novac − cena, nova prazna parcela na kraju, događaji', () => {
    const g = igra({ novac: 1000 })
    const r = kupiParcelu(g, T0)
    expect(r).toEqual({
      ok: true,
      dogadjaji: [
        { tip: 'zvuk', id: 'zetva' },
        { tip: 'vibracija', obrazac: 20 },
        { tip: 'poruka', poruka: { id: 'novaParcela' } },
      ],
      cuvaj: 'odlozeno',
    })
    expect(g.s.novac).toBe(850)
    expect(g.s.parcele).toEqual([praznaParcela(), praznaParcela(), praznaParcela()])
  })

  it('od 2 do 9 parcela ukupno 31 060 din; na 9 tiho odbija (D7)', () => {
    const g = igra({ novac: 40_000 })
    while (kupiParcelu(g, T0).ok);
    expect(g.s.parcele).toHaveLength(9)
    expect(g.s.novac).toBe(40_000 - 31_060)
    expect(odbijeno(g, () => kupiParcelu(g, T0))).toEqual([])
  })

  it('D7: na 9 parcela odbija i kad ima para (prototip je davao 10. parcelu)', () => {
    const g = igra({ novac: 1e9, parcele: devetParcela() })
    odbijeno(g, () => kupiParcelu(g, T0))
  })
})
