/*
 * CLAUDE.md regresija 2 — ID narudžbina posle učitavanja: brojač nastavlja od max(id) + 1, pa nova
 * narudžbina nikad ne dobija ID koji već postoji, a isporuka pogađa TAČNO izabranu narudžbinu.
 *
 * Mutacija koju hvata: `igraIzStanja` sa `brojacN = 1` (prototip pre ispravke) → [1,1] duplikati,
 * isporuka briše obe (filter po id-ju), `[5, 7]` postaje `[5, 1]`.
 */
import { describe, expect, it } from 'vitest'
import { igraIzStanja, novaIgra } from '../../src/core/igra'
import { isporuci, odbij } from '../../src/core/narudzbine'
import { dekodirajSejv } from '../../src/core/sejv/dekoder'
import type { Narudzba } from '../../src/core/types'
import { MAG0, T0, mulberry32, narudzba, stanje } from '../helpers'
import { ucitajIgru } from '../core/pomocnici'

const sirovo = (narudzbe: Narudzba[], mag: Partial<typeof MAG0> = {}) =>
  JSON.stringify(stanje({ mag: { ...MAG0, ...mag }, narudzbe }))

describe('R2: ID narudžbina posle učitavanja', () => {
  it.each([
    [[5, 6], 7],
    [[1, 2], 3],
    [[9, 2], 10],
    [[41, 17], 42],
  ])('sačuvani ID-jevi %j → brojacN %i (pre dopune narudžbina)', (ids, sledeci) => {
    const d = dekodirajSejv(sirovo(ids.map((id) => narudzba(id, 'psenica', 1, 25, 3))), T0)
    expect(igraIzStanja(d.stanje).brojacN).toBe(sledeci)
  })

  it("kroz dekoder: string id '9' i dupli id se ispravljaju PRE računanja brojacN (01 M13/M14)", () => {
    const raw = JSON.stringify({
      ...stanje(),
      narudzbe: [
        { ...narudzba(4, 'psenica', 1, 25, 3), id: '9' },
        narudzba(4, 'sargarepa', 1, 80, 6),
        narudzba(4, 'jaje', 1, 50, 4),
      ],
    })
    const g = igraIzStanja(dekodirajSejv(raw, T0).stanje)
    expect(g.s.narudzbe.map((o) => o.id)).toEqual([9, 4])
    expect(g.brojacN).toBe(10)
  })

  it('jedna sačuvana narudžbina (id 3) → dopunjena dobija id 4', () => {
    const g = ucitajIgru(sirovo([narudzba(3, 'psenica', 1, 25, 3)]), mulberry32(1))
    expect(g.s.narudzbe.map((o) => o.id)).toEqual([3, 4])
    expect(g.brojacN).toBe(5)
  })

  it('isporuka pogađa tačno ciljanu; novi ID-jevi nastavljaju od max + 1 (izmereno, exp7)', () => {
    const g = ucitajIgru(
      sirovo([narudzba(5, 'sargarepa', 1, 80, 6), narudzba(6, 'psenica', 2, 60, 5)], {
        psenica: 5,
        sargarepa: 1,
      }),
      mulberry32(1),
    )
    expect(g.brojacN).toBe(7)
    const o5 = structuredClone(g.s.narudzbe[0])
    const r = isporuci(g, 6, T0, mulberry32(1))
    expect(r.ok).toBe(true)
    expect(r.dogadjaji).toContainEqual({
      tip: 'poruka',
      poruka: { id: 'zahvaljuje', ime: 'Baka Mira', din: 60 },
    })
    expect(g.s.narudzbe.map((o) => o.id)).toEqual([5, 7]) // preživela prva, nova na kraj
    expect(g.s.narudzbe[0]).toEqual(o5)
    expect(g.s.mag).toMatchObject({ psenica: 3, sargarepa: 1 })
    expect(g.s.novac).toBe(110)
    expect(g.s.xp).toBe(5)
    expect(g.s.stat).toEqual({ ubrano: 0, zaradjeno: 60, isporuke: 1 })
    expect(g.brojacN).toBe(8)
    expect(odbij(g, 5, mulberry32(2)).ok).toBe(true)
    expect(g.s.narudzbe.map((o) => o.id)).toEqual([7, 8])
    expect(g.brojacN).toBe(9)
  })

  it('[9, 2] → odbij 9 → [2, 10] → isporuči 2 → [10, 11]', () => {
    const g = ucitajIgru(
      sirovo([narudzba(9, 'psenica', 1, 25, 3), narudzba(2, 'psenica', 1, 25, 3)], {
        psenica: 1,
      }),
      mulberry32(7),
    )
    odbij(g, 9, mulberry32(7))
    expect(g.s.narudzbe.map((o) => o.id)).toEqual([2, 10])
    expect(isporuci(g, 2, T0, mulberry32(8)).ok).toBe(true)
    expect(g.s.narudzbe.map((o) => o.id)).toEqual([10, 11])
    expect(g.s.stat.isporuke).toBe(1)
  })

  it('300 × odbij: ID-jevi strogo rastu, nikad duplikat, uvek tačno 2', () => {
    const g = ucitajIgru(
      sirovo([narudzba(5, 'psenica', 1, 25, 3), narudzba(6, 'psenica', 1, 25, 3)]),
      mulberry32(3),
    )
    const rng = mulberry32(99)
    const vidjeni = new Set([5, 6])
    let poslednji = 6
    for (let i = 0; i < 300; i++) {
      const cilj = g.s.narudzbe[i % 2]
      if (!cilj) throw new Error('nema narudžbine')
      expect(odbij(g, cilj.id, rng).ok).toBe(true)
      expect(g.s.narudzbe).toHaveLength(2)
      const nova = g.s.narudzbe[1]
      if (!nova) throw new Error('nema nove narudžbine')
      expect(nova.id).toBe(poslednji + 1)
      expect(vidjeni.has(nova.id)).toBe(false)
      vidjeni.add(nova.id)
      poslednji = nova.id
    }
    expect(g.brojacN).toBe(307)
  })

  it('prazna tabla → dopuna daje 1, 2 i brojacN 3; posle nove igre ID-jevi opet kreću od 1', () => {
    const g = ucitajIgru(sirovo([]), mulberry32(4))
    expect(g.s.narudzbe.map((o) => o.id)).toEqual([1, 2])
    expect(g.brojacN).toBe(3)
    odbij(g, 1, mulberry32(4))
    const nova = novaIgra(T0, mulberry32(4))
    expect(nova.s.narudzbe.map((o) => o.id)).toEqual([1, 2])
    expect(nova.brojacN).toBe(3)
  })
})
