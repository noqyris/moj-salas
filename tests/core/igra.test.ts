import { describe, expect, it } from 'vitest'
import { igraIzStanja, novaIgra, prebaciZvuk } from '../../src/core/igra'
import { uzmiDnevniPoklon } from '../../src/core/odsustvo'
import { posadi } from '../../src/core/polja'
import { pocetnoStanje } from '../../src/core/stanje'
import { DAN_T0, T0, mulberry32, narudzba, niz, stanje } from '../helpers'

describe('igraIzStanja', () => {
  it('prosliNivo = nivo iz XP (bez ponavljanja level-up-ova), brojacN = max(id) + 1', () => {
    expect(igraIzStanja(stanje({ xp: 0 })).prosliNivo).toBe(1)
    expect(igraIzStanja(stanje({ xp: 5000 })).prosliNivo).toBe(8)
    expect(igraIzStanja(stanje({ xp: 6_594_699 })).prosliNivo).toBe(20)
    const ids = (...id: number[]) =>
      igraIzStanja(stanje({ narudzbe: id.map((x) => narudzba(x, 'psenica', 1, 25, 3)) })).brojacN
    expect(ids()).toBe(1)
    expect(ids(41, 17)).toBe(42)
    expect(ids(3)).toBe(4)
    expect(ids(0)).toBe(1) // `o.id || 0`
  })

  it('NE dopunjava narudžbine i NE kopira stanje', () => {
    const s = stanje()
    const g = igraIzStanja(s)
    expect(g.s).toBe(s)
    expect(g.s.narudzbe).toEqual([])
  })
})

describe('novaIgra (reset)', () => {
  it('bez zadrži = prototip POCETNO(): zvuk uključen, poklonDan prazan; ID-jevi od 1', () => {
    const g = novaIgra(T0, mulberry32(2024))
    const { narudzbe, ...ostalo } = g.s
    const { narudzbe: prazne, ...pocetno } = pocetnoStanje(T0)
    expect(prazne).toEqual([])
    expect(ostalo).toEqual(pocetno)
    expect(narudzbe.map((o) => o.id)).toEqual([1, 2])
    expect(g.brojacN).toBe(3)
    expect(g.prosliNivo).toBe(1)
  })

  it('D6: čuva mute i poklonDan iz stare igre, sve ostalo novo', () => {
    const g = novaIgra(T0 + 5, mulberry32(2024), { mute: true, poklonDan: DAN_T0 })
    expect(g.s.mute).toBe(true)
    expect(g.s.poklonDan).toBe(DAN_T0)
    expect(g.s.novac).toBe(50)
    expect(g.s.sadio).toBe(false)
    expect(g.s.videno).toBe(T0 + 5)
  })

  it('D6 + D5: reset → sadnja → start istog dana ne daje ponovo poklon (prototip je davao 75)', () => {
    const g = novaIgra(T0, mulberry32(1), { mute: false, poklonDan: DAN_T0 })
    expect(posadi(g, 0, 'psenica', T0).ok).toBe(true)
    expect(uzmiDnevniPoklon(g, DAN_T0)).toBeNull()
    expect(g.s.novac).toBe(40)
  })

  it('troši rng samo za 2 narudžbine nivoa 1 (pool od 2 → 5 izvlačenja svaka)', () => {
    const rng = niz(0.1, 0.8, 0.5, 0.99, 0, 0.1, 0.8, 0.5, 0.99, 0)
    novaIgra(T0, rng)
    expect(rng.pozivi()).toBe(10)
  })
})

describe('prebaciZvuk', () => {
  it('„tap" samo kad je posle prebacivanja zvuk UKLJUČEN; čuvanje odloženo', () => {
    const g = igraIzStanja(stanje({ mute: false }))
    expect(prebaciZvuk(g)).toEqual({ ok: true, dogadjaji: [], cuvaj: 'odlozeno' })
    expect(g.s.mute).toBe(true)
    expect(prebaciZvuk(g)).toEqual({
      ok: true,
      dogadjaji: [{ tip: 'zvuk', id: 'tap' }],
      cuvaj: 'odlozeno',
    })
    expect(g.s.mute).toBe(false)
  })
})
