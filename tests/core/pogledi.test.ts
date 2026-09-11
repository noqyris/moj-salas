import { describe, expect, it } from 'vitest'
import { navTacke, opcijeSemena } from '../../src/core/pogledi'
import { pametnaKupovina } from '../../src/core/radnja'
import { MAG0, T0, narudzba } from '../helpers'
import { igra } from './pomocnici'

const tacke = (s: Parameters<typeof navTacke>[0], now = T0) => {
  const t = navTacke(s, now)
  return [t.farma, t.narudzbine, t.pijaca, t.radnja].map(Number).join('')
}

describe('navTacke (04 §2.8, izmerena tabela [farma, narudžbine, pijaca, radnja])', () => {
  it.each([
    ['prazno stanje, novac 0', { novac: 0 }, '0000'],
    ['novac 350, nivo 1', { novac: 350 }, '0000'],
    ['novac 350, nivo 2', { novac: 350, xp: 30 }, '0001'],
    ['novac 349, nivo 2', { novac: 349, xp: 30 }, '0000'],
    [
      'pšenica 1, nijedna isporučiva',
      { novac: 0, mag: { ...MAG0, psenica: 1 }, narudzbe: [narudzba(1, 'psenica', 2, 60, 5)] },
      '0010',
    ],
    [
      'pšenica 5, narudžbina isporučiva (pijaca se gasi)',
      { novac: 0, mag: { ...MAG0, psenica: 5 }, narudzbe: [narudzba(1, 'psenica', 2, 60, 5)] },
      '0100',
    ],
    [
      'zreo usev',
      { novac: 0, parcele: [{ c: 'psenica' as const, t: T0 - 20_000, z: false }] },
      '1000',
    ],
    [
      '1 jaje spremno',
      { novac: 0, ziv: { kokosinjac: { k: true, t: T0 - 180_000 }, stala: { k: false, t: 0 } } },
      '1000',
    ],
  ])('%s → %s', (_opis, o, ocekivano) => {
    expect(tacke(igra(o).s)).toBe(ocekivano)
  })

  it('radnja: životinje se računaju; kupljena zgrada ne; anti-softlock se NE gleda (1:1)', () => {
    expect(tacke(igra({ novac: 900, xp: 87, masine: { mlin: { k: true, t: 0 }, kazan: { k: true, t: 0 } } }).s)).toBe('0001')
    expect(tacke(igra({ novac: 599, xp: 87, masine: { mlin: { k: true, t: 0 }, kazan: { k: false, t: 0 } } }).s)).toBe('0000')
    const s = igra({ novac: 350, xp: 30 }).s
    expect(navTacke(s, T0).radnja).toBe(true)
    expect(pametnaKupovina(s, 350)).toBe('ostaviZaSeme')
  }) // prettier-ignore

  it('farma: nezreo usev i životinja bez spremnih ne pale tačku', () => {
    const s = igra({
      novac: 0,
      parcele: [{ c: 'psenica', t: T0 - 19_999, z: false }],
      ziv: { kokosinjac: { k: true, t: T0 - 179_999 }, stala: { k: false, t: 0 } },
    }).s
    expect(tacke(s)).toBe('0000')
  })
})

describe('opcijeSemena', () => {
  it('sve kulture redom; zaključane ispod nivoa; moze = otključana i ima za seme', () => {
    expect(opcijeSemena(igra({ xp: 0, novac: 50 }).s)).toEqual([
      { k: 'psenica', zakljucano: false, moze: true },
      { k: 'sargarepa', zakljucano: false, moze: true },
      { k: 'paprika', zakljucano: true, moze: false },
      { k: 'bundeva', zakljucano: true, moze: false },
      { k: 'grozdje', zakljucano: true, moze: false },
    ])
    expect(opcijeSemena(igra({ xp: 0, novac: 29 }).s).map((o) => o.moze)).toEqual([
      true,
      false,
      false,
      false,
      false,
    ])
    expect(opcijeSemena(igra({ xp: 195, novac: 450 }).s).map((o) => o.moze)).toEqual([
      true,
      true,
      true,
      true,
      true,
    ])
    expect(opcijeSemena(igra({ xp: 195, novac: 449 }).s)[4]).toEqual({
      k: 'grozdje',
      zakljucano: false,
      moze: false,
    })
  })
})
