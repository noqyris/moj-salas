import { describe, expect, it } from 'vitest'
import { nivoBonus } from '../../src/config'
import { dodajXp, nivoIzXp, otkljucanoNaNivou } from '../../src/core/xp'
import { igra, nivoi } from './pomocnici'

/** Ukupan XP za dostizanje nivoa 2..20 (02 §2.2, izmereno na prototipu). */
const KUMULATIVNO = [
  30, 87, 195, 401, 792, 1535, 2946, 5628, 10723, 20404, 38797, 73744, 140143, 266302, 506004,
  961438, 1826762, 3470878, 6594699,
]

describe('nivoIzXp (02 §3, izmereno)', () => {
  it.each([
    [0, { lvl: 1, u: 0, do: 30 }],
    [29, { lvl: 1, u: 29, do: 30 }],
    [30, { lvl: 2, u: 0, do: 57 }],
    [86, { lvl: 2, u: 56, do: 57 }],
    [87, { lvl: 3, u: 0, do: 108 }],
    [150, { lvl: 3, u: 63, do: 108 }],
    [200, { lvl: 4, u: 5, do: 206 }],
    [5000, { lvl: 8, u: 2054, do: 2682 }], // C22
  ])('nivoIzXp(%i)', (xp, ocekivano) => {
    expect(nivoIzXp(xp)).toEqual(ocekivano)
  })

  it('granica svakog nivoa: tačno kumulativni XP diže nivo, jedan manje ne', () => {
    KUMULATIVNO.forEach((cum, i) => {
      const L = i + 2
      expect(nivoIzXp(cum)).toMatchObject({ lvl: L, u: 0 })
      expect(nivoIzXp(cum - 1).lvl).toBe(L - 1)
    })
  })

  it('plafon 20: u raste bez granice i može da pređe do', () => {
    expect(nivoIzXp(6594698)).toEqual({ lvl: 19, u: 3123820, do: 3123821 })
    expect(nivoIzXp(6594699)).toEqual({ lvl: 20, u: 0, do: 5935259 })
    expect(nivoIzXp(6594699 + 5935259)).toEqual({ lvl: 20, u: 5935259, do: 5935259 })
    expect(nivoIzXp(1e12)).toEqual({ lvl: 20, u: 999993405301, do: 5935259 })
  })
})

describe('otkljucanoNaNivou (02 §2.3)', () => {
  it('nivoi 2–6 najavljuju tačno ove stvari, ovim redom', () => {
    expect(otkljucanoNaNivou(2)).toEqual([
      { vrsta: 'kultura', id: 'paprika' },
      { vrsta: 'masina', id: 'mlin' },
    ])
    expect(otkljucanoNaNivou(3)).toEqual([
      { vrsta: 'kultura', id: 'bundeva' },
      { vrsta: 'masina', id: 'kazan' },
      { vrsta: 'zivotinja', id: 'kokosinjac' },
    ])
    expect(otkljucanoNaNivou(4)).toEqual([{ vrsta: 'kultura', id: 'grozdje' }])
    expect(otkljucanoNaNivou(5)).toEqual([{ vrsta: 'zivotinja', id: 'stala' }])
    expect(otkljucanoNaNivou(6)).toEqual([{ vrsta: 'aukcija' }])
  })

  it('od nivoa 7 nema otključavanja', () => {
    for (let l = 7; l <= 20; l++) expect(otkljucanoNaNivou(l)).toEqual([])
  })

  it('nivo 1 su početne kulture (kartica za nivo 1 se nikad ne prikazuje)', () => {
    expect(otkljucanoNaNivou(1)).toEqual([
      { vrsta: 'kultura', id: 'psenica' },
      { vrsta: 'kultura', id: 'sargarepa' },
    ])
  })
})

describe('dodajXp', () => {
  it('bez prelaska nivoa vraća samo xp događaj sa sidrom', () => {
    const g = igra({ xp: 10, novac: 50 })
    const d = dodajXp(g, 5, { vrsta: 'parcela', i: 1 })
    expect(d).toEqual([{ tip: 'xp', iznos: 5, sidro: { vrsta: 'parcela', i: 1 } }])
    expect(g.s.xp).toBe(15)
    expect(g.s.novac).toBe(50)
    expect(g.prosliNivo).toBe(1)
  })

  it('C16: prelazak 30 XP daje TAČNO jedan nivo {2, 80}, bonus odmah u novcu', () => {
    const g = igra({ xp: 28, novac: 50 })
    const d = dodajXp(g, 2, { vrsta: 'parcela', i: 0 })
    expect(d).toEqual([
      { tip: 'xp', iznos: 2, sidro: { vrsta: 'parcela', i: 0 } },
      {
        tip: 'nivo',
        nivo: 2,
        bonus: 80,
        otkljucano: [
          { vrsta: 'kultura', id: 'paprika' },
          { vrsta: 'masina', id: 'mlin' },
        ],
      },
    ])
    expect(g.s.novac).toBe(130)
    expect(g.prosliNivo).toBe(2)
  })

  it('1 → 20 jednim pozivom: 19 nivoa redom, ukupan bonus 8 360, pa više ništa', () => {
    const g = igra({ xp: 0, novac: 0 })
    const d = dodajXp(g, 1e9, { vrsta: 'uberiSve' })
    const n = nivoi(d)
    expect(n.map(([l]) => l)).toEqual(Array.from({ length: 19 }, (_, i) => i + 2))
    expect(n.every(([l, b]) => b === nivoBonus(l))).toBe(true)
    expect(g.s.novac).toBe(8360)
    expect(g.prosliNivo).toBe(20)
    expect(nivoi(dodajXp(g, 1e9, { vrsta: 'uberiSve' }))).toEqual([])
    expect(g.s.novac).toBe(8360)
  })

  it('nula XP ne pravi level-up; sesija koja kasni sustiže (prosliNivo < nivo iz XP)', () => {
    const g = igra({ xp: 100, novac: 0 })
    expect(dodajXp(g, 0, { vrsta: 'uberiSve' })).toHaveLength(1)
    // Namerno zaostala sesija: sledeći dodajXp isplati SVE propuštene nivoe (3), ne ponavlja 1.
    g.prosliNivo = 1
    expect(nivoi(dodajXp(g, 0, { vrsta: 'uberiSve' }))).toEqual([
      [2, 80],
      [3, 120],
    ])
  })
})
