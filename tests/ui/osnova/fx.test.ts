// @vitest-environment jsdom
// Paritet sa prototipom (isti tok nasumičnosti → isti DOM) je u prototip.test.ts.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ART } from '../../../src/art'
import { NOVAC_ZVUK_ODLAGANJE_MS } from '../../../src/config'
import type { ZvukId } from '../../../src/core/dogadjaji'
import { t } from '../../../src/i18n'
import { $, $$ } from '../../../src/ui/dom'
import { napraviFx } from '../../../src/ui/fx'
import { niz } from '../../helpers'
import { brojac, dohvati, lazniTajmeri, pravougaonik } from './lazno'

const SKELET =
  '<div id="novacPilula"></div><button id="dugme"></button><div class="parcela" id="p0"></div>'

beforeEach(() => {
  document.body.innerHTML = SKELET
})

function postavi(fxRandom: () => number = niz()) {
  const lt = lazniTajmeri()
  const zvukovi: ZvukId[] = []
  const fx = napraviFx({
    doc: document,
    tajmeri: lt.tajmeri,
    fxRandom,
    zvuk: (id) => zvukovi.push(id),
  })
  return { lt, fx, zvukovi }
}

/** Kako jsdom serijalizuje dati HTML (za poređenje innerHTML-a sa ART stringom). */
function serijalizovano(html: string): string {
  const d = document.createElement('div')
  d.innerHTML = html
  return d.innerHTML
}

const novcici = () => $$(document, 'body > .letac')

describe('letiNovcic (04 §5)', () => {
  it('min(broj, 6) novčića, tačno 2 izvlačenja po novčiću', () => {
    for (const [broj, ocekivano] of [
      [1, 1],
      [3, 3],
      [6, 6],
      [10, 6],
      [0, 0],
    ] as const) {
      document.body.innerHTML = SKELET
      const rnd = brojac(() => 0.5)
      postavi(rnd).fx.letiNovcic($(document, '#dugme'), broj)
      expect(novcici(), `broj ${broj}`).toHaveLength(ocekivano)
      expect(rnd.n(), `broj ${broj}`).toBe(2 * ocekivano)
    }
  })

  it('novčić: div.letac sa ART.novcic, dodat na KRAJ body-ja', () => {
    const { fx } = postavi(niz(0.5, 0.5))
    fx.letiNovcic(null, 1)
    const c = dohvati(novcici(), 0)
    expect(c.className).toBe('letac')
    expect(c.innerHTML).toBe(serijalizovano(ART.novcic))
    expect(document.body.lastElementChild).toBe(c)
  })

  it('geometrija: start oko centra izvora (x pa y iz fxRandom), cilj centar #novacPilula', () => {
    $(document, '#dugme').getBoundingClientRect = () => pravougaonik(100, 200, 40, 20)
    $(document, '#novacPilula').getBoundingClientRect = () => pravougaonik(300, 10, 80, 30)
    const { fx, lt } = postavi(niz(0.5, 0.5, 0, 0, 0.25, 0.75))
    fx.letiNovcic($(document, '#dugme'), 3)
    // x0 = 100 + 20 − 10 + (r·36 − 18), y0 = 200 + 10 − 10 + (r·20 − 10)
    expect(novcici().map((c) => [c.style.left, c.style.top])).toEqual([
      ['110px', '200px'],
      ['92px', '190px'],
      ['101px', '205px'],
    ])
    lt.okvir()
    lt.okvir()
    // cilj: 300 + 40 − 10 − x0, 10 + 15 − 10 − y0
    expect(novcici().map((c) => c.style.transform)).toEqual([
      'translate(220px,-185px) scale(.55)',
      'translate(238px,-175px) scale(.55)',
      'translate(229px,-190px) scale(.55)',
    ])
    expect(novcici().map((c) => c.style.opacity)).toEqual(['0.15', '0.15', '0.15'])
  })

  it('bez izvora leti od body-ja (jsdom: nule)', () => {
    const { fx } = postavi(niz(0, 1))
    fx.letiNovcic(null, 1)
    expect(dohvati(novcici(), 0).style.left).toBe('-28px')
    expect(dohvati(novcici(), 0).style.top).toBe('0px')
  })

  it('dupli rAF: posle prvog okvira nema transformacije, posle drugog ima', () => {
    const { fx, lt } = postavi(brojac(() => 0.5))
    fx.letiNovcic(null, 3)
    expect(lt.rafUredu()).toBe(3)
    expect(novcici().map((c) => c.style.transform)).toEqual(['', '', ''])
    lt.okvir()
    expect(lt.rafUredu()).toBe(3)
    expect(novcici().map((c) => c.style.transform)).toEqual(['', '', ''])
    lt.okvir()
    expect(lt.rafUredu()).toBe(0)
    expect(novcici().every((c) => c.style.transform.endsWith('scale(.55)'))).toBe(true)
  })

  it('tajmeri redom [700, 740, 780, 480]; za 6 novčića [700…900, 480] (izmereno na prototipu)', () => {
    const a = postavi(brojac(() => 0.5))
    a.fx.letiNovcic(null, 3)
    expect(a.lt.kasnjenja).toEqual([700, 740, 780, 480])
    const b = postavi(brojac(() => 0.5))
    b.fx.letiNovcic(null, 10)
    expect(b.lt.kasnjenja).toEqual([700, 740, 780, 820, 860, 900, 480])
  })

  it('novčići nestaju na 700 + i·40 ms', () => {
    const { fx, lt } = postavi(brojac(() => 0.5))
    fx.letiNovcic(null, 3)
    lt.pomeri(699)
    expect(novcici()).toHaveLength(3)
    lt.pomeri(1)
    expect(novcici()).toHaveLength(2)
    lt.pomeri(40)
    expect(novcici()).toHaveLength(1)
    lt.pomeri(39)
    expect(novcici()).toHaveLength(1)
    lt.pomeri(1)
    expect(novcici()).toHaveLength(0)
  })

  it('zvuk „novac" preko callback-a tek posle NOVAC_ZVUK_ODLAGANJE_MS (480), jednom', () => {
    expect(NOVAC_ZVUK_ODLAGANJE_MS).toBe(480)
    const { fx, lt, zvukovi } = postavi(brojac(() => 0.5))
    fx.letiNovcic(null, 6)
    expect(zvukovi).toEqual([])
    lt.pomeri(479)
    expect(zvukovi).toEqual([])
    lt.pomeri(1)
    expect(zvukovi).toEqual(['novac'])
    lt.pomeri(5000)
    expect(zvukovi).toEqual(['novac'])
  })

  it('i sa 0 novčića zvuk se zakazuje (prototip: petlja 0 puta, pa setTimeout)', () => {
    const { fx, lt, zvukovi } = postavi()
    fx.letiNovcic(null, 0)
    expect(lt.kasnjenja).toEqual([480])
    lt.pomeri(480)
    expect(zvukovi).toEqual(['novac'])
  })
})

describe('plusXp', () => {
  it('div.plusxp sa tekstom iz i18n, iznad centra izvora; nestaje na 900 ms', () => {
    $(document, '#dugme').getBoundingClientRect = () => pravougaonik(100, 200, 40, 20)
    const { fx, lt } = postavi()
    fx.plusXp($(document, '#dugme'), 12)
    const [p, ...visak] = $$(document, 'body > .plusxp')
    expect(visak).toEqual([])
    expect(p?.textContent).toBe(t.fx.plusXp(12))
    expect(p?.textContent).toBe('+12 XP')
    expect(p?.style.left).toBe('100px')
    expect(p?.style.top).toBe('194px')
    expect(lt.kasnjenja).toEqual([900])
    lt.pomeri(899)
    expect($$(document, '.plusxp')).toHaveLength(1)
    lt.pomeri(1)
    expect($$(document, '.plusxp')).toHaveLength(0)
  })

  it('bez izvora: body (prototip u jsdom-u: left −20px, top −6px); ne troši fxRandom', () => {
    const { fx } = postavi(niz())
    fx.plusXp(null, 2)
    expect(dohvati($$(document, '.plusxp'), 0).outerHTML).toBe(
      '<div class="plusxp" style="left: -20px; top: -6px;">+2 XP</div>',
    )
  })

  it('XP je sirov broj, ne fmt (05 §3.13): 1234 → „+1234 XP"', () => {
    const { fx } = postavi()
    fx.plusXp(null, 1234)
    expect(dohvati($$(document, '.plusxp'), 0).textContent).toBe('+1234 XP')
  })
})

describe('kapFx', () => {
  it('3 span.kapFx UNUTAR parcele sa ART.kap; left pa top iz fxRandom; kašnjenja 0/0.09/0.18 s', () => {
    const { fx } = postavi(niz(0, 0.5, 0.5, 0, 0.25, 0.25))
    const p0 = $(document, '#p0')
    fx.kapFx(p0)
    const kapi = $$(document, '#p0 > .kapFx')
    expect(kapi).toHaveLength(3)
    expect($$(document, 'body > .kapFx')).toHaveLength(0)
    expect(kapi.map((k) => k.tagName)).toEqual(['SPAN', 'SPAN', 'SPAN'])
    expect(kapi.map((k) => [k.style.left, k.style.top, k.style.animationDelay])).toEqual([
      ['22%', '24%', '0s'],
      ['45%', '14%', '0.09s'],
      ['33.5%', '19%', '0.18s'],
    ])
    expect(dohvati(kapi, 0).innerHTML).toBe(serijalizovano(ART.kap))
  })

  it('kapi nestaju na 800 ms', () => {
    const { fx, lt } = postavi(brojac(() => 0.5))
    const p0 = $(document, '#p0')
    fx.kapFx(p0)
    expect(lt.kasnjenja).toEqual([800, 800, 800])
    lt.pomeri(799)
    expect($$(p0, '.kapFx')).toHaveLength(3)
    lt.pomeri(1)
    expect($$(p0, '.kapFx')).toHaveLength(0)
  })
})

describe('konfete', () => {
  it('26 div.konfeta na body-ju; boje u krug; 3 izvlačenja po komadu (left, trajanje, kašnjenje)', () => {
    const vrednosti = [0.5, 0, 0.25, 0, 0.25, 0.5, ...Array<number>(72).fill(0)]
    const { fx } = postavi(niz(...vrednosti))
    fx.konfete()
    const k = $$(document, 'body > .konfeta')
    expect(k).toHaveLength(26)
    const prvaDva = k
      .slice(0, 2)
      .map((e) => [e.style.left, e.style.animationDuration, e.style.animationDelay])
    expect(prvaDva).toEqual([
      ['50vw', '1.4s', '0.1s'],
      ['0vw', '1.7s', '0.2s'],
    ])
    const boje = [
      'rgb(255, 197, 61)',
      'rgb(232, 84, 47)',
      'rgb(124, 191, 74)',
      'rgb(138, 99, 210)',
      'rgb(74, 168, 216)',
    ]
    expect(k.map((e) => e.style.background)).toEqual(
      Array.from({ length: 26 }, (_, i) => dohvati(boje, i % 5)),
    )
  })

  it('nestaju na 3200 ms', () => {
    const { fx, lt } = postavi(brojac(() => 0.5))
    fx.konfete()
    lt.pomeri(3199)
    expect($$(document, '.konfeta')).toHaveLength(26)
    lt.pomeri(1)
    expect($$(document, '.konfeta')).toHaveLength(0)
  })
})

describe('FX čiste za sobom i ne diraju Math.random', () => {
  it('posle isteka tajmera nema FX čvorova; Math.random nije pozvan', () => {
    const spy = vi.spyOn(Math, 'random')
    const { fx, lt } = postavi(brojac(() => 0.3))
    fx.letiNovcic($(document, '#dugme'), 6)
    fx.plusXp($(document, '#dugme'), 5)
    fx.kapFx($(document, '#p0'))
    fx.konfete()
    lt.okvir()
    lt.okvir()
    lt.pomeri(3200)
    expect($$(document, '.letac, .plusxp, .konfeta, .kapFx')).toEqual([])
    expect(lt.timeoutUredu()).toBe(0)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
    expect(document.body.innerHTML).toBe(SKELET)
  })
})
