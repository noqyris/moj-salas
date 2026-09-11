// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTimers } from '../../src/platform/timers'

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('createTimers — delegira window funkcijama u trenutku poziva', () => {
  it('setTimeout/clearTimeout: argumenti i id prolaze; špijun postavljen POSLE pravljenja se koristi', () => {
    const t = createTimers()
    const cb = () => {}
    const st = vi.spyOn(window, 'setTimeout').mockReturnValue(42 as never)
    const ct = vi.spyOn(window, 'clearTimeout').mockImplementation(() => {})
    expect(t.setTimeout(cb, 180)).toBe(42)
    expect(st).toHaveBeenCalledWith(cb, 180)
    t.clearTimeout(42)
    expect(ct).toHaveBeenCalledWith(42)
  })

  it('setInterval/clearInterval', () => {
    const t = createTimers()
    const cb = () => {}
    const si = vi.spyOn(window, 'setInterval').mockReturnValue(7 as never)
    const ci = vi.spyOn(window, 'clearInterval').mockImplementation(() => {})
    expect(t.setInterval(cb, 1000)).toBe(7)
    expect(si).toHaveBeenCalledWith(cb, 1000)
    t.clearInterval(7)
    expect(ci).toHaveBeenCalledWith(7)
  })

  it('raf/cancelRaf → requestAnimationFrame/cancelAnimationFrame', () => {
    const t = createTimers()
    const cb = () => {}
    const r = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(9)
    const c = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
    expect(t.raf(cb)).toBe(9)
    expect(r).toHaveBeenCalledWith(cb)
    t.cancelRaf(9)
    expect(c).toHaveBeenCalledWith(9)
  })

  it('stvarno izvršava sa lažnim tajmerima (vi.useFakeTimers posle pravljenja)', () => {
    const t = createTimers()
    vi.useFakeTimers()
    const log: string[] = []
    t.setTimeout(() => log.push('180'), 180)
    const otkazan = t.setTimeout(() => log.push('otkazan'), 100)
    t.clearTimeout(otkazan)
    vi.advanceTimersByTime(179)
    expect(log).toEqual([])
    vi.advanceTimersByTime(1)
    expect(log).toEqual(['180'])
  })

  it('pravi rAF u jsdom-u dobija vremenski pečat (broj)', async () => {
    const t = createTimers()
    const ts = await new Promise<number>((r) => t.raf(r))
    expect(typeof ts).toBe('number')
  })
})
