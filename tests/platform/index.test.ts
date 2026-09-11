// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { KLJUC_SEJVA } from '../../src/config'
import { napraviPlatformu } from '../../src/platform'

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('napraviPlatformu (browser)', () => {
  it('ima sve portove iz tipovi.ts', () => {
    const p = napraviPlatformu()
    expect(Object.keys(p).sort()).toEqual(
      [
        'audio',
        'clock',
        'dialog',
        'fxRandom',
        'haptics',
        'lifecycle',
        'random',
        'storage',
        'timers',
      ].sort(),
    )
  })

  it('bez host window.storage koristi localStorage; set je sinhron, pod ključem sejva', async () => {
    const p = napraviPlatformu()
    expect(p.storage).not.toBeNull()
    const upis = p.storage?.set(KLJUC_SEJVA, '{"v":3}')
    expect(localStorage.getItem(KLJUC_SEJVA)).toBe('{"v":3}')
    await upis
    expect(await p.storage?.get(KLJUC_SEJVA)).toBe('{"v":3}')
    expect(await p.storage?.get('nema')).toBeNull()
    // Proba nije ostavila trag.
    expect(localStorage.length).toBe(1)
  })

  it('host window.storage (prototipovo okruženje) ima prednost nad localStorage-om', async () => {
    const mem: Record<string, string> = { [KLJUC_SEJVA]: 'iz hosta' }
    vi.stubGlobal('storage', {
      get: async (k: string) => {
        if (!(k in mem)) throw new Error('nema kljuca')
        return { key: k, value: mem[k] }
      },
      set: async (k: string, v: string) => {
        mem[k] = v
      },
    })
    try {
      const p = napraviPlatformu()
      expect(await p.storage?.get(KLJUC_SEJVA)).toBe('iz hosta')
      expect(await p.storage?.get('nema')).toBeNull()
      await p.storage?.set(KLJUC_SEJVA, 'novo')
      expect(mem[KLJUC_SEJVA]).toBe('novo')
      expect(localStorage.getItem(KLJUC_SEJVA)).toBeNull()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('random i fxRandom čitaju Math.random u trenutku poziva i odvojeni su', () => {
    const p = napraviPlatformu()
    const spy = vi.spyOn(Math, 'random').mockReturnValueOnce(0.25).mockReturnValueOnce(0.75)
    expect(p.random()).toBe(0.25)
    expect(p.fxRandom()).toBe(0.75)
    expect(spy).toHaveBeenCalledTimes(2)
    expect(p.random).not.toBe(p.fxRandom)
  })

  it('sat: now = Date.now, danas u formatu YYYY-MM-DD', () => {
    const p = napraviPlatformu()
    const pre = Date.now()
    const t = p.clock.now()
    expect(t).toBeGreaterThanOrEqual(pre)
    expect(p.clock.danas(Date.UTC(2026, 8, 11, 10))).toBe('2026-09-11')
  })

  it('zvuk bez AudioContext-a u jsdom-u i vibracija bez navigator.vibrate ne bacaju', () => {
    const p = napraviPlatformu()
    expect(() => p.audio.play('tap')).not.toThrow()
    expect(() => p.haptics.vibrate([30, 40, 60])).not.toThrow()
  })

  it('dialog koristi window.confirm', async () => {
    const spy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    await expect(napraviPlatformu().dialog.confirm('Sigurno?')).resolves.toBe(true)
    expect(spy).toHaveBeenCalledWith('Sigurno?')
  })

  it('lifecycle kači slušače na pravi window (pagehide)', () => {
    let n = 0
    const odjava = napraviPlatformu().lifecycle.onHidden(() => n++)
    window.dispatchEvent(new Event('pagehide'))
    odjava()
    window.dispatchEvent(new Event('pagehide'))
    expect(n).toBe(1)
  })
})
