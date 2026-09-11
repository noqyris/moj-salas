import { describe, expect, it } from 'vitest'
import { SVI_KLJUCEVI, baznaCena, type ArtikalId } from '../../src/config'
import { prodaj, robaNaTezgi, trzisnaCena } from '../../src/core/pijaca'
import { MAG0, T0 } from '../helpers'
import { igra, odbijeno } from './pomocnici'

type Red = Record<ArtikalId, [number, -1 | 0 | 1]>

/** 02 §4 zlatne vrednosti `{cena, smer}` (izmereno na prototipu). */
const ZLATNO: [number, Red][] = [
  [
    0,
    {
      psenica: [18, 0],
      sargarepa: [71, 1],
      paprika: [178, -1],
      bundeva: [775, -1],
      grozdje: [2470, 1],
      brasno: [134, 1],
      ajvar: [698, -1],
      jaje: [41, -1],
      mleko: [294, 1],
    },
  ],
  [
    150_000,
    {
      psenica: [21, 1],
      sargarepa: [61, 0],
      paprika: [158, -1],
      bundeva: [951, 1],
      grozdje: [2600, 1],
      brasno: [109, -1],
      ajvar: [696, -1],
      jaje: [50, 1],
      mleko: [280, 1],
    },
  ],
  [
    300_000,
    {
      psenica: [18, 0],
      sargarepa: [53, -1],
      paprika: [192, 1],
      bundeva: [1025, 1],
      grozdje: [2130, -1],
      brasno: [106, -1],
      ajvar: [862, 1],
      jaje: [49, 1],
      mleko: [226, -1],
    },
  ],
  [
    450_000,
    {
      psenica: [15, -1],
      sargarepa: [63, 0],
      paprika: [212, 1],
      bundeva: [849, -1],
      grozdje: [2000, -1],
      brasno: [131, 1],
      ajvar: [864, 1],
      jaje: [40, -1],
      mleko: [240, -1],
    },
  ],
  [
    1_789_111_418_888,
    {
      psenica: [20, 1],
      sargarepa: [55, -1],
      paprika: [170, -1],
      bundeva: [1021, 1],
      grozdje: [2413, 1],
      brasno: [102, -1],
      ajvar: [771, 0],
      jaje: [52, 1],
      mleko: [253, -1],
    },
  ],
]

describe('trzisnaCena', () => {
  it.each(ZLATNO)('zlatni red t=%i', (t, red) => {
    for (const k of SVI_KLJUCEVI) {
      const [cena, smer] = red[k]
      expect(trzisnaCena(k, t), k).toEqual({ cena, smer })
    }
  })

  it('t = 1 800 000 000 000 (tačno 3 000 000 perioda) = red za t = 0', () => {
    for (const k of SVI_KLJUCEVI) {
      expect(trzisnaCena(k, 1_800_000_000_000)).toEqual(trzisnaCena(k, 0))
    }
  })

  it('min/max u jednom periodu = round(baza·0.85) / round(baza·1.15) (02 §2.4)', () => {
    const ocekivano: Record<ArtikalId, [number, number]> = {
      psenica: [15, 21],
      sargarepa: [53, 71],
      paprika: [157, 213],
      bundeva: [765, 1035],
      grozdje: [1955, 2645],
      brasno: [102, 138],
      ajvar: [663, 897],
      jaje: [38, 52],
      mleko: [221, 299],
    }
    for (const k of SVI_KLJUCEVI) {
      let min = Infinity
      let max = -Infinity
      for (let t = 0; t < 600_000; t += 25) {
        const { cena } = trzisnaCena(k, t)
        min = Math.min(min, cena)
        max = Math.max(max, cena)
      }
      expect([min, max], k).toEqual(ocekivano[k])
      expect(min).toBeGreaterThan(10) // uvek dovoljno za seme pšenice (anti-softlock)
    }
  })

  it('udeo smerova u periodu (1 ms): 274 459 / 51 082 / 274 459 — pragovi 1.02 / 0.98', () => {
    const n = { gore: 0, prosek: 0, dole: 0 }
    for (let t = 0; t < 600_000; t++) {
      const { smer } = trzisnaCena('psenica', t)
      if (smer > 0) n.gore++
      else if (smer < 0) n.dole++
      else n.prosek++
    }
    expect(n).toEqual({ gore: 274_459, prosek: 51_082, dole: 274_459 })
  })

  it('smer se računa iz NEZAOKRUŽENOG množioca: prvi ▲ trenutak (12 771 ms) još ima baznu cenu', () => {
    expect(trzisnaCena('psenica', 12_770)).toEqual({ cena: 18, smer: 0 })
    expect(trzisnaCena('psenica', 12_771)).toEqual({ cena: 18, smer: 1 })
  })

  it('cena u T0 testova: pšenica 18, smer 0 (prototip)', () => {
    expect(trzisnaCena('psenica', T0)).toEqual({ cena: 18, smer: 0 })
  })
})

describe('robaNaTezgi', () => {
  it('artikli sa mag > 0, redosledom SVI_KLJUCEVI (C13, C36–C38)', () => {
    const s = igra({ mag: { ...MAG0, mleko: 1, psenica: 3, ajvar: 2, brasno: 1, jaje: 4 } }).s
    expect(robaNaTezgi(s)).toEqual(['psenica', 'brasno', 'ajvar', 'jaje', 'mleko'])
    expect(robaNaTezgi(igra().s)).toEqual([])
  })
})

describe('prodaj', () => {
  it('C14/C15: 1 pšenica u T0 → +18 din, zarađeno 18, artikal na nuli, bez XP', () => {
    const g = igra({ novac: 40, mag: { ...MAG0, psenica: 1, sargarepa: 2 } })
    const r = prodaj(g, 'psenica', T0)
    expect(r).toEqual({
      ok: true,
      dogadjaji: [
        { tip: 'novcici', sidro: { vrsta: 'prodaja', artikal: 'psenica' }, broj: 1 },
        { tip: 'poruka', poruka: { id: 'prodato', kom: 1, artikal: 'psenica', zarada: 18 } },
      ],
      cuvaj: 'odlozeno',
    })
    expect(g.s.novac).toBe(58)
    expect(g.s.stat.zaradjeno).toBe(18)
    expect(g.s.mag).toEqual({ ...MAG0, sargarepa: 2 })
    expect(g.s.xp).toBe(0)
  })

  it('prodaje SVE po ceni u trenutku klika; najviše 6 novčića', () => {
    const g = igra({ novac: 0, mag: { ...MAG0, ajvar: 9 } })
    const r = prodaj(g, 'ajvar', 150_000) // ajvar 696 u t = 150 000
    expect(r.dogadjaji[0]).toEqual({
      tip: 'novcici',
      sidro: { vrsta: 'prodaja', artikal: 'ajvar' },
      broj: 6,
    })
    expect(g.s.novac).toBe(696 * 9)
    expect(g.s.stat.zaradjeno).toBe(696 * 9)
    expect(g.s.novac).not.toBe(baznaCena('ajvar') * 9)
  })

  it('prazan artikal: tiho odbijeno', () => {
    const g = igra({ mag: { ...MAG0, psenica: 3 } })
    expect(odbijeno(g, () => prodaj(g, 'jaje', T0))).toEqual([])
  })
})
