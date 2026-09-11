// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { ZAKLJUCAVANJE_TAPA_MS } from '../../../src/config'
import type { ZvukId } from '../../../src/core/dogadjaji'
import { $ } from '../../../src/ui/dom'
import { napraviOverlayRed } from '../../../src/ui/overlay'
import { napraviZakljucavanje } from '../../../src/ui/zakljucavanje'
import { lazniTajmeri } from './lazno'

const SKELET = '<div id="nivoVeo"><div id="nivoKartica"></div></div>'
const kartica = (naslov: string) =>
  `<h3>${naslov}</h3><button class="dugme zlatno" id="nivoOk">OK</button>`

beforeEach(() => {
  document.body.innerHTML = SKELET
})

function postavi(koren: ParentNode = document) {
  const lt = lazniTajmeri()
  const zak = napraviZakljucavanje(lt.sat)
  const log: string[] = []
  const red = napraviOverlayRed({
    koren,
    zvuk: (id: ZvukId) => log.push('zvuk:' + id),
    zakljucavanje: zak,
  })
  const otvoren = () => $(koren, '#nivoVeo').classList.contains('otvoren')
  const naslov = () => $(koren, '#nivoKartica h3').textContent
  /** Tap na OK kao čovek: posle isteka D15 zaključavanja. */
  const ok = () => {
    lt.pomeri(ZAKLJUCAVANJE_TAPA_MS)
    $(koren, '#nivoOk').click()
  }
  return { lt, zak, log, red, otvoren, naslov, ok }
}

describe('overlay red (prototip L686–699)', () => {
  it('prva kartica se prikazuje odmah: veo otvoren, innerHTML tačno zadati HTML', () => {
    const { red, otvoren } = postavi()
    red.uRed(kartica('Nivo 2!'), null)
    expect(otvoren()).toBe(true)
    expect($(document, '#nivoKartica').innerHTML).toBe(kartica('Nivo 2!'))
    expect(red.uRedu()).toBe(0)
  })

  it('FIFO: dok je veo otvoren nove kartice samo čekaju, pa idu redom', () => {
    const { red, naslov, ok, otvoren } = postavi()
    red.uRed(kartica('A'), null)
    red.uRed(kartica('B'), null)
    red.uRed(kartica('C'), null)
    expect(naslov()).toBe('A')
    expect(red.uRedu()).toBe(2)
    ok()
    expect(naslov()).toBe('B')
    ok()
    expect(naslov()).toBe('C')
    expect(otvoren()).toBe(true)
    ok()
    expect(otvoren()).toBe(false)
  })

  it('OK: zvuk tap → callback odbačene kartice (dok je ona još prikazana) → sledeća kartica', () => {
    const { red, naslov, ok, log } = postavi()
    red.uRed(kartica('A'), () => log.push('cb:A dok je prikazano ' + naslov()))
    red.uRed(kartica('B'), () => log.push('cb:B'))
    ok()
    expect(log).toEqual(['zvuk:tap', 'cb:A dok je prikazano A'])
    expect(naslov()).toBe('B')
    ok()
    expect(log).toEqual(['zvuk:tap', 'cb:A dok je prikazano A', 'zvuk:tap', 'cb:B'])
  })

  it('callback koji dodaje karticu (level-up → crtajSve) staje na KRAJ reda', () => {
    const { red, naslov, ok } = postavi()
    red.uRed(kartica('A'), () => red.uRed(kartica('C'), null))
    red.uRed(kartica('B'), null)
    ok()
    expect(naslov()).toBe('B')
    ok()
    expect(naslov()).toBe('C')
  })

  it('null callback je u redu; posle poslednje kartice veo se zatvara, a stari HTML ostaje', () => {
    const { red, ok, otvoren, log } = postavi()
    red.uRed(kartica('Dobro došao nazad!'), null)
    ok()
    expect(log).toEqual(['zvuk:tap'])
    expect(otvoren()).toBe(false)
    expect($(document, '#nivoKartica').innerHTML).toBe(kartica('Dobro došao nazad!'))
  })

  it('#nivoKartica se ne pravi ponovo između kartica (CSS pop samo pri otvaranju)', () => {
    const { red, ok } = postavi()
    const pre = $(document, '#nivoKartica')
    red.uRed(kartica('A'), null)
    red.uRed(kartica('B'), null)
    ok()
    expect($(document, '#nivoKartica')).toBe(pre)
    expect(pre.innerHTML).toBe(kartica('B'))
  })

  it('pozadina nema handler: klik na #nivoVeo ne zatvara karticu', () => {
    const { red, lt, otvoren, naslov } = postavi()
    red.uRed(kartica('A'), null)
    lt.pomeri(ZAKLJUCAVANJE_TAPA_MS)
    $(document, '#nivoVeo').click()
    expect(otvoren()).toBe(true)
    expect(naslov()).toBe('A')
  })

  it('kartica bez #nivoOk ostaje otvorena i blokira red (prototip: if(ok))', () => {
    const { red, otvoren } = postavi()
    red.uRed('<h3>bez dugmeta</h3>', null)
    red.uRed(kartica('B'), null)
    expect(otvoren()).toBe(true)
    expect(red.uRedu()).toBe(1)
    red.sledeciOverlay()
    expect($(document, '#nivoKartica h3').textContent).toBe('B')
  })

  it('skok preko više nivoa: svaka kartica redom, tap pre svakog callback-a', () => {
    const { red, ok, log, otvoren } = postavi()
    for (const l of [2, 3, 4, 5, 6]) red.uRed(kartica(`Nivo ${l}!`), () => log.push(`cb${l}`))
    while (otvoren()) ok()
    expect(log).toEqual([
      'zvuk:tap',
      'cb2',
      'zvuk:tap',
      'cb3',
      'zvuk:tap',
      'cb4',
      'zvuk:tap',
      'cb5',
      'zvuk:tap',
      'cb6',
    ])
  })

  it('instance ne dele red (nema modul-nivo stanja)', () => {
    const drugi = document.implementation.createHTMLDocument('')
    drugi.body.innerHTML = SKELET
    const a = postavi(document)
    const b = postavi(drugi)
    a.red.uRed(kartica('A1'), null)
    a.red.uRed(kartica('A2'), null)
    b.red.uRed(kartica('B1'), null)
    expect(b.naslov()).toBe('B1')
    expect(b.red.uRedu()).toBe(0)
    expect(a.red.uRedu()).toBe(1)
  })
})

describe('D15 — nova kartica ignoriše #nivoOk ZAKLJUCAVANJE_TAPA_MS', () => {
  it('ZAKLJUCAVANJE_TAPA_MS je 300 ms', () => {
    expect(ZAKLJUCAVANJE_TAPA_MS).toBe(300)
  })

  it('tap odmah i na 299 ms se ignoriše (bez zvuka i callback-a); na 300 ms radi', () => {
    const { red, lt, log, naslov } = postavi()
    red.uRed(kartica('A'), () => log.push('cb:A'))
    red.uRed(kartica('B'), null)
    $(document, '#nivoOk').click()
    lt.pomeri(ZAKLJUCAVANJE_TAPA_MS - 1)
    $(document, '#nivoOk').click()
    expect(log).toEqual([])
    expect(naslov()).toBe('A')
    lt.pomeri(1)
    $(document, '#nivoOk').click()
    expect(log).toEqual(['zvuk:tap', 'cb:A'])
    expect(naslov()).toBe('B')
  })

  it('i SLEDEĆA kartica je zaključana od trenutka svog prikaza (brz drugi tap je ne zatvara)', () => {
    const { red, lt, naslov } = postavi()
    red.uRed(kartica('Nivo 7!'), null)
    red.uRed(kartica('Nivo 8!'), null)
    lt.pomeri(ZAKLJUCAVANJE_TAPA_MS)
    $(document, '#nivoOk').click()
    expect(naslov()).toBe('Nivo 8!')
    lt.pomeri(ZAKLJUCAVANJE_TAPA_MS - 1)
    $(document, '#nivoOk').click()
    expect(naslov()).toBe('Nivo 8!')
    expect($(document, '#nivoVeo').classList.contains('otvoren')).toBe(true)
  })

  it('kartica koja samo čeka u redu ne produžava zaključavanje prikazane', () => {
    const { red, lt, naslov } = postavi()
    red.uRed(kartica('A'), null)
    lt.pomeri(ZAKLJUCAVANJE_TAPA_MS - 100)
    red.uRed(kartica('B'), null)
    lt.pomeri(100)
    $(document, '#nivoOk').click()
    expect(naslov()).toBe('B')
  })

  it('zaključava samo #nivoOk — ostale oblasti ostaju slobodne', () => {
    const { red, zak } = postavi()
    red.uRed(kartica('A'), null)
    expect(zak.zakljucano('#nivoOk')).toBe(true)
    for (const o of ['#tezga', '#narudzbeKuca', '#veo', '#njive'] as const) {
      expect(zak.zakljucano(o)).toBe(false)
    }
  })
})
