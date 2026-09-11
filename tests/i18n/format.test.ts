/*
 * Formateri: zlatne vrednosti iz 05 §2 i 07 §e (izmerene na prototipu). trajanjeTxt ima D16 —
 * decimalni zarez; te vrednosti su označene i poređene sa prototipovim eksplicitno.
 */
import { describe, expect, it } from 'vitest'
import {
  KULTURE,
  MASINE,
  PROIZVODI,
  REDOSLED,
  ZIV,
  cenaParcele,
  dnevniPoklon,
  nivoBonus,
} from '../../src/config'
import { fmt, trajanjeTxt, vremeTxt } from '../../src/i18n/format'

describe('fmt = Math.round(n).toLocaleString("sr-RS") (05 §2.1)', () => {
  it.each([
    [0, '0'],
    [999, '999'],
    [1000, '1.000'],
    [1234, '1.234'],
    [9999, '9.999'],
    [12345, '12.345'],
    [123456, '123.456'],
    [1234567, '1.234.567'],
    [1e9, '1.000.000.000'],
    [12.5, '13'],
    [0.5, '1'],
    [1.5, '2'],
    [2.5, '3'],
    [12345.6, '12.346'],
    [-0.4, '-0'],
    [-1234, '-1.234'],
    [NaN, 'NaN'],
  ])('fmt(%s) = %j', (n, izlaz) => {
    expect(fmt(n)).toBe(izlaz)
  })

  it('separator hiljada je tačka U+002E, i 4 cifre se grupišu', () => {
    expect([...fmt(1000)].map((c) => c.codePointAt(0))).toEqual([0x31, 0x2e, 0x30, 0x30, 0x30])
  })

  it('config vrednosti kako ih UI prikazuje (05 §2.1)', () => {
    expect([2, 3, 4, 5, 6, 7, 8].map((n) => fmt(cenaParcele(n)))).toEqual([
      '150',
      '330',
      '730',
      '1.600',
      '3.510',
      '7.730',
      '17.010',
    ])
    expect(REDOSLED.map((k) => fmt(KULTURE[k].seme))).toEqual(['10', '30', '80', '200', '450'])
    expect(REDOSLED.map((k) => fmt(KULTURE[k].cena))).toEqual(['18', '62', '185', '900', '2.300'])
    expect(Object.values(PROIZVODI).map((x) => fmt(x.cena))).toEqual(['120', '780', '45', '260'])
    expect([MASINE.mlin, MASINE.kazan, ZIV.kokosinjac, ZIV.stala].map((d) => fmt(d.cena))).toEqual([
      '350',
      '600',
      '900',
      '2.600',
    ])
    expect(fmt(nivoBonus(2))).toBe('80')
    expect(fmt(nivoBonus(20))).toBe('800')
    expect(fmt(dnevniPoklon(1))).toBe('75')
    expect(fmt(dnevniPoklon(20))).toBe('740')
  })
})

describe('vremeTxt — odbrojavanje, 1:1 sa prototipom (05 §2.2, 04 §2.14, 07 §e)', () => {
  it.each([
    [0, '0s'],
    [0.2, '1s'],
    [5, '5s'],
    [45, '45s'],
    [59, '59s'],
    [59.01, '1:00'],
    [59.2, '1:00'],
    [60, '1:00'],
    [61, '1:01'],
    [90, '1:30'],
    [300, '5:00'],
    [599, '9:59'],
    [1800, '30:00'],
    [3599, '59:59'],
    [3599.1, '1h 0m'],
    [3600, '1h 0m'],
    [3660, '1h 1m'],
    [3661, '1h 1m'],
    [5400, '1h 30m'],
    [7199, '1h 59m'],
    [7200, '2h 0m'],
    [86400, '24h 0m'],
    [-5, '0s'],
  ])('vremeTxt(%s) = %j', (s, izlaz) => {
    expect(vremeTxt(s)).toBe(izlaz)
  })
})

describe('trajanjeTxt — statična trajanja; D16: decimalni zarez', () => {
  it.each([
    [0, '0 s'],
    [5, '5 s'],
    [20, '20 s'],
    [60, '1 min'],
    [180, '3 min'],
    [240, '4 min'],
    [300, '5 min'],
    [600, '10 min'],
    [1800, '30 min'],
    [3600, '1 h'],
    [7200, '2 h'],
  ])('celi brojevi isti kao prototip: trajanjeTxt(%s) = %j', (s, izlaz) => {
    expect(trajanjeTxt(s)).toBe(izlaz)
  })

  // Prototip (05 §2.3): '1.5 min', '1.5 h', '59.2 s', '59.983333333333334 min'.
  it.each([
    [90, '1,5 min'],
    [5400, '1,5 h'],
    [59.2, '59,2 s'],
    [3599, '59,983 min'],
  ])('D16: trajanjeTxt(%s) = %j (zarez; Intl daje najviše 3 decimale)', (s, izlaz) => {
    expect(trajanjeTxt(s)).toBe(izlaz)
  })

  it('D16 (07 Prilog A #14): trajanjeTxt(90) === "1,5 min", ne "1.5 min"', () => {
    expect(trajanjeTxt(90)).toBe('1,5 min')
  })

  it('config vrednosti: vreme rasta kultura i interval životinja', () => {
    expect(REDOSLED.map((k) => trajanjeTxt(KULTURE[k].vreme))).toEqual([
      '20 s',
      '1,5 min',
      '5 min',
      '30 min',
      '2 h',
    ])
    expect(trajanjeTxt(ZIV.kokosinjac.interval)).toBe('3 min')
    expect(trajanjeTxt(ZIV.stala.interval)).toBe('10 min')
  })
})
