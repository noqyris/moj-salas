import { afterEach, describe, expect, it, vi } from 'vitest'
import { createClock, lokalniDan } from '../../src/platform/clock'
import { DAN_T0, T0 } from '../helpers'

const utc = (iso: string) => Date.parse(iso)

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('clock.danas(now) — lokalni dan kao prototip (toLocaleDateString("sv"))', () => {
  it('testovi rade u zoni Europe/Belgrade (vite.config → test.env.TZ)', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('Europe/Belgrade')
  })

  it('format YYYY-MM-DD sa nulama; T0 je 2026-01-15', () => {
    const c = createClock()
    expect(c.danas(T0)).toBe(DAN_T0)
    expect(c.danas(utc('2026-02-05T12:00:00Z'))).toBe('2026-02-05')
  })

  it('ponoć je lokalna, ne UTC (zima, UTC+1)', () => {
    expect(lokalniDan(utc('2025-12-31T22:59:59.999Z'))).toBe('2025-12-31')
    expect(lokalniDan(utc('2025-12-31T23:00:00.000Z'))).toBe('2026-01-01')
  })

  it('prelazak na letnje vreme (29. 3. 2026, 02:00 → 03:00)', () => {
    const tabela: [string, string][] = [
      ['2026-03-28T22:59:59.999Z', '2026-03-28'], // 23:59:59 CET
      ['2026-03-28T23:00:00.000Z', '2026-03-29'], // 00:00 CET
      ['2026-03-29T00:59:59.999Z', '2026-03-29'], // 01:59:59 CET
      ['2026-03-29T01:00:00.000Z', '2026-03-29'], // 03:00 CEST
      ['2026-03-29T21:59:59.999Z', '2026-03-29'], // 23:59:59 CEST
      ['2026-03-29T22:00:00.000Z', '2026-03-30'], // ponoć je sada u 22:00 UTC
    ]
    for (const [iso, dan] of tabela) expect(lokalniDan(utc(iso)), iso).toBe(dan)
  })

  it('povratak na zimsko vreme (25. 10. 2026, 03:00 → 02:00; sat između se ponavlja)', () => {
    const tabela: [string, string][] = [
      ['2026-10-24T21:59:59.999Z', '2026-10-24'], // 23:59:59 CEST
      ['2026-10-24T22:00:00.000Z', '2026-10-25'], // 00:00 CEST
      ['2026-10-25T00:30:00.000Z', '2026-10-25'], // 02:30 CEST
      ['2026-10-25T01:30:00.000Z', '2026-10-25'], // 02:30 CET (ponovljeni sat)
      ['2026-10-25T22:59:59.999Z', '2026-10-25'], // 23:59:59 CET
      ['2026-10-25T23:00:00.000Z', '2026-10-26'], // ponoć je opet u 23:00 UTC
    ]
    for (const [iso, dan] of tabela) expect(lokalniDan(utc(iso)), iso).toBe(dan)
  })

  it('cela 2026. u koracima od 15 min = ručno sklopljen lokalni Y-M-D (35 040 trenutaka)', () => {
    const pad = (n: number) => String(n).padStart(2, '0')
    let razlike = 0
    let n = 0
    for (let t = utc('2026-01-01T00:00:00Z'); t < utc('2027-01-01T00:00:00Z'); t += 900_000) {
      const d = new Date(t)
      const rucno = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
      if (lokalniDan(t) !== rucno) razlike++
      n++
    }
    expect(n).toBe(35040)
    expect(razlike).toBe(0)
  })

  it('stringovi se porede leksikografski kao datumi (D5: poklonDan < danas)', () => {
    const dani = [
      utc('2026-01-09T12:00:00Z'),
      utc('2026-01-10T12:00:00Z'),
      utc('2026-09-30T12:00:00Z'),
      utc('2026-10-01T12:00:00Z'),
    ].map(lokalniDan)
    // '' (poklon nikad uzet) je manji od svakog dana.
    expect(['', ...dani].reverse().sort()).toEqual(['', ...dani])
  })
})

describe('clock.now / perfNow — čitaju se u trenutku poziva', () => {
  it('now() prati Date.now() i kad se sat zameni posle pravljenja', () => {
    const c = createClock()
    vi.useFakeTimers()
    vi.setSystemTime(T0)
    expect(c.now()).toBe(T0)
    vi.setSystemTime(T0 + 21_000)
    expect(c.now()).toBe(T0 + 21_000)
  })

  it('perfNow() je performance.now() u trenutku poziva', () => {
    const c = createClock()
    const spy = vi.spyOn(performance, 'now').mockReturnValue(1234.5)
    expect(c.perfNow()).toBe(1234.5)
    spy.mockReturnValue(99)
    expect(c.perfNow()).toBe(99)
  })

  it('danas() nije vezan za sistemski sat: zavisi samo od argumenta', () => {
    const c = createClock()
    vi.useFakeTimers()
    vi.setSystemTime(utc('2030-06-01T12:00:00Z'))
    expect(c.danas(T0)).toBe(DAN_T0)
  })
})
