import { describe, expect, it } from 'vitest'
import type { ZgradaId } from '../../src/config'
import {
  kupiZgradu,
  magPrazan,
  nestoRaste,
  pametnaKupovina,
  stanjeZgrade,
} from '../../src/core/radnja'
import { praznaParcela } from '../../src/core/stanje'
import { MAG0, T0 } from '../helpers'
import { igra, odbijeno } from './pomocnici'

const nista = { mlin: { k: false, t: 0 }, kazan: { k: false, t: 0 } }
const bezZiv = { kokosinjac: { k: false, t: 0 }, stala: { k: false, t: 0 } }

describe('nestoRaste / magPrazan', () => {
  it('nestoRaste: usev (i zreo), mašina koja RADI, bilo koja kupljena životinja', () => {
    expect(nestoRaste(igra().s)).toBe(false)
    const rastuca = igra({ parcele: [{ c: 'psenica', t: T0, z: false }, praznaParcela()] }).s
    expect(nestoRaste(rastuca)).toBe(true)
    const zrela = igra({ parcele: [{ c: 'psenica', t: T0 - 9e6, z: false }] }).s
    expect(nestoRaste(zrela)).toBe(true)
    expect(nestoRaste(igra({ masine: { ...nista, mlin: { k: true, t: T0 } } }).s)).toBe(true)
    expect(nestoRaste(igra({ masine: { ...nista, mlin: { k: true, t: 0 } } }).s)).toBe(false)
    expect(nestoRaste(igra({ ziv: { ...bezZiv, stala: { k: true, t: T0 } } }).s)).toBe(true)
  })

  it('magPrazan: sve tačno 0', () => {
    expect(magPrazan(igra().s)).toBe(true)
    expect(magPrazan(igra({ mag: { ...MAG0, mleko: 1 } }).s)).toBe(false)
  })
})

describe('pametnaKupovina (02 §6, izmerena matrica)', () => {
  it.each([
    ['N < C', { novac: 149 }, 150, 'nemasNovca'],
    ['N−C = 9, ništa, prazno', { novac: 159 }, 150, 'ostaviZaSeme'],
    ['N−C = 10, ništa, prazno', { novac: 160 }, 150, 'ok'],
    ['N−C = 0, kazan, ništa', { novac: 600 }, 600, 'ostaviZaSeme'],
    [
      'N−C = 9, usev raste',
      { novac: 159, parcele: [{ c: 'psenica' as const, t: T0, z: false }] },
      150,
      'ok',
    ],
    ['N−C = 9, 1 jaje u magacinu', { novac: 159, mag: { ...MAG0, jaje: 1 } }, 150, 'ok'],
    [
      'N−C = 9, mlin radi',
      { novac: 159, masine: { ...nista, mlin: { k: true, t: T0 } } },
      150,
      'ok',
    ],
    [
      'N−C = 9, kokošinjac sa 0 spremnih',
      { novac: 159, ziv: { ...bezZiv, kokosinjac: { k: true, t: T0 } } },
      150,
      'ok',
    ],
    [
      'N−C = 9, kupljen ali NEAKTIVAN mlin',
      { novac: 159, masine: { ...nista, mlin: { k: true, t: 0 } } },
      150,
      'ostaviZaSeme',
    ],
  ])('%s → %s', (_opis, o, cena, ishod) => {
    expect(pametnaKupovina(igra(o).s, cena)).toBe(ishod)
  })
})

describe('kupiZgradu', () => {
  it('C23–C27: na nivou 8 sve četiri redom — ukupno 4 450 din; životinje proizvode od now', () => {
    const g = igra({ novac: 100_000, xp: 5000 })
    const ids: ZgradaId[] = ['mlin', 'kazan', 'kokosinjac', 'stala']
    for (const id of ids) {
      expect(kupiZgradu(g, id, T0)).toEqual({
        ok: true,
        dogadjaji: [
          { tip: 'zvuk', id: 'zetva' },
          { tip: 'vibracija', obrazac: 20 },
          { tip: 'poruka', poruka: { id: 'zgradaNaFarmi', zgrada: id } },
        ],
        cuvaj: 'odlozeno',
      })
    }
    expect(g.s.novac).toBe(95_550)
    expect(g.s.masine).toEqual({ mlin: { k: true, t: 0 }, kazan: { k: true, t: 0 } })
    expect(g.s.ziv).toEqual({ kokosinjac: { k: true, t: T0 }, stala: { k: true, t: T0 } })
    expect(ids.map((id) => stanjeZgrade(g.s, id))).toEqual([
      'kupljeno',
      'kupljeno',
      'kupljeno',
      'kupljeno',
    ])
  })

  it('D7: ponovna kupovina odbijena — ne naplaćuje i NE resetuje z.t (spremna jaja ostaju)', () => {
    const g = igra({ novac: 100_000, xp: 5000, ziv: { ...bezZiv, kokosinjac: { k: true, t: T0 } } })
    odbijeno(g, () => kupiZgradu(g, 'kokosinjac', T0 + 720_000))
    g.s.masine.mlin.k = true
    odbijeno(g, () => kupiZgradu(g, 'mlin', T0))
  })

  it('D7: iznad nivoa odbijeno i sa dovoljno novca (štala na 4, mlin na 1); na nivou prolazi', () => {
    const g4 = igra({ novac: 100_000, xp: 400 })
    odbijeno(g4, () => kupiZgradu(g4, 'stala', T0))
    const g5 = igra({ novac: 100_000, xp: 401 })
    expect(kupiZgradu(g5, 'stala', T0).ok).toBe(true)
    const g1 = igra({ novac: 1000, xp: 29 })
    odbijeno(g1, () => kupiZgradu(g1, 'mlin', T0))
    const g2 = igra({ novac: 1000, xp: 30 })
    expect(kupiZgradu(g2, 'mlin', T0).ok).toBe(true)
  })

  it('anti-softlock/novac: zvuk greške + tačna poruka, ništa kupljeno', () => {
    const g = igra({ novac: 599, xp: 200 })
    expect(odbijeno(g, () => kupiZgradu(g, 'kazan', T0))).toEqual([
      { tip: 'zvuk', id: 'greska' },
      { tip: 'poruka', poruka: { id: 'nemasNovca' } },
    ])
    g.s.novac = 600
    expect(odbijeno(g, () => kupiZgradu(g, 'kazan', T0))).toEqual([
      { tip: 'zvuk', id: 'greska' },
      { tip: 'poruka', poruka: { id: 'ostaviZaSeme' } },
    ])
  })
})

describe('stanjeZgrade', () => {
  it('zaključano ispod nivoa, dostupno od nivoa, kupljeno kad je k', () => {
    const redom = (xp: number) =>
      (['mlin', 'kazan', 'kokosinjac', 'stala'] as const).map((id) =>
        stanjeZgrade(igra({ xp }).s, id),
      )
    expect(redom(0)).toEqual(['zakljucano', 'zakljucano', 'zakljucano', 'zakljucano'])
    expect(redom(30)).toEqual(['dostupno', 'zakljucano', 'zakljucano', 'zakljucano'])
    expect(redom(87)).toEqual(['dostupno', 'dostupno', 'dostupno', 'zakljucano'])
    expect(redom(401)).toEqual(['dostupno', 'dostupno', 'dostupno', 'dostupno'])
    const s = igra({ xp: 0, ziv: { ...bezZiv, stala: { k: true, t: T0 } } }).s
    expect(stanjeZgrade(s, 'stala')).toBe('kupljeno')
  })
})
