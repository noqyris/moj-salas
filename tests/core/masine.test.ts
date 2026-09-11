import { describe, expect, it } from 'vitest'
import { pogledMasine, pokreniMasinu, tikMasina } from '../../src/core/masine'
import { MAG0, T0 } from '../helpers'
import { igra, nivoi, odbijeno } from './pomocnici'

const obe = (mlinT = 0, kazanT = 0) => ({
  mlin: { k: true, t: mlinT },
  kazan: { k: true, t: kazanT },
})

describe('pokreniMasinu', () => {
  it('C31: kazan troši 3 paprike (9 → 6), t = now, samo zvuk „sadnja", bez XP-a', () => {
    const g = igra({ xp: 5000, masine: obe(), mag: { ...MAG0, psenica: 20, paprika: 9 } })
    expect(pokreniMasinu(g, 'kazan', T0)).toEqual({
      ok: true,
      dogadjaji: [{ tip: 'zvuk', id: 'sadnja' }],
      cuvaj: 'odlozeno',
    })
    expect(g.s.mag.paprika).toBe(6)
    expect(g.s.masine.kazan).toEqual({ k: true, t: T0 })
    expect(g.s.xp).toBe(5000)
    expect(pokreniMasinu(g, 'mlin', T0).ok).toBe(true)
    expect(g.s.mag.psenica).toBe(16)
  })

  it('tačno ulazN je dovoljno (4 pšenice → 0)', () => {
    const g = igra({ masine: obe(), mag: { ...MAG0, psenica: 4 } })
    expect(pokreniMasinu(g, 'mlin', T0).ok).toBe(true)
    expect(g.s.mag.psenica).toBe(0)
  })

  it('D7: nekupljena mašina ne troši ulaz (u prototipu je ulaz nestajao zauvek)', () => {
    const g = igra({ mag: { ...MAG0, psenica: 20, paprika: 9 } })
    odbijeno(g, () => pokreniMasinu(g, 'mlin', T0))
    odbijeno(g, () => pokreniMasinu(g, 'kazan', T0))
  })

  it('već radi, ili nema dovoljno ulaza: tiho', () => {
    const g = igra({ masine: obe(T0 - 1000), mag: { ...MAG0, psenica: 20, paprika: 2 } })
    odbijeno(g, () => pokreniMasinu(g, 'mlin', T0))
    odbijeno(g, () => pokreniMasinu(g, 'kazan', T0))
  })
})

describe('tikMasina', () => {
  it('C32: posle 241 s obe gotove, redom mlin pa kazan; +1 proizvod svaka, +33 XP, bez ubrano', () => {
    const g = igra({ xp: 5000, masine: obe(T0, T0) })
    const r = tikMasina(g, T0 + 241_000)
    expect(r).toEqual({
      dogadjaji: [
        { tip: 'zvuk', id: 'zetva' },
        { tip: 'poruka', poruka: { id: 'masinaGotova', masina: 'mlin' } },
        { tip: 'xp', iznos: 8, sidro: { vrsta: 'masina', id: 'mlin' } },
        { tip: 'zvuk', id: 'zetva' },
        { tip: 'poruka', poruka: { id: 'masinaGotova', masina: 'kazan' } },
        { tip: 'xp', iznos: 25, sidro: { vrsta: 'masina', id: 'kazan' } },
      ],
      strukturno: true,
      cuvaj: 'odlozeno',
    })
    expect(g.s.mag).toEqual({ ...MAG0, brasno: 1, ajvar: 1 })
    expect(g.s.masine).toEqual(obe(0, 0))
    expect(g.s.xp).toBe(5033)
    expect(g.s.stat.ubrano).toBe(0)
  })

  it('granica: mlin (90 s) nije gotov na 89 999 ms, gotov na 90 000', () => {
    const g = igra({ masine: { mlin: { k: true, t: T0 }, kazan: { k: false, t: 0 } } })
    const pre = structuredClone(g)
    expect(tikMasina(g, T0 + 89_999)).toEqual({ dogadjaji: [], strukturno: false, cuvaj: 'ne' })
    expect(g).toEqual(pre)
    expect(tikMasina(g, T0 + 90_000).strukturno).toBe(true)
    expect(g.s.mag.brasno).toBe(1)
  })

  it('10 h zakašnjenja → i dalje TAČNO jedan proizvod', () => {
    const g = igra({ masine: obe(T0, 0) })
    tikMasina(g, T0 + 36_000_000)
    tikMasina(g, T0 + 36_001_000)
    expect(g.s.mag.brasno).toBe(1)
    expect(g.s.masine.mlin.t).toBe(0)
  })

  it('samo gotova se završava; druga i dalje radi', () => {
    const g = igra({ masine: obe(T0, T0) })
    const r = tikMasina(g, T0 + 100_000)
    expect(r.dogadjaji.filter((e) => e.tip === 'poruka')).toEqual([
      { tip: 'poruka', poruka: { id: 'masinaGotova', masina: 'mlin' } },
    ])
    expect(g.s.masine.kazan.t).toBe(T0)
  })

  it('XP mašine može da digne nivo (nivo posle xp događaja, bonus odmah)', () => {
    const g = igra({ xp: 25, novac: 0, masine: obe(T0, 0) })
    const d = tikMasina(g, T0 + 90_000).dogadjaji
    expect(d.map((e) => e.tip)).toEqual(['zvuk', 'poruka', 'xp', 'nivo'])
    expect(nivoi(d)).toEqual([[2, 80]])
    expect(g.s.novac).toBe(80)
  })

  it('nekupljena mašina koja „radi" (k:false, t>0) se preskače zauvek', () => {
    const g = igra({ masine: { mlin: { k: false, t: T0 }, kazan: { k: false, t: 0 } } })
    const pre = structuredClone(g)
    expect(tikMasina(g, T0 + 36_000_000)).toEqual({
      dogadjaji: [],
      strukturno: false,
      cuvaj: 'ne',
    })
    expect(g).toEqual(pre)
  })
})

describe('pogledMasine', () => {
  it('miruje: moze = kupljena i ima dovoljno ulaza', () => {
    const s = igra({ masine: obe(), mag: { ...MAG0, psenica: 4, paprika: 2 } }).s
    expect(pogledMasine(s, 'mlin', T0)).toEqual({ radi: false, moze: true })
    expect(pogledMasine(s, 'kazan', T0)).toEqual({ radi: false, moze: false })
    const nekupljena = igra({ mag: { ...MAG0, psenica: 4 } }).s
    expect(pogledMasine(nekupljena, 'mlin', T0)).toEqual({ radi: false, moze: false })
  })

  it('radi: udeo ∈ [0, 1] i preostalo (može ≤ 0 dok tick ne završi turu)', () => {
    const s = igra({ masine: obe(T0) }).s
    expect(pogledMasine(s, 'mlin', T0 + 45_000)).toEqual({ radi: true, udeo: 0.5, preostaloS: 45 })
    expect(pogledMasine(s, 'mlin', T0 + 100_000)).toEqual({
      radi: true,
      udeo: 1,
      preostaloS: -10,
    })
  })
})
