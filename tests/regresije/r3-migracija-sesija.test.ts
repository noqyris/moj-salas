/*
 * CLAUDE.md regresija 3 — deo sesije. Dekodiranje v2 → v3 testira grana core-sejv
 * (tests/core/sejv/); ovde je stanje koje taj dekoder daje za TEST 4 v2 sejv, zapisano kao
 * literal (ugovor §9), i proverava se šta sesija radi nad njim: brojacN 7, prosliNivo 3, poklon 145.
 */
import { describe, expect, it } from 'vitest'
import { igraIzStanja } from '../../src/core/igra'
import { odbij, osigurajNarudzbe } from '../../src/core/narudzbine'
import { uzmiDnevniPoklon } from '../../src/core/odsustvo'
import { pogledParcele, zrelihUseva } from '../../src/core/polja'
import type { Stanje } from '../../src/core/types'
import { DAN_T0, T0, mulberry32, niz } from '../helpers'

/** referenca-sim TEST 4 (v2: novac 777, xp 150, kazan, 2 narudžbine sa `ko`) posle migracije (D8, D11). */
const MIGRIRANO = (): Stanje => ({
  v: 3,
  novac: 777,
  xp: 150,
  parcele: [
    { c: 'paprika', t: T0 - 60_000, z: false },
    { c: null, t: 0, z: false },
  ],
  mag: {
    psenica: 3,
    sargarepa: 0,
    paprika: 2,
    bundeva: 0,
    grozdje: 1,
    brasno: 0,
    ajvar: 1,
    jaje: 0,
    mleko: 0,
  },
  masine: { mlin: { k: false, t: 0 }, kazan: { k: true, t: 0 } },
  ziv: { kokosinjac: { k: false, t: 0 }, stala: { k: false, t: 0 } },
  narudzbe: [
    {
      id: 5,
      ime: 'Baka Mira',
      emoji: '👵',
      boja: '#fff',
      msg: 'Za unučiće spremam ručak…',
      stavke: [{ k: 'psenica', kom: 2 }],
      din: 60,
      xp: 5,
    },
    {
      id: 6,
      ime: 'Piljar Pera',
      emoji: '🧢',
      boja: '#fff',
      msg: 'Tezga mi je poluprazna…',
      stavke: [{ k: 'sargarepa', kom: 1 }],
      din: 80,
      xp: 6,
    },
  ],
  mute: false,
  sadio: true,
  stat: { ubrano: 0, zaradjeno: 0, isporuke: 0 },
  poklonDan: '',
  videno: T0,
})

describe('R3 (sesija nad migriranim v2 stanjem)', () => {
  it('brojacN 7, prosliNivo 3, tabla već puna (dopuna ne troši rng)', () => {
    const g = igraIzStanja(MIGRIRANO())
    expect(g.brojacN).toBe(7)
    expect(g.prosliNivo).toBe(3)
    osigurajNarudzbe(g, niz())
    expect(g.s.narudzbe.map((o) => o.id)).toEqual([5, 6])
  })

  it('C45: dnevni poklon na nivou 3 = 145 → novac 922; drugi put istog dana ništa', () => {
    const g = igraIzStanja(MIGRIRANO())
    expect(uzmiDnevniPoklon(g, DAN_T0)).toBe(145)
    expect(g.s.novac).toBe(922)
    expect(g.s.poklonDan).toBe(DAN_T0)
    expect(uzmiDnevniPoklon(g, DAN_T0)).toBeNull()
    expect(g.s.novac).toBe(922)
  })

  it('C47: paprika iz v2 i dalje raste (60 s od 300 s)', () => {
    const s = MIGRIRANO()
    expect(zrelihUseva(s, T0)).toBe(0)
    expect(pogledParcele(s.parcele[0] ?? { c: null, t: 0, z: false }, T0)).toMatchObject({
      vrsta: 'raste',
      c: 'paprika',
      preostaloS: 240,
    })
  })

  it('C48/C49: posle odbijanja nema kolizije, novi ID nastavlja od najvećeg starog (tačno 7)', () => {
    const g = igraIzStanja(MIGRIRANO())
    osigurajNarudzbe(g, mulberry32(1))
    odbij(g, 5, mulberry32(1))
    const ids = g.s.narudzbe.map((o) => o.id)
    expect(ids).toEqual([6, 7])
    expect(new Set(ids).size).toBe(2)
  })
})
