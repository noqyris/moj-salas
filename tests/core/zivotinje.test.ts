import { describe, expect, it } from 'vitest'
import { pogledZivotinje, pokupi, zivSpremno } from '../../src/core/zivotinje'
import { MAG0, T0 } from '../helpers'
import { igra, nivoi, odbijeno } from './pomocnici'

const I_KOKA = 180_000
const I_KRAVA = 600_000

const koka = (t: number) => ({ kokosinjac: { k: true, t }, stala: { k: false, t: 0 } })
const krava = (t: number) => ({ kokosinjac: { k: false, t: 0 }, stala: { k: true, t } })

describe('zivSpremno (D3/D4: u [0, kap])', () => {
  it('nekupljena: 0 (i sa zaostalim t)', () => {
    const s = igra({ ziv: { kokosinjac: { k: false, t: T0 - 9e9 }, stala: { k: false, t: 0 } } }).s
    expect(zivSpremno(s, 'kokosinjac', T0)).toBe(0)
  })

  it('kokošinjac: jedno jaje na 180 s, najviše 4', () => {
    const s = igra({ ziv: koka(T0) }).s
    expect(zivSpremno(s, 'kokosinjac', T0 + I_KOKA - 1)).toBe(0)
    expect(zivSpremno(s, 'kokosinjac', T0 + I_KOKA)).toBe(1)
    expect(zivSpremno(s, 'kokosinjac', T0 + 3 * I_KOKA)).toBe(3)
    expect(zivSpremno(s, 'kokosinjac', T0 + 4 * I_KOKA)).toBe(4)
    expect(zivSpremno(s, 'kokosinjac', T0 + 36_000_000)).toBe(4)
  })

  it('C33/C35: 1 861 s posle kupovine — 4 jaja, 3 mleka', () => {
    const s = igra({ ziv: { kokosinjac: { k: true, t: T0 }, stala: { k: true, t: T0 } } }).s
    expect(pogledZivotinje(s, 'kokosinjac', T0 + 1_861_000).n).toBe(4)
    expect(pogledZivotinje(s, 'stala', T0 + 1_861_000).n).toBe(3)
  })

  it('D4: sat vraćen iza z.t → 0 (prototip je davao −2)', () => {
    const s = igra({ ziv: koka(T0) }).s
    expect(zivSpremno(s, 'kokosinjac', T0 - 200_000)).toBe(0)
    expect(zivSpremno(s, 'kokosinjac', T0 - 1)).toBe(0)
  })
})

describe('pokupi', () => {
  it('C34 (D3): pun kokošinjac → +4 jaja, +4 XP, +4 ubrano, proizvodnja kreće od sada', () => {
    const now = T0 + 1_861_000
    const g = igra({ xp: 5000, ziv: koka(T0) })
    const r = pokupi(g, 'kokosinjac', now)
    expect(r).toEqual({
      ok: true,
      dogadjaji: [
        { tip: 'zvuk', id: 'zetva' },
        { tip: 'vibracija', obrazac: 14 },
        { tip: 'xp', iznos: 4, sidro: { vrsta: 'zivotinja', id: 'kokosinjac' } },
        { tip: 'poruka', poruka: { id: 'pokupljeno', n: 4, zivotinja: 'kokosinjac' } },
      ],
      cuvaj: 'odlozeno',
    })
    expect(g.s.mag).toEqual({ ...MAG0, jaje: 4 })
    expect(g.s.xp).toBe(5004)
    expect(g.s.stat.ubrano).toBe(4)
    expect(g.s.ziv.kokosinjac).toEqual({ k: true, t: now })
    // prototip bi ovde odmah dao još 4 (06#3); sa D3 nema ništa dok ne prođe novi interval
    expect(odbijeno(g, () => pokupi(g, 'kokosinjac', now))).toEqual([])
    expect(zivSpremno(g.s, 'kokosinjac', now + I_KOKA)).toBe(1)
  })

  it('štala: 3 mleka × 6 XP', () => {
    const g = igra({ xp: 5000, ziv: krava(T0) })
    const r = pokupi(g, 'stala', T0 + 3 * I_KRAVA)
    expect(r.dogadjaji).toContainEqual({
      tip: 'xp',
      iznos: 18,
      sidro: { vrsta: 'zivotinja', id: 'stala' },
    })
    expect(r.dogadjaji).toContainEqual({
      tip: 'poruka',
      poruka: { id: 'pokupljeno', n: 3, zivotinja: 'stala' },
    })
    expect(g.s.mag.mleko).toBe(3)
    expect(g.s.ziv.stala.t).toBe(T0 + 3 * I_KRAVA)
  })

  it('nije puno: delimičan napredak ostaje (2 intervala + 50 s → t pomeren za 2 intervala)', () => {
    const t = T0 - (2 * I_KOKA + 50_000)
    const g = igra({ ziv: koka(t) })
    expect(pokupi(g, 'kokosinjac', T0).ok).toBe(true)
    expect(g.s.mag.jaje).toBe(2)
    expect(g.s.ziv.kokosinjac.t).toBe(T0 - 50_000)
    expect(pogledZivotinje(g.s, 'kokosinjac', T0)).toEqual({ n: 0, udeo: 50 / 180 })
    expect(zivSpremno(g.s, 'kokosinjac', T0 + 129_999)).toBe(0)
    expect(zivSpremno(g.s, 'kokosinjac', T0 + 130_000)).toBe(1)
  })

  it('granica kapaciteta: 4 intervala − 1 ms (3 spremna) čuva napredak, tačno 4 intervala ne', () => {
    const g3 = igra({ ziv: koka(T0 - (4 * I_KOKA - 1)) })
    pokupi(g3, 'kokosinjac', T0)
    expect(g3.s.ziv.kokosinjac.t).toBe(T0 - (I_KOKA - 1))
    const g4 = igra({ ziv: koka(T0 - 4 * I_KOKA - 50_000) })
    pokupi(g4, 'kokosinjac', T0)
    expect(g4.s.mag.jaje).toBe(4)
    expect(g4.s.ziv.kokosinjac.t).toBe(T0) // 50 s preko kapaciteta je odbačeno
  })

  it('pokupljanje koje diže nivo: nivo između xp i poruke', () => {
    const g = igra({ xp: 26, novac: 0, ziv: koka(T0 - 4 * I_KOKA) })
    const d = pokupi(g, 'kokosinjac', T0).dogadjaji
    expect(d.map((e) => e.tip)).toEqual(['zvuk', 'vibracija', 'xp', 'nivo', 'poruka'])
    expect(nivoi(d)).toEqual([[2, 80]])
  })

  it('zaštite: nekupljena, 0 spremnih, sat vraćen (D4) — tiho, magacin nikad negativan', () => {
    const g = igra({ ziv: koka(T0) })
    odbijeno(g, () => pokupi(g, 'stala', T0 + 9e9))
    odbijeno(g, () => pokupi(g, 'kokosinjac', T0 + I_KOKA - 1))
    odbijeno(g, () => pokupi(g, 'kokosinjac', T0 - 200_000))
    expect(g.s.mag.jaje).toBe(0)
  })
})

describe('pogledZivotinje', () => {
  it('traka: deo tekućeg intervala; 1 kad je puno', () => {
    const s = igra({ ziv: koka(T0) }).s
    // 03 §8: t na 1 620 s, sada 1 720 s → 100 / 180 ≈ 55,6 %
    expect(pogledZivotinje(s, 'kokosinjac', T0 + 100_000)).toEqual({ n: 0, udeo: 100 / 180 })
    expect(pogledZivotinje(s, 'kokosinjac', T0 + I_KOKA + 90_000)).toEqual({ n: 1, udeo: 0.5 })
    expect(pogledZivotinje(s, 'kokosinjac', T0 + 4 * I_KOKA)).toEqual({ n: 4, udeo: 1 })
    expect(pogledZivotinje(s, 'kokosinjac', T0 + 36_000_000)).toEqual({ n: 4, udeo: 1 })
  })
})
