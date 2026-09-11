// @vitest-environment jsdom
/*
 * Pomoćnik prototipa (tests/helpers/prototip.ts) sam po sebi: radi i u jsdom okruženju (putanja do
 * moja-farma-v3.html ne sme da zavisi od `new URL(…, import.meta.url)`, koji Vite tamo prepisuje), a
 * režim tajmera 'red' ima semantiku browsera — tajmer zakazan IZ tajmera računa od trenutka okidanja.
 */
import { describe, expect, it } from 'vitest'
import { T0 } from '../helpers'
import { PROTOTIP_HTML, ucitajPrototip } from '../helpers/prototip'

describe('pomoćnik prototipa', () => {
  it('učitava prototip i u jsdom okruženju', async () => {
    expect(PROTOTIP_HTML).toContain('<title>Moj Salaš</title>')
    const p = await ucitajPrototip({ t0: T0 })
    expect(p.qa('.parcela')).toHaveLength(3)
    expect(p.greske).toEqual([])
    p.w.close()
  })

  it("'red': ugnežđen tajmer računa od svog okidanja; redosled je (rok, zakazivanje); clearTimeout", async () => {
    const p = await ucitajPrototip({ t0: T0, tajmeri: 'red' })
    p.ev(`window.__log = [];
      setTimeout(() => { __log.push('a'); setTimeout(() => __log.push('b'), 2300) }, 700);
      setTimeout(() => __log.push('c100'), 100);
      setTimeout(() => __log.push('c50'), 50);
      setTimeout(() => __log.push('c100-2'), 100);
      window.__x = setTimeout(() => __log.push('otkazan'), 10);
      clearTimeout(window.__x);`)
    const log = () => p.ev<string[]>('__log')
    p.tajmeri(2999)
    expect(log()).toEqual(['c50', 'c100', 'c100-2', 'a'])
    p.tajmeri(1) // 700 + 2300 = 3000: sakrivanje toasta posle saveta pada tačno ovde
    expect(log()).toEqual(['c50', 'c100', 'c100-2', 'a', 'b'])
    // Tajmer zakazan posle prozora računa od kraja prozora.
    p.ev(`setTimeout(() => __log.push('d'), 5)`)
    p.tajmeri(4)
    expect(log()).not.toContain('d')
    p.tajmeri(1)
    expect(log().at(-1)).toBe('d')
    expect(p.greske).toEqual([])
    p.w.close()
  })
})
