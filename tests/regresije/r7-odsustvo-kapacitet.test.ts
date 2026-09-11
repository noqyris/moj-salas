/*
 * CLAUDE.md regresija 7 — offline rast i kapacitet. Sa odobrenim odstupanjem D3 kapacitet
 * ograničava ZALIHU (pun kokošinjac ne proizvodi), a D4 sprečava negativne količine kad je sat
 * vraćen unazad.
 *
 * Mutacije koje hvata:
 *  - `g >= videnoPre` umesto `>`              → broji usev zreo pre odlaska (sazrelo 3)
 *  - `g < pre` umesto `<= pre`                → ispušta grožđe (sazrelo 1)
 *  - `>= 180` umesto `> 180`                  → granica 180 000 ms
 *  - neograničena razlika                      → jaja 22 umesto 2
 *  - prototipov `z.t += n·I` (bez D3)          → 1 h daje 4, 8, 12, 16, 20
 *  - bez D4 (`Math.max(0, …)`)                 → sat vraćen daje −2 jaja
 */
import { describe, expect, it } from 'vitest'
import { igraIzStanja } from '../../src/core/igra'
import { tikMasina } from '../../src/core/masine'
import { prikaziDobrodoslicu, rezimeOdsustva } from '../../src/core/odsustvo'
import { dekodirajSejv } from '../../src/core/sejv/dekoder'
import { pogledZivotinje, pokupi, zivSpremno } from '../../src/core/zivotinje'
import { T0, stanje } from '../helpers'
import { igra, odbijeno } from '../core/pomocnici'

const VID = T0 - 3_600_000
const S7 = () =>
  stanje({
    xp: 5000,
    videno: VID,
    poklonDan: '2026-01-15',
    parcele: [
      { c: 'psenica', t: VID - 10_000, z: false }, // zrela u vid + 10 s ∈ (vid, T0] → broji se
      { c: 'psenica', t: VID - 7_200_000, z: false }, // zrela pre odlaska → NE
      { c: 'sargarepa', t: T0 - 10_000, z: false }, // još raste → NE
      { c: 'grozdje', t: VID - 3_600_000, z: false }, // zrela tačno u T0 (g <= pre) → broji se
    ],
    masine: { mlin: { k: true, t: VID - 60_000 }, kazan: { k: true, t: 0 } }, // gotov tokom odsustva
    ziv: { kokosinjac: { k: true, t: VID - 360_000 }, stala: { k: true, t: VID } }, // 2 jaja pri odlasku
  })

describe('R7: odsustvo', () => {
  it('rezime: usevi zreli u (videno, pre], gotove mašine, ograničene razlike životinja', () => {
    const s = S7()
    const r = rezimeOdsustva(s, s.videno || T0, T0)
    expect(r).toEqual({
      odsutanS: 3600,
      sazrelo: 2,
      gotoveMasine: ['mlin'],
      skupilo: { jaje: 2, mleko: 3 },
    })
    expect(prikaziDobrodoslicu(r)).toBe(true)
    expect(s).toEqual(S7()) // čisto: ništa se ne dodeljuje pri učitavanju
  })

  it('mašine dodeljuje PRVI tick posle starta, ne učitavanje', () => {
    const g = igraIzStanja(S7())
    const r = tikMasina(g, T0 + 1000)
    expect(g.s.mag.brasno).toBe(1)
    expect(g.s.masine.mlin.t).toBe(0)
    expect(g.s.xp).toBe(5008)
    expect(r.strukturno).toBe(true)
    expect(r.cuvaj).toBe('odlozeno')
    expect(r.dogadjaji).toContainEqual({
      tip: 'poruka',
      poruka: { id: 'masinaGotova', masina: 'mlin' },
    })
  })

  it.each([
    [180_000, false],
    [180_001, true],
    [181_000, true],
  ])('odsutan %i ms → dobrodošlica %s (strogo > 180 s)', (odsutan, prikazi) => {
    const s = stanje({
      videno: T0 - odsutan,
      parcele: [
        { c: 'psenica', t: T0 - odsutan - 10_000, z: false },
        { c: null, t: 0, z: false },
      ],
    })
    const r = rezimeOdsustva(s, s.videno, T0)
    expect(r.sazrelo).toBe(1)
    expect(prikaziDobrodoslicu(r)).toBe(prikazi)
  })
})

describe('R7 / 01 O5: sejv bez upotrebljivog videno ne daje lažnu dobrodošlicu (kroz dekoder)', () => {
  it.each([
    ['nedostaje', undefined],
    ['null', null],
    ['0', 0],
    ['string', 'juče'],
  ])('videno %s → videno = pre, odsutan 0 s, bez kartice (iako je sve zrelo)', (_o, videno) => {
    const o: Record<string, unknown> = { ...S7() }
    if (videno === undefined) delete o.videno
    else o.videno = videno
    const s = dekodirajSejv(JSON.stringify(o), T0).stanje
    expect(s.videno).toBe(T0)
    const r = rezimeOdsustva(s, s.videno || T0, T0)
    expect(r.odsutanS).toBe(0)
    expect(prikaziDobrodoslicu(r)).toBe(false)
    // kontrola: isti sejv sa pravim videno JESTE za dobrodošlicu
    const pravi = dekodirajSejv(JSON.stringify(S7()), T0).stanje
    expect(prikaziDobrodoslicu(rezimeOdsustva(pravi, pravi.videno || T0, T0))).toBe(true)
  })
})

describe('R7: kapacitet (D3) i sat unazad (D4)', () => {
  it('prazan kokošinjac pri odlasku, 1 h: skupilo.jaje = min(4, 20) − min(4, 0) = 4, n = 4', () => {
    const s = stanje({
      xp: 5000,
      ziv: { kokosinjac: { k: true, t: VID }, stala: { k: false, t: 0 } },
    })
    expect(rezimeOdsustva(s, VID, T0).skupilo).toEqual({ jaje: 4 })
    expect(pogledZivotinje(s, 'kokosinjac', T0).n).toBe(4)
  })

  it('1 h odsustva → UKUPNO tačno 4 jaja; ponovljeno „Pokupi" posle toga odbija', () => {
    const g = igra({
      xp: 5000,
      ziv: { kokosinjac: { k: true, t: T0 - 3_600_000 }, stala: { k: false, t: 0 } },
    })
    const ukupno: number[] = []
    for (let i = 0; i < 8; i++) {
      if (!pokupi(g, 'kokosinjac', T0).ok) break
      ukupno.push(g.s.mag.jaje)
    }
    expect(ukupno).toEqual([4]) // prototip: [4, 8, 12, 16, 20]
    expect(g.s.xp).toBe(5004)
    expect(g.s.stat.ubrano).toBe(4)
    expect(g.s.ziv.kokosinjac.t).toBe(T0) // pun → proizvodnja kreće od sada
    odbijeno(g, () => pokupi(g, 'kokosinjac', T0))
    expect(pogledZivotinje(g.s, 'kokosinjac', T0)).toEqual({ n: 0, udeo: 0 })
  })

  it('9 intervala + 100 s (prototip: 4, 4, 1) → 4, pa ništa', () => {
    const g = igra({ ziv: { kokosinjac: { k: true, t: T0 - 9 * 180_000 - 100_000 }, stala: { k: false, t: 0 } } })
    expect(pokupi(g, 'kokosinjac', T0).ok).toBe(true)
    expect(pokupi(g, 'kokosinjac', T0).ok).toBe(false)
    expect(g.s.mag.jaje).toBe(4)
  }) // prettier-ignore

  it('10 h: štala daje 3, kokošinjac 4 — i ništa više do sledećeg intervala', () => {
    const g = igra({
      xp: 5000,
      ziv: { kokosinjac: { k: true, t: T0 - 36_000_000 }, stala: { k: true, t: T0 - 36_000_000 } },
    })
    expect(pokupi(g, 'kokosinjac', T0).ok).toBe(true)
    expect(pokupi(g, 'stala', T0).ok).toBe(true)
    expect(pokupi(g, 'kokosinjac', T0 + 179_999).ok).toBe(false)
    expect(pokupi(g, 'stala', T0 + 599_999).ok).toBe(false)
    expect(g.s.mag).toMatchObject({ jaje: 4, mleko: 3 })
    expect(zivSpremno(g.s, 'stala', T0 + 600_000)).toBe(1)
  })

  it('nije puno: delimičan napredak se čuva (3 intervala + 100 s → posle kupljenja ostaje 100 s)', () => {
    const g = igra({ ziv: { kokosinjac: { k: true, t: T0 - 3 * 180_000 - 100_000 }, stala: { k: false, t: 0 } } })
    expect(pokupi(g, 'kokosinjac', T0).ok).toBe(true)
    expect(g.s.mag.jaje).toBe(3)
    expect(g.s.ziv.kokosinjac.t).toBe(T0 - 100_000)
    expect(pogledZivotinje(g.s, 'kokosinjac', T0).udeo).toBeCloseTo(100 / 180, 12)
    expect(zivSpremno(g.s, 'kokosinjac', T0 + 80_000)).toBe(1)
  }) // prettier-ignore

  it('sat vraćen 200 s posle kupovine: 0 spremnih (ne −2), „Pokupi" odbijen, magacin nikad < 0', () => {
    const g = igra({ xp: 5000, ziv: { kokosinjac: { k: true, t: T0 }, stala: { k: false, t: 0 } } })
    expect(zivSpremno(g.s, 'kokosinjac', T0 - 200_000)).toBe(0)
    expect(pogledZivotinje(g.s, 'kokosinjac', T0 - 200_000).n).toBe(0)
    odbijeno(g, () => pokupi(g, 'kokosinjac', T0 - 200_000))
    expect(g.s.mag.jaje).toBe(0)
    expect(g.s.xp).toBe(5000)
    expect(g.s.stat.ubrano).toBe(0)
  })
})
