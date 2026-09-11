import { describe, expect, it } from 'vitest'
import { pocetnoStanje } from '../../src/core/stanje'
import { T0 } from '../helpers'
import { ucitajPrototip } from '../helpers/prototip'

describe('pocetnoStanje', () => {
  it('jednako je prototipovom POCETNO() (osim videno, koje je now)', async () => {
    const p = await ucitajPrototip({ t0: T0 })
    const proto = p.ev<Record<string, unknown>>('POCETNO()')
    const s = pocetnoStanje(T0)
    expect(s).toEqual({ ...proto, videno: T0 })
    // Isti redosled ključeva kao prototip, da sejv izgleda isto.
    expect(Object.keys(s)).toEqual(Object.keys(proto))
    expect(Object.keys(s.mag)).toEqual(Object.keys(proto.mag as object))
  })

  it('svaki poziv vraća nov objekat (nema deljenih referenci)', () => {
    const a = pocetnoStanje(T0)
    const b = pocetnoStanje(T0)
    a.parcele[0] = { c: 'psenica', t: T0, z: false }
    a.mag.psenica = 3
    a.masine.mlin.k = true
    expect(b.parcele[0]).toEqual({ c: null, t: 0, z: false })
    expect(b.mag.psenica).toBe(0)
    expect(b.masine.mlin.k).toBe(false)
    expect(a.parcele[1]).not.toBe(a.parcele[0])
  })
})
