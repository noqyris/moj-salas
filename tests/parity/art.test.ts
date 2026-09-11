/*
 * Art = prototip, poređeno sa ŽIVIM prototipom (moja-farma-v3.html u jsdom-u): svaki ART ključ i
 * gradivni blok preko `p.ev(...)`, statički SVG-ovi preko DOM-a prototipa, a pomoćnici (ikonica,
 * biljka, ikonice level-up pločica) preko onoga što prototip zaista nacrta.
 */
import { JSDOM } from 'jsdom'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  ART,
  AMBAR,
  DRVO1,
  DRVO2,
  KLICA,
  KOKA_G,
  KRAVA_G,
  NAV_IKONE,
  NOVCIC_PILULA,
  SEN,
  SV,
  biljka,
  grozd,
  ikonica,
  ikonicaOtkljucavanja,
  klas,
  type ArtKljuc,
} from '../../src/art'
import { KULTURE, REDOSLED, SVI_KLJUCEVI } from '../../src/config'
import type { Otkljucavanje } from '../../src/core/dogadjaji'
import { T0 } from '../helpers'
import { PROTOTIP_HTML, ucitajPrototip, type Prototip } from '../helpers/prototip'

let p: Prototip

beforeAll(async () => {
  p = await ucitajPrototip({ t0: T0 })
})

/** Markap kako ga serijalizuje jsdom (parsiran u dokumentu prototipa) — isto što bi prototip nacrtao. */
function kaoDom(html: string): string {
  const d = p.d.createElement('div')
  d.innerHTML = html
  return d.innerHTML
}

describe('ART i gradivni blokovi = prototip (p.ev)', () => {
  it('isti ključevi, istim redom', () => {
    expect(Object.keys(ART)).toEqual(p.ev<string[]>('Object.keys(ART)'))
  })

  it.each(Object.keys(ART) as ArtKljuc[])('ART.%s', (k) => {
    expect(ART[k]).toBe(p.ev<string>(`ART[${JSON.stringify(k)}]`))
  })

  it('SV, SEN, KLICA, KOKA_G, KRAVA_G', () => {
    expect(SV).toBe(p.ev('SV'))
    expect(SEN).toBe(p.ev('SEN'))
    expect(KLICA).toBe(p.ev('KLICA'))
    expect(KOKA_G).toBe(p.ev('KOKA_G'))
    expect(KRAVA_G).toBe(p.ev('KRAVA_G'))
  })

  it('klas(x, y) i grozd(x, y) na mreži argumenata (uključujući negativne)', () => {
    for (let x = -12; x <= 70; x += 7) {
      for (let y = -9; y <= 60; y += 11) {
        expect(klas(x, y)).toBe(p.ev(`klas(${x},${y})`))
        expect(grozd(x, y)).toBe(p.ev(`grozd(${x},${y})`))
      }
    }
  })
})

describe('pomoćnici = prototip', () => {
  it('ikonica(k) za svaki artikal === prototipov ikonica(k)', () => {
    for (const k of SVI_KLJUCEVI) expect(ikonica(k), k).toBe(p.ev(`ikonica('${k}')`))
  })

  it('biljka(c, faza) === sprajt koji prototip crta na parceli (sve kulture, sve faze, i zrela)', () => {
    // Udeo rasta → faza po prototipu: < .35 → 1, < .8 → 2, inače 3; ≥ 1 je zrela (crta fazu 3).
    const slucajevi: readonly [number, 1 | 2 | 3][] = [
      [0.01, 1],
      [0.34, 1],
      [0.36, 2],
      [0.79, 2],
      [0.81, 3],
      [0.99, 3],
      [1.5, 3],
    ]
    for (const c of REDOSLED) {
      for (const [udeo, faza] of slucajevi) {
        const t = Math.round(udeo * KULTURE[c].vreme * 1000)
        p.ev(`S.parcele=[{c:'${c}',t:Date.now()-${t},z:true}]; crtajNjive();`)
        const el = p.q('.parcela[data-i="0"] .biljka')
        expect(el, `${c} ${udeo}`).not.toBeNull()
        expect(el?.innerHTML, `${c} udeo ${udeo}`).toBe(kaoDom(biljka(c, faza)))
      }
    }
  })

  it('ikonicaOtkljucavanja === ikonice pločica u prototipovoj level-up kartici', () => {
    // Otključavanja po nivou (05 §3.8, 04 §2.10), redom kako ih prototip slaže.
    const poNivou: Record<number, Otkljucavanje[]> = {
      2: [
        { vrsta: 'kultura', id: 'paprika' },
        { vrsta: 'masina', id: 'mlin' },
      ],
      3: [
        { vrsta: 'kultura', id: 'bundeva' },
        { vrsta: 'masina', id: 'kazan' },
        { vrsta: 'zivotinja', id: 'kokosinjac' },
      ],
      4: [{ vrsta: 'kultura', id: 'grozdje' }],
      5: [{ vrsta: 'zivotinja', id: 'stala' }],
      6: [{ vrsta: 'aukcija' }],
      7: [],
    }
    for (const [nivo, lista] of Object.entries(poNivou)) {
      p.ev(`prikaziNivo(${nivo})`)
      const ikonice = p.qa('#nivoKartica .kockica .slicica').map((e) => e.innerHTML)
      expect(ikonice, `nivo ${nivo}`).toEqual(lista.map((o) => kaoDom(ikonicaOtkljucavanja(o))))
      p.zatvoriOverlaye()
    }
    expect(p.greske).toEqual([])
  })
})

describe('statički SVG iz HTML-a = prototip', () => {
  // Statički DOM prototipa pre pokretanja skripte.
  const staticki = new JSDOM(PROTOTIP_HTML).window.document
  const uStatickom = (html: string): string => {
    const d = staticki.createElement('div')
    d.innerHTML = html
    return d.innerHTML
  }
  const slucajevi: readonly [string, string, string][] = [
    ['DRVO2', DRVO2, 'svg.ukras.drvo2'],
    ['DRVO1', DRVO1, 'svg.ukras.drvo1'],
    ['AMBAR', AMBAR, 'svg.ukras.ambar'],
    ['NOVCIC_PILULA', NOVCIC_PILULA, '#novacPilula > svg'],
    ['NAV_IKONE.farma', NAV_IKONE.farma, 'nav [data-tab="farma"] .ikona > svg'],
    ['NAV_IKONE.narudzbe', NAV_IKONE.narudzbe, 'nav [data-tab="narudzbe"] .ikona > svg'],
    ['NAV_IKONE.pijaca', NAV_IKONE.pijaca, 'nav [data-tab="pijaca"] .ikona > svg'],
    ['NAV_IKONE.radnja', NAV_IKONE.radnja, 'nav [data-tab="radnja"] .ikona > svg'],
  ]

  it.each(slucajevi)('%s: bajt-identičan izvoru, tačno jednom', (_ime, s) => {
    expect(PROTOTIP_HTML.split(s).length - 1).toBe(1)
  })

  it.each(slucajevi)(
    '%s: isti DOM kao element u statičkom DOM-u prototipa',
    (_ime, s, selektor) => {
      const el = staticki.querySelector(selektor)
      expect(el).not.toBeNull()
      expect(uStatickom(s)).toBe(el?.outerHTML)
    },
  )

  it('isti DOM i u živom prototipu posle boot-a (boot ne dira statički SVG)', () => {
    for (const [ime, s, selektor] of slucajevi) {
      expect(kaoDom(s), ime).toBe(p.q(selektor)?.outerHTML)
    }
  })
})
