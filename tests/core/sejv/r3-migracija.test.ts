/*
 * R3 (CLAUDE.md obavezni test 3; 07 R3; 01 h.5 M4): migracija v2 → v3.
 * Fikstura = referenca-sim TEST 4 (R-L236–246), T0-relativna. Deo „brojacN 7 i dnevni poklon 145"
 * radi grana core-igra nad već migriranim stanjem (ugovor §9).
 *
 * Mutacije koje moraju da obore ovaj fajl (07 R3):
 * - ukloniti v===2 granu (MIGRACIJE[2])      → masine.kazan.k === false
 * - ukloniti spajanje magacina sa nulama     → mag.brasno === undefined
 * - ukloniti `z: !!x.z` iz parcela           → nema ključa z
 * - ne spljoštiti `ko` (D8)                  → ime/emoji/boja/msg nedostaju
 */
import { describe, expect, it } from 'vitest'
import { dekodirajSejv, type DekodiranSejv } from '../../../src/core/sejv'
import { T0 } from '../../helpers'
import { v2Test4 } from './alati'

type Ok = Extract<DekodiranSejv, { vrsta: 'ok' }>
function dek(o: unknown): Ok {
  const d = dekodirajSejv(JSON.stringify(o), T0)
  if (d.vrsta !== 'ok') throw new Error(`očekivano 'ok', dobijeno '${d.vrsta}'`)
  return d
}

describe('R3 — migracija v2 → v3', () => {
  it('kazan/kazanT → masine.kazan, magacin dopunjen nulama, parcele dobijaju z, narudžbine spljoštene', () => {
    const d = dekodirajSejv(JSON.stringify(v2Test4()), T0)
    expect(d.vrsta).toBe('ok')
    if (d.vrsta !== 'ok') return
    expect(d.izVerzije).toBe(2)
    const s = d.stanje
    expect(s.v).toBe(3)
    expect(s.novac).toBe(777)
    expect(s.xp).toBe(150)
    expect(s.masine).toEqual({ mlin: { k: false, t: 0 }, kazan: { k: true, t: 0 } })
    expect(s.mag).toEqual({
      psenica: 3,
      sargarepa: 0,
      paprika: 2,
      bundeva: 0,
      grozdje: 1,
      brasno: 0,
      ajvar: 1,
      jaje: 0,
      mleko: 0,
    })
    expect(s.parcele).toEqual([
      { c: 'paprika', t: T0 - 60_000, z: false },
      { c: null, t: 0, z: false },
    ])
    expect(s.ziv).toEqual({ kokosinjac: { k: false, t: 0 }, stala: { k: false, t: 0 } })
    expect(s.stat).toEqual({ ubrano: 0, zaradjeno: 0, isporuke: 0 })
    expect(s.poklonDan).toBe('')
    expect(s.mute).toBe(false)
    expect(s.sadio).toBe(true)
    expect(s.videno).toBe(T0)
    // D11 (01 D1): prototip ih čuva zauvek (06 bug 13).
    expect('kazan' in s).toBe(false)
    expect('kazanT' in s).toBe(false)
    expect(s.narudzbe.map((o) => o.id)).toEqual([5, 6])
    // D8 (06 bug 5): prototip je crtao „undefinedundefined„undefined“" i „undefined ti zahvaljuje!".
    // Boja ostaje SAČUVANA '#fff' (ne MUSTERIJE boja), poruka = prva poruka te mušterije.
    expect(s.narudzbe).toEqual([
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
    ])
    for (const o of s.narudzbe) expect(Object.keys(o)).not.toContain('ko')
    // Premeštanje nije gubitak: čist v2 sejv ne pravi rezervu.
    expect(d.popravke).toEqual([])
    // Paprika i dalje raste: 60 s od 300 s (C47; zrelihUseva je grana core-igra).
    const p0 = s.parcele[0]
    expect(p0?.c).toBe('paprika')
    expect(T0 - (p0?.t ?? 0)).toBe(60_000)
  })

  it('v2 kazan koji kuva (kazanT = T0 − 60 000) → t sačuvan', () => {
    const s = dek({ ...v2Test4(), kazanT: T0 - 60_000 }).stanje
    expect(s.masine.kazan).toEqual({ k: true, t: T0 - 60_000 })
  })

  it('v2 parcela {c:"psenica", t:T0, z:1} → z:true; bez z → false; višak polja se odbacuje', () => {
    const d = dek({
      ...v2Test4(),
      parcele: [
        { c: 'psenica', t: T0, z: 1 },
        { c: 'sargarepa', t: T0 - 1 },
        { c: 'paprika', t: T0 - 2, zaliveno: true },
      ],
    })
    expect(d.stanje.parcele).toEqual([
      { c: 'psenica', t: T0, z: true },
      { c: 'sargarepa', t: T0 - 1, z: false },
      { c: 'paprika', t: T0 - 2, z: false },
    ])
    expect(d.popravke.sort()).toEqual([
      'parcele[0].z: ispravljeno',
      'parcele[2].zaliveno: odbaceno',
    ])
  })

  it('v3 delimičan magacin {psenica:2} → ostalih 8 ključeva 0; {v:3} sam → podrazumevano (novac 50)', () => {
    const d = dek({ v: 3, mag: { psenica: 2 } })
    expect(d.stanje.mag).toEqual({
      psenica: 2,
      sargarepa: 0,
      paprika: 0,
      bundeva: 0,
      grozdje: 0,
      brasno: 0,
      ajvar: 0,
      jaje: 0,
      mleko: 0,
    })
    expect(dek({ v: 3 }).stanje.novac).toBe(50)
  })

  it.each([
    ['v:1', JSON.stringify({ ...v2Test4(), v: 1 }), 'neispravan'],
    ['v:4', JSON.stringify({ ...v2Test4(), v: 4 }), 'buduci'],
    ['"{"', '{', 'neispravan'],
  ])('%s → nije ok (%s)', (_opis, raw, vrsta) => {
    expect(dekodirajSejv(raw, T0).vrsta).toBe(vrsta)
  })
})
