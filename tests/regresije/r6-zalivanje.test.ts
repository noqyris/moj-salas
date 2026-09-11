/*
 * CLAUDE.md regresija 6 — zalivanje: jednom po usevu, −25 % PREOSTALOG vremena, nikad ispod nule
 * (07 R6, vrednosti izmerene na prototipu, exp4-regressions).
 *
 * Mutacije koje hvata:
 *  - `Math.floor` umesto `Math.round`          → red „preostalo 2" (Δt 0 umesto −1)
 *  - 25 % UKUPNOG vremena                       → prvi test (5 000 umesto 4 000)
 *  - bez provere `p.z`                          → drugo zalivanje
 *  - bez provere `preostalo <= 0`               → redovi 0 i −5 000
 */
import { describe, expect, it } from 'vitest'
import { KULTURE, REDOSLED } from '../../src/config'
import { posadi, zalij, zrelihUseva } from '../../src/core/polja'
import { T0 } from '../helpers'
import { igra, odbijeno, pecat } from '../core/pomocnici'

describe('R6: zalivanje', () => {
  it('jednom po usevu, −25 % PREOSTALOG vremena; zrelo tačno 0,75 · preostalo kasnije', () => {
    const g = igra({ novac: 50, xp: 0 })
    expect(posadi(g, 0, 'psenica', T0).ok).toBe(true) // t = T0
    let r = pecat(g, T0 + 4000, zalij(g, 0, T0 + 4000)) // preostalo 16 000 → t −= 4 000
    expect(r.ok).toBe(true)
    expect(g.s.parcele[0]).toEqual({ c: 'psenica', t: T0 - 4000, z: true })
    expect(g.s.videno).toBe(T0 + 4000)
    expect(r.dogadjaji).toContainEqual({ tip: 'poruka', poruka: { id: 'zaliveno' } })
    r = zalij(g, 0, T0 + 5000)
    expect(r).toEqual({
      ok: false,
      dogadjaji: [
        { tip: 'zvuk', id: 'tap' },
        { tip: 'poruka', poruka: { id: 'vecZaliveno' } },
      ],
      cuvaj: 'ne',
    })
    expect(g.s.parcele[0]?.t).toBe(T0 - 4000)
    expect(zrelihUseva(g.s, T0 + 15_999)).toBe(0)
    expect(zrelihUseva(g.s, T0 + 16_000)).toBe(1)
  })

  it.each([
    [16_001, -4000, true],
    [6, -2, true],
    [5, -1, true],
    [3, -1, true],
    [2, -1, true], // JS Math.round(0.5) = 1 (ne bankarsko)
    [1, 0, true], // zalivanje se „potroši", a vreme se ne pomeri — kao u prototipu
    [0, 0, false],
    [-5000, 0, false],
  ])('preostalo %i ms → Δt %i, z %s', (preostalo, dt, z) => {
    const g = igra({
      parcele: [
        { c: 'psenica', t: T0 - (20_000 - preostalo), z: false },
        { c: null, t: 0, z: false },
      ],
    })
    const t0 = g.s.parcele[0]?.t ?? NaN
    if (z) {
      expect(zalij(g, 0, T0).ok).toBe(true)
    } else {
      expect(odbijeno(g, () => zalij(g, 0, T0))).toEqual([]) // tiho
    }
    expect((g.s.parcele[0]?.t ?? NaN) - t0).toBe(dt)
    expect(g.s.parcele[0]?.z).toBe(z)
  })

  it('šargarepa 30 s od 90 s → Δt −15 000, zrela 45 s kasnije', () => {
    const g = igra({ parcele: [{ c: 'sargarepa', t: T0 - 30_000, z: false }] })
    zalij(g, 0, T0)
    expect(g.s.parcele[0]?.t).toBe(T0 - 45_000)
    expect(zrelihUseva(g.s, T0 + 44_999)).toBe(0)
    expect(zrelihUseva(g.s, T0 + 45_000)).toBe(1)
  })

  it('svojstvo: za svaku kulturu i preostalo ∈ [1, vreme·1000] (korak 997) novo preostalo ∈ [1, preostalo]', () => {
    for (const k of REDOSLED) {
      const ukupno = KULTURE[k].vreme * 1000
      for (let preostalo = 1; preostalo <= ukupno; preostalo += 997) {
        const g = igra({ parcele: [{ c: k, t: T0 - (ukupno - preostalo), z: false }] })
        expect(zalij(g, 0, T0).ok).toBe(true)
        const p = g.s.parcele[0]
        if (!p) throw new Error('nema parcele')
        const novo = ukupno - (T0 - p.t)
        expect(novo).toBe(preostalo - Math.round(preostalo * 0.25))
        expect(novo).toBeGreaterThanOrEqual(1)
        expect(novo).toBeLessThanOrEqual(preostalo)
      }
    }
  })

  it('prazna parcela i indeks van opsega: tiho, bez promene', () => {
    const g = igra()
    expect(odbijeno(g, () => zalij(g, 0, T0))).toEqual([])
    expect(odbijeno(g, () => zalij(g, 5, T0))).toEqual([])
  })

  it('žetva i nova sadnja vraćaju mogućnost zalivanja (z se briše samo sadnjom)', () => {
    const g = igra({ novac: 100, parcele: [{ c: 'psenica', t: T0 - 30_000, z: true }] })
    expect(zalij(g, 0, T0).ok).toBe(false)
    g.s.parcele[0] = { c: null, t: 0, z: false }
    posadi(g, 0, 'psenica', T0)
    expect(zalij(g, 0, T0).ok).toBe(true)
  })
})
