// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { NOVAC_BROJANJE_MS } from '../../../src/config'
import { $ } from '../../../src/ui/dom'
import { napraviHud } from '../../../src/ui/hud'
import { lazniTajmeri, trenutniTajmeri } from './lazno'

const HUD =
  '<span id="novac">0</span><span id="nivoBr">1</span><div class="xpTraka"><i id="xpTraka"></i></div>'
const novac = (koren: ParentNode = document) => $(koren, '#novac').textContent

beforeEach(() => {
  document.body.innerHTML = HUD
})

function postavi(koren: ParentNode = document) {
  const lt = lazniTajmeri()
  const hud = napraviHud({ koren, sat: lt.sat, tajmeri: lt.tajmeri })
  return { lt, hud }
}

/** Završava tekuću animaciju novca (okvir daleko posle kraja). */
function zavrsi(lt: ReturnType<typeof lazniTajmeri>) {
  lt.okvir(lt.vreme() + 10 * NOVAC_BROJANJE_MS)
}

describe('crtajNovac — rAF brojanje (04 §2.1, §4.2)', () => {
  it('NOVAC_BROJANJE_MS je 350 ms', () => {
    expect(NOVAC_BROJANJE_MS).toBe(350)
  })

  it('ništa se ne piše sinhrono; prvi upis je u prvom rAF okviru', () => {
    const { lt, hud } = postavi()
    hud.crtajNovac(50)
    expect(novac()).toBe('0')
    expect(lt.rafUredu()).toBe(1)
    lt.okvir(lt.vreme())
    expect(novac()).toBe('0')
    zavrsi(lt)
    expect(novac()).toBe('50')
  })

  it('boot broji od 0: na polovini vremena 43,75 → „44"', () => {
    const { lt, hud } = postavi()
    const t0 = lt.vreme()
    hud.crtajNovac(50)
    lt.okvir(t0 + 175)
    expect(novac()).toBe('44')
    expect(hud.prikazanNovac()).toBe(43.75)
  })

  it('zlatni okviri 50 → 1050 (izmereno na prototipu), bez novog rAF-a posle u = 1', () => {
    const { lt, hud } = postavi()
    hud.crtajNovac(50)
    zavrsi(lt)
    const t0 = lt.vreme()
    hud.crtajNovac(1050)
    const okviri: string[] = []
    for (const dt of [0, 35, 87.5, 175, 262.5, 349, 350]) {
      expect(lt.rafUredu()).toBe(1)
      lt.okvir(t0 + dt)
      okviri.push(novac())
    }
    expect(okviri).toEqual(['50', '321', '628', '925', '1.034', '1.050', '1.050'])
    expect(lt.rafUredu()).toBe(0)
    expect(hud.prikazanNovac()).toBe(1050)
  })

  it('novi cilj otkazuje tekući okvir i kreće od PRIKAZANE vrednosti, ne od starog cilja', () => {
    const { lt, hud } = postavi()
    hud.crtajNovac(1050)
    zavrsi(lt)
    const t1 = lt.vreme()
    hud.crtajNovac(2050)
    lt.okvir(t1 + 175)
    expect(novac()).toBe('1.925')
    expect(hud.prikazanNovac()).toBe(1925)
    lt.pomeri(175)
    const otkazaniPre = lt.otkazaniRaf.length
    hud.crtajNovac(50)
    // Tačno jedan okvir otkazan i tačno jedan lanac živ.
    expect(lt.otkazaniRaf.length).toBe(otkazaniPre + 1)
    expect(lt.rafUredu()).toBe(1)
    const t2 = lt.vreme()
    lt.okvir(t2)
    expect(novac()).toBe('1.925')
    lt.okvir(t2 + 400)
    expect(novac()).toBe('50')
    expect(lt.rafUredu()).toBe(0)
  })

  it('smanjenje (reset: animira od starog prikaza naniže do 50)', () => {
    const { lt, hud } = postavi()
    hud.crtajNovac(123456)
    zavrsi(lt)
    expect(novac()).toBe('123.456')
    const t0 = lt.vreme()
    hud.crtajNovac(50)
    lt.okvir(t0 + 175)
    // 123456 + (50 − 123456) · 0,875 = 15 475,75
    expect(novac()).toBe('15.476')
    zavrsi(lt)
    expect(novac()).toBe('50')
  })

  it('B6 ostaje 1:1: okvir sa pečatom PRE t0 (u < 0) nije ograničen odozdo', () => {
    const { lt, hud } = postavi()
    hud.crtajNovac(50)
    zavrsi(lt)
    const t0 = lt.vreme()
    hud.crtajNovac(100050)
    lt.okvir(t0 - 16)
    expect(novac()).toBe('-14.301')
  })

  it('sa trenutnim rAF-om (referenca-sim: pečat +1000 ms) cilj je upisan još u pozivu', () => {
    const hud = napraviHud({
      koren: document,
      sat: { perfNow: () => 0 },
      tajmeri: trenutniTajmeri(),
    })
    hud.crtajNovac(777)
    expect(novac()).toBe('777')
  })

  it('instance ne dele prikazanu vrednost (nema modul-nivo stanja)', () => {
    const drugi = document.implementation.createHTMLDocument('')
    drugi.body.innerHTML = HUD
    const a = postavi(document)
    const b = postavi(drugi)
    a.hud.crtajNovac(1000)
    zavrsi(a.lt)
    b.hud.crtajNovac(50)
    b.lt.okvir(b.lt.vreme())
    expect(novac(drugi)).toBe('0')
    expect(novac(document)).toBe('1.000')
  })
})

describe('crtajNivo (04 §2.2)', () => {
  it('zlatna vrednost iz dodatka A: xp 40 → Nv. 2, traka 17.543859649122805%', () => {
    const { hud } = postavi()
    hud.crtajNivo({ lvl: 2, u: 10, do: 57 })
    expect($(document, '#nivoBr').textContent).toBe('2')
    expect($(document, '#xpTraka').style.width).toBe('17.543859649122805%')
  })

  it('traka je ograničena na 100 % (nivo 20 i dalje „puni" traku)', () => {
    const { hud } = postavi()
    hud.crtajNivo({ lvl: 20, u: 700, do: 500 })
    expect($(document, '#xpTraka').style.width).toBe('100%')
    hud.crtajNivo({ lvl: 1, u: 0, do: 30 })
    expect($(document, '#xpTraka').style.width).toBe('0%')
  })

  it('nivo je sirov broj (Nv. 20, ne fmt)', () => {
    const { hud } = postavi()
    hud.crtajNivo({ lvl: 20, u: 1, do: 2 })
    expect($(document, '#nivoBr').textContent).toBe('20')
    expect($(document, '#xpTraka').style.width).toBe('50%')
  })
})
