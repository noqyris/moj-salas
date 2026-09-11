/*
 * CLAUDE.md regresija 8 — jedan XP poziv koji preskače više nivoa: svaki nivo dobija svoj bonus i
 * svoj događaj, rastućim redom, bonus odmah (07 R8; izmereno exp4/exp7).
 *
 * Mutacije koje hvata:
 *  - `if` umesto `while` u petlji nivoa         → [2] umesto [2, 3, 4]
 *  - bonus samo za poslednji nivo              → novac 210 umesto 410
 *  - `prosliNivo` se ne izvodi iz XP pri učitavanju (npr. 1) → ponovljeni level-up-ovi
 */
import { describe, expect, it } from 'vitest'
import type { Dogadjaj } from '../../src/core/dogadjaji'
import { igraIzStanja } from '../../src/core/igra'
import { isporuci, novaNarudzba } from '../../src/core/narudzbine'
import { dodajXp, nivoIzXp } from '../../src/core/xp'
import { MAG0, T0, mulberry32, narudzba, stanje } from '../helpers'
import { igra, nivoi, ucitajIgru } from '../core/pomocnici'

const nivoDogadjaji = (d: Dogadjaj[]) => d.filter((e) => e.tip === 'nivo')

describe('R8: XP preko više nivoa', () => {
  it('dodajXp(200) sa nivoa 1 → nivoi 2, 3, 4 redom, 40·l svaki, odmah', () => {
    const g = igra({ novac: 50, xp: 0 })
    const d = dodajXp(g, 200, { vrsta: 'uberiSve' })
    expect(d[0]).toEqual({ tip: 'xp', iznos: 200, sidro: { vrsta: 'uberiSve' } })
    expect(nivoi(d)).toEqual([
      [2, 80],
      [3, 120],
      [4, 160],
    ])
    expect(nivoDogadjaji(d).map((e) => (e.tip === 'nivo' ? e.otkljucano : null))).toEqual([
      [
        { vrsta: 'kultura', id: 'paprika' },
        { vrsta: 'masina', id: 'mlin' },
      ],
      [
        { vrsta: 'kultura', id: 'bundeva' },
        { vrsta: 'masina', id: 'kazan' },
        { vrsta: 'zivotinja', id: 'kokosinjac' },
      ],
      [{ vrsta: 'kultura', id: 'grozdje' }],
    ])
    expect(g.s.novac).toBe(410)
    expect(g.prosliNivo).toBe(4)
    expect(nivoIzXp(g.s.xp)).toEqual({ lvl: 4, u: 5, do: 206 })
  })

  it('xp 400 → +1135 → nivoi 5, 6, 7 (štala / aukcija / ništa), bonus 720', () => {
    const g = igra({ novac: 0, xp: 400 })
    const d = dodajXp(g, 1135, { vrsta: 'narudzba', id: 1 })
    expect(nivoDogadjaji(d)).toEqual([
      { tip: 'nivo', nivo: 5, bonus: 200, otkljucano: [{ vrsta: 'zivotinja', id: 'stala' }] },
      { tip: 'nivo', nivo: 6, bonus: 240, otkljucano: [{ vrsta: 'aukcija' }] },
      { tip: 'nivo', nivo: 7, bonus: 280, otkljucano: [] },
    ])
    expect(g.s.novac).toBe(720)
    expect(g.prosliNivo).toBe(7)
  })

  it('plafon: xp 6 594 698 → +10 → samo [20] (+800); dalji +1e9 → nema nivoa, ostaje 20', () => {
    const g = igra({ novac: 0, xp: 6_594_698 })
    expect(g.prosliNivo).toBe(19)
    expect(nivoi(dodajXp(g, 10, { vrsta: 'uberiSve' }))).toEqual([[20, 800]])
    expect(nivoi(dodajXp(g, 1e9, { vrsta: 'uberiSve' }))).toEqual([])
    expect(g.s.novac).toBe(800)
    expect(nivoIzXp(g.s.xp).lvl).toBe(20)
    expect(g.prosliNivo).toBe(20)
  })

  it('kroz pravu akciju: isporuka narudžbine od 200 XP sa nivoa 1 → 435 din, 3 nivoa (exp7)', () => {
    const g = ucitajIgru(
      JSON.stringify(
        stanje({
          mag: { ...MAG0, psenica: 1 },
          narudzbe: [narudzba(1, 'psenica', 1, 25, 200), narudzba(2, 'sargarepa', 9, 700, 70)],
        }),
      ),
      mulberry32(1),
    )
    const r = isporuci(g, 1, T0, mulberry32(1))
    expect(r.dogadjaji.map((e) => e.tip)).toEqual([
      'novcici',
      'vibracija',
      'xp',
      'nivo',
      'nivo',
      'nivo',
      'poruka',
    ])
    expect(nivoi(r.dogadjaji).map(([l]) => l)).toEqual([2, 3, 4])
    expect(g.s.novac).toBe(435)
    expect(g.prosliNivo).toBe(4)
    // Zamena nastaje POSLE dodajXp → pool nivoa 4; prototip je dao baš ove stavke (exp7)
    expect(g.s.narudzbe.map((o) => o.id)).toEqual([2, 3])
    expect(g.s.narudzbe[1]?.stavke).toEqual([
      { k: 'sargarepa', kom: 3 },
      { k: 'psenica', kom: 9 },
    ])
  })

  it('zamenska narudžbina iz R8 je ona sa nivoa 4, ne sa nivoa 1', () => {
    const pre = igraIzStanja(stanje({ xp: 0 }))
    pre.brojacN = 3
    const posle = igraIzStanja(stanje({ xp: 200 }))
    posle.brojacN = 3
    expect(novaNarudzba(posle, mulberry32(1)).stavke).toEqual([
      { k: 'sargarepa', kom: 3 },
      { k: 'psenica', kom: 9 },
    ])
    expect(novaNarudzba(pre, mulberry32(1)).stavke).not.toEqual([
      { k: 'sargarepa', kom: 3 },
      { k: 'psenica', kom: 9 },
    ])
  })

  it('učitavanje ne ponavlja level-up-ove: xp 5000 → prosliNivo 8, dodajXp(0) bez nivoa', () => {
    const g = igraIzStanja(stanje({ xp: 5000, novac: 7 }))
    expect(g.prosliNivo).toBe(8)
    expect(nivoi(dodajXp(g, 0, { vrsta: 'uberiSve' }))).toEqual([])
    expect(g.s.novac).toBe(7)
  })
})
