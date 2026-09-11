import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHaptics, type VibracijaNavigator } from '../../src/platform/haptics'

afterEach(() => {
  vi.unstubAllGlobals()
})

function lazniNavigator() {
  const pozivi: { obrazac: unknown; thisJeNav: boolean }[] = []
  const nav: VibracijaNavigator = {
    vibrate(this: unknown, obrazac) {
      pozivi.push({ obrazac, thisJeNav: this === nav })
      return true
    },
  }
  return { nav, pozivi }
}

describe('haptics (05 §5)', () => {
  it('broj i niz se prosleđuju navigator.vibrate kao metoda (this = navigator)', () => {
    const { nav, pozivi } = lazniNavigator()
    const h = createHaptics(() => nav)
    h.vibrate(12)
    h.vibrate([30, 40, 60])
    expect(pozivi).toEqual([
      { obrazac: 12, thisJeNav: true },
      { obrazac: [30, 40, 60], thisJeNav: true },
    ])
  })

  it('readonly niz iz config-a se ne prosleđuje po referenci (API traži mutable number[])', () => {
    const { nav, pozivi } = lazniNavigator()
    const obrazac = Object.freeze([15, 25, 15]) as readonly number[]
    createHaptics(() => nav).vibrate(obrazac)
    expect(pozivi[0]?.obrazac).toEqual([15, 25, 15])
    expect(pozivi[0]?.obrazac).not.toBe(obrazac)
  })

  it('bez vibrate (iOS Safari) ili bez navigatora: tiho', () => {
    expect(() => createHaptics(() => ({})).vibrate(10)).not.toThrow()
    expect(() => createHaptics(() => undefined).vibrate(10)).not.toThrow()
    expect(() =>
      createHaptics(() => ({ vibrate: 'nije funkcija' }) as unknown as VibracijaNavigator).vibrate(
        10,
      ),
    ).not.toThrow()
  })

  it('vibrate koji baca se guta', () => {
    const h = createHaptics(() => ({
      vibrate: () => {
        throw new Error('bez korisničkog gesta')
      },
    }))
    expect(() => h.vibrate([15, 30, 15])).not.toThrow()
  })

  it('navigator se traži pri svakom pozivu', () => {
    const a = lazniNavigator()
    const b = lazniNavigator()
    let tekuci = a.nav
    const h = createHaptics(() => tekuci)
    h.vibrate(18)
    tekuci = b.nav
    h.vibrate(20)
    expect(a.pozivi.map((p) => p.obrazac)).toEqual([18])
    expect(b.pozivi.map((p) => p.obrazac)).toEqual([20])
  })

  it('podrazumevano koristi globalni navigator u trenutku poziva', () => {
    const h = createHaptics()
    const vibrate = vi.fn(() => true)
    vi.stubGlobal('navigator', { vibrate })
    h.vibrate(14)
    expect(vibrate).toHaveBeenCalledWith(14)
    vi.stubGlobal('navigator', undefined)
    expect(() => h.vibrate(14)).not.toThrow()
  })
})
