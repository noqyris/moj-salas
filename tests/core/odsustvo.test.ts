import { describe, expect, it } from 'vitest'
import { prikaziDobrodoslicu, rezimeOdsustva, uzmiDnevniPoklon } from '../../src/core/odsustvo'
import { praznaParcela } from '../../src/core/stanje'
import { T0 } from '../helpers'
import { igra } from './pomocnici'

const VID = T0 - 3_600_000
const bezZiv = { kokosinjac: { k: false, t: 0 }, stala: { k: false, t: 0 } }
const bezMasina = { mlin: { k: false, t: 0 }, kazan: { k: false, t: 0 } }

describe('rezimeOdsustva', () => {
  it('usev se broji ako sazre u (videnoPre, pre]: granice g = videno, videno+1, pre, pre+1', () => {
    const psenica = (zrenje: number) => ({ c: 'psenica' as const, t: zrenje - 20_000, z: false })
    const s = igra({
      parcele: [psenica(VID), psenica(VID + 1), psenica(T0), psenica(T0 + 1), praznaParcela()],
    }).s
    expect(rezimeOdsustva(s, VID, T0).sazrelo).toBe(2)
  })

  it('mašine: kupljena, t > 0 i gotova do pre — i ako je bila gotova PRE odlaska (bez donje granice)', () => {
    const r = (masine: typeof bezMasina) => rezimeOdsustva(igra({ masine }).s, VID, T0).gotoveMasine
    expect(r(bezMasina)).toEqual([])
    expect(r({ mlin: { k: true, t: VID - 60_000 }, kazan: { k: true, t: 0 } })).toEqual(['mlin'])
    expect(r({ mlin: { k: true, t: VID - 999_999 }, kazan: { k: false, t: 0 } })).toEqual(['mlin'])
    expect(r({ mlin: { k: true, t: T0 - 89_999 }, kazan: { k: true, t: T0 - 240_000 } })).toEqual([
      'kazan',
    ])
    expect(r({ mlin: { k: false, t: VID }, kazan: { k: false, t: VID } })).toEqual([])
    expect(r({ mlin: { k: true, t: VID }, kazan: { k: true, t: VID } })).toEqual(['mlin', 'kazan'])
  })

  it('životinje: razlika OGRANIČENIH brojeva, samo pozitivna, redom jaja pa mleko', () => {
    // O4: kokošinjac t = pre − 11 min, videno = pre − 10 min → 3 − 0 = 3
    const delimicno = igra({ ziv: { ...bezZiv, kokosinjac: { k: true, t: T0 - 660_000 } } }).s
    expect(rezimeOdsustva(delimicno, T0 - 600_000, T0).skupilo).toEqual({ jaje: 3 })
    // pun pri odlasku → nema reda
    const pun = igra({ ziv: { ...bezZiv, kokosinjac: { k: true, t: VID - 720_000 } } }).s
    expect(rezimeOdsustva(pun, VID, T0).skupilo).toEqual({})
    // štala pola intervala pri odlasku, 1 h odsustva → 3 − 0 = 3
    const krava = igra({ ziv: { ...bezZiv, stala: { k: true, t: VID - 300_000 } } }).s
    expect(rezimeOdsustva(krava, VID, T0).skupilo).toEqual({ mleko: 3 })
    // prazan kokošinjac pri odlasku, 1 h → min(4, 20) − min(4, 0) = 4
    const prazan = igra({ ziv: { ...bezZiv, kokosinjac: { k: true, t: VID } } }).s
    expect(rezimeOdsustva(prazan, VID, T0).skupilo).toEqual({ jaje: 4 })
  })

  it('je čist: ništa ne dodeljuje i ne menja stanje', () => {
    const g = igra({
      parcele: [{ c: 'psenica', t: VID, z: false }],
      masine: { mlin: { k: true, t: VID }, kazan: { k: false, t: 0 } },
      ziv: { kokosinjac: { k: true, t: VID }, stala: { k: false, t: 0 } },
    })
    const pre = structuredClone(g)
    rezimeOdsustva(g.s, VID, T0)
    expect(g).toEqual(pre)
  })

  it('odsutanS = (pre − videnoPre)/1000, negativno kad je sat vraćen', () => {
    expect(rezimeOdsustva(igra().s, VID, T0).odsutanS).toBe(3600)
    expect(rezimeOdsustva(igra().s, T0 + 5000, T0).odsutanS).toBe(-5)
  })
})

describe('prikaziDobrodoslicu (strogo > 180 s, i mora imati šta da javi)', () => {
  const r = (odsutanS: number, sazrelo: number, masine: boolean, jaja: boolean) => ({
    odsutanS,
    sazrelo,
    gotoveMasine: masine ? (['mlin'] as const).slice() : [],
    skupilo: jaja ? { jaje: 1 } : {},
  })
  it.each([
    [180, 1, true, true, false],
    [180.001, 0, false, false, false],
    [180.001, 1, false, false, true],
    [180.001, 0, true, false, true],
    [180.001, 0, false, true, true],
    [3600, 2, true, true, true],
    [-5, 1, true, true, false],
    [3600, 0, false, false, false],
  ])('odsutan %f s, sazrelo %i, mašine %s, jaja %s → %s', (s, z, m, j, prikazi) => {
    expect(prikaziDobrodoslicu(r(s, z, m, j))).toBe(prikazi)
  })
})

/** Ukupan XP za dostizanje nivoa 1..20. */
const KUM = [
  0, 30, 87, 195, 401, 792, 1535, 2946, 5628, 10723, 20404, 38797, 73744, 140143, 266302, 506004,
  961438, 1826762, 3470878, 6594699,
]

describe('uzmiDnevniPoklon (D5: samo kad datum ide napred)', () => {
  it('poklon po nivou: 40 + 35·nivo (75 … 740), novac odmah, zarađeno netaknuto', () => {
    const dobijeno = KUM.map((xp) => {
      const g = igra({ xp, novac: 0, poklonDan: '2026-01-14' })
      const dar = uzmiDnevniPoklon(g, '2026-01-15')
      expect(g.s.novac).toBe(dar)
      expect(g.s.poklonDan).toBe('2026-01-15')
      expect(g.s.stat.zaradjeno).toBe(0)
      return dar
    })
    expect(dobijeno).toEqual(KUM.map((_, i) => 40 + (i + 1) * 35))
    expect(dobijeno[0]).toBe(75)
    expect(dobijeno[19]).toBe(740)
  })

  it("prvi hladni start posle prve sadnje, ISTOG dana ('' je najmanji)", () => {
    const g = igra({ xp: 0, novac: 40, poklonDan: '' })
    expect(uzmiDnevniPoklon(g, '2026-01-15')).toBe(75)
    expect(g.s.novac).toBe(115)
  })

  it.each([
    ['nije sadio', { sadio: false, poklonDan: '' }, '2026-01-15'],
    ['isti dan', { poklonDan: '2026-01-15' }, '2026-01-15'],
    ['sat vraćen: sačuvan dan je POSLE današnjeg', { poklonDan: '2026-01-16' }, '2026-01-15'],
  ])('%s → null, stanje netaknuto', (_opis, o, danas) => {
    const g = igra({ novac: 50, ...o })
    const pre = structuredClone(g)
    expect(uzmiDnevniPoklon(g, danas)).toBeNull()
    expect(g).toEqual(pre)
  })

  it('prelazak meseca i godine je „napred" (poređenje YYYY-MM-DD stringova)', () => {
    expect(uzmiDnevniPoklon(igra({ poklonDan: '2026-01-31' }), '2026-02-01')).toBe(75)
    expect(uzmiDnevniPoklon(igra({ poklonDan: '2025-12-31' }), '2026-01-01')).toBe(75)
  })

  it('prebacivanje datuma napred-nazad daje JEDAN poklon (prototip: svaki put)', () => {
    const g = igra({ novac: 0, poklonDan: '2026-01-15' })
    const dani = ['2026-01-16', '2026-01-15', '2026-01-16', '2026-01-15', '2026-01-16']
    expect(dani.map((d) => uzmiDnevniPoklon(g, d))).toEqual([75, null, null, null, null])
    expect(g.s.novac).toBe(75)
  })
})
