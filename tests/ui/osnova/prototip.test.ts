/*
 * UI osnova = prototip. Prototip radi u svom jsdom-u (tests/helpers/prototip.ts), a port u
 * drugom JSDOM dokumentu koji se ubrizgava kao koren — isti DOM, ista serijalizacija stilova.
 *
 * Node okruženje: i prototip i port imaju svoj JSDOM prozor, pa globalni jsdom nije potreban.
 */
import { JSDOM } from 'jsdom'
import { beforeAll, describe, expect, it } from 'vitest'
import { napraviFx } from '../../../src/ui/fx'
import { napraviHud, type PrikazNivoa } from '../../../src/ui/hud'
import { T0, mulberry32 } from '../../helpers'
import { ucitajPrototip, type Prototip } from '../../helpers/prototip'
import { brojac, dohvati, lazniTajmeri } from './lazno'

const SKELET =
  '<div id="novacPilula"></div><span id="novac">0</span><span id="nivoBr">1</span>' +
  '<div class="xpTraka"><i id="xpTraka"></i></div><div class="parcela" id="p0"></div>'

function port(fxRandom: () => number = () => 0.5) {
  const doc = new JSDOM(`<!DOCTYPE html><body>${SKELET}</body>`).window.document
  const lt = lazniTajmeri()
  const fx = napraviFx({ doc, tajmeri: lt.tajmeri, fxRandom, zvuk: () => {} })
  const hud = napraviHud({ koren: doc, sat: lt.sat, tajmeri: lt.tajmeri })
  const qa = (s: string) => [...doc.querySelectorAll<HTMLElement>(s)]
  return { doc, lt, fx, hud, qa }
}

describe('UI osnova = prototip', () => {
  let p: Prototip
  let izvor: () => number = () => 0.5

  beforeAll(async () => {
    // 'red': uklanjanja FX čvorova čekaju, pa ostaju za poređenje; rAF prototipa je trenutan.
    p = await ucitajPrototip({ t0: T0, tajmeri: 'red', random: () => izvor() })
  })

  function uporedi(
    proto: HTMLElement[],
    naPortu: HTMLElement[],
    rp: { n(): number },
    rt: { n(): number },
  ) {
    expect(naPortu.length).toBeGreaterThan(0)
    expect(naPortu.map((e) => e.getAttribute('style'))).toEqual(
      proto.map((e) => e.getAttribute('style')),
    )
    expect(naPortu.map((e) => e.className)).toEqual(proto.map((e) => e.className))
    expect(naPortu.map((e) => e.tagName)).toEqual(proto.map((e) => e.tagName))
    expect(rt.n()).toBe(rp.n())
  }

  it('letiNovcic(null, 1 | 3 | 10): isti stilovi (pozicija, transformacija, providnost)', () => {
    for (const broj of [1, 3, 10]) {
      for (const e of p.qa('body > .letac')) e.remove()
      const rp = brojac(mulberry32(broj))
      izvor = rp
      p.ev(`letiNovcic(null, ${broj})`)
      const rt = brojac(mulberry32(broj))
      const x = port(rt)
      x.fx.letiNovcic(null, broj)
      x.lt.okvir()
      x.lt.okvir()
      uporedi(p.qa('body > .letac'), x.qa('body > .letac'), rp, rt)
      expect(rt.n()).toBe(2 * Math.min(broj, 6))
    }
  })

  it('plusXp(null, 12): isti outerHTML', () => {
    p.ev('plusXp(null, 12)')
    const x = port()
    x.fx.plusXp(null, 12)
    expect(dohvati(x.qa('body > .plusxp'), 0).outerHTML).toBe(
      dohvati(p.qa('body > .plusxp'), 0).outerHTML,
    )
  })

  it('kapFx: isti stilovi tri kapi (6 izvlačenja)', () => {
    const el = p.d.createElement('div')
    p.d.body.appendChild(el)
    ;(p.w as unknown as { __kapEl: Element }).__kapEl = el
    const rp = brojac(mulberry32(7))
    izvor = rp
    p.ev('kapFx(window.__kapEl)')
    const rt = brojac(mulberry32(7))
    const x = port(rt)
    x.fx.kapFx(dohvati(x.qa('#p0'), 0))
    uporedi([...el.querySelectorAll<HTMLElement>('.kapFx')], x.qa('#p0 > .kapFx'), rp, rt)
    expect(rt.n()).toBe(6)
  })

  it('konfete: isti stilovi svih 26 komada (78 izvlačenja)', () => {
    for (const e of p.qa('body > .konfeta')) e.remove()
    const rp = brojac(mulberry32(11))
    izvor = rp
    p.ev('konfete()')
    const rt = brojac(mulberry32(11))
    const x = port(rt)
    x.fx.konfete()
    uporedi(p.qa('body > .konfeta'), x.qa('body > .konfeta'), rp, rt)
    expect(rt.n()).toBe(78)
  })

  it('crtajNivo: isti #nivoBr i širina #xpTraka za mrežu XP vrednosti', () => {
    const x = port()
    for (const xp of [0, 1, 29, 30, 31, 40, 86, 87, 500, 5000, 123456, 5935259, 6594699, 1e9]) {
      p.ev(`S.xp = ${xp}; crtajNivo()`)
      x.hud.crtajNivo(p.ev<PrikazNivoa>(`nivoIzXp(${xp})`))
      expect(dohvati(x.qa('#nivoBr'), 0).textContent, `xp ${xp}`).toBe(p.q('#nivoBr')?.textContent)
      expect(dohvati(x.qa('#xpTraka'), 0).style.width, `xp ${xp}`).toBe(
        p.q('#xpTraka')?.style.width,
      )
    }
  })

  it('crtajNovac: sa trenutnim rAF-om prototipa (pečat +1000 ms) oba završe na istom tekstu', () => {
    for (const novac of [50, 1017, 123456, 0]) {
      p.ev(`S.novac = ${novac}; crtajNovac()`)
      const x = port()
      x.hud.crtajNovac(novac)
      x.lt.okvir(x.lt.vreme() + 1000)
      expect(dohvati(x.qa('#novac'), 0).textContent).toBe(p.q('#novac')?.textContent)
    }
  })

  it('prototip nije prijavio greške', () => {
    expect(p.greske).toEqual([])
  })
})
