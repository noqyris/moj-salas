// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { ZAKLJUCAVANJE_TAPA_MS } from '../../../src/config'
import { OBLASTI_TAPA, napraviZakljucavanje, type OblastTapa } from '../../../src/ui/zakljucavanje'

function sat(pocetak = 5000) {
  let t = pocetak
  return { perfNow: () => t, pomeri: (ms: number) => void (t += ms) }
}

describe('D15 zaključavanje oblasti', () => {
  it('oblasti su tačno one iz ugovora (D15)', () => {
    expect([...OBLASTI_TAPA]).toEqual(['#tezga', '#narudzbeKuca', '#nivoOk', '#veo', '#njive'])
  })

  it('na početku ništa nije zaključano', () => {
    const z = napraviZakljucavanje(sat())
    for (const o of OBLASTI_TAPA) expect(z.zakljucano(o)).toBe(false)
  })

  it('zaključano tačno ZAKLJUCAVANJE_TAPA_MS: na +299 da, na +300 ne', () => {
    const s = sat()
    const z = napraviZakljucavanje(s)
    z.zakljucaj('#tezga')
    expect(z.zakljucano('#tezga')).toBe(true)
    s.pomeri(ZAKLJUCAVANJE_TAPA_MS - 1)
    expect(z.zakljucano('#tezga')).toBe(true)
    s.pomeri(1)
    expect(z.zakljucano('#tezga')).toBe(false)
  })

  it('različite oblasti se NE zaključavaju međusobno (TEST 1: parcela pa seme u istoj ms)', () => {
    const z = napraviZakljucavanje(sat())
    z.zakljucaj('#veo')
    const ostale = OBLASTI_TAPA.filter((o) => o !== '#veo')
    for (const o of ostale) expect(z.zakljucano(o), o).toBe(false)
  })

  it('ponovno zaključavanje produžava od novog trenutka', () => {
    const s = sat()
    const z = napraviZakljucavanje(s)
    z.zakljucaj('#njive')
    s.pomeri(200)
    z.zakljucaj('#njive')
    s.pomeri(ZAKLJUCAVANJE_TAPA_MS - 1)
    expect(z.zakljucano('#njive')).toBe(true)
    s.pomeri(1)
    expect(z.zakljucano('#njive')).toBe(false)
  })

  it('sat se čita u trenutku provere (perfNow iz ubrizganog sata, ne Date)', () => {
    let t = 0
    const z = napraviZakljucavanje({ perfNow: () => t })
    z.zakljucaj('#narudzbeKuca')
    t = 10_000
    expect(z.zakljucano('#narudzbeKuca')).toBe(false)
  })

  it('cuvaj: ignoriše poziv dok je oblast zaključana, inače prosleđuje argumente', () => {
    const s = sat()
    const z = napraviZakljucavanje(s)
    const pozivi: [string, number][] = []
    const prodaj = z.cuvaj('#tezga', (k: string, n: number) => {
      pozivi.push([k, n])
      z.zakljucaj('#tezga')
    })
    prodaj('psenica', 3)
    prodaj('sargarepa', 1) // brz drugi tap: red se pomerio, ali se ignoriše
    expect(pozivi).toEqual([['psenica', 3]])
    s.pomeri(ZAKLJUCAVANJE_TAPA_MS)
    prodaj('sargarepa', 1)
    expect(pozivi).toEqual([
      ['psenica', 3],
      ['sargarepa', 1],
    ])
  })

  it('cuvaj za jednu oblast ne blokira handler druge oblasti', () => {
    const z = napraviZakljucavanje(sat())
    const log: OblastTapa[] = []
    const parcela = z.cuvaj('#njive', () => log.push('#njive'))
    const veo = z.cuvaj('#veo', () => log.push('#veo'))
    z.zakljucaj('#veo')
    parcela()
    veo()
    expect(log).toEqual(['#njive'])
  })

  it('instance su nezavisne', () => {
    const a = napraviZakljucavanje(sat())
    const b = napraviZakljucavanje(sat())
    a.zakljucaj('#tezga')
    expect(b.zakljucano('#tezga')).toBe(false)
  })
})
