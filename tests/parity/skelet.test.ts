/*
 * Skelet = prototip. `montirajSkelet` mora da da isti `<body>` kao prototip (L262–335) — i u izvornim
 * bajtovima i posle parsiranja — bez `<script>` i sa jedinom odobrenom razlikom: D17 podnaslov.
 * Poređenje je TAČNO (bez normalizacije razmaka).
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'
import { describe, expect, it } from 'vitest'
import { montirajSkelet, skeletHtml } from '../../src/ui/skelet'
import { PROTOTIP_HTML } from '../helpers/prototip'

const VERZIJA = (
  JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
    version: string
  }
).version
const PROTO_PODNASLOV = '<small>prototip v0.3</small>'
const NAS_PODNASLOV = `<small>prototip v${VERZIJA}</small>`

/** Izvorni bajtovi prototipa između `<body>` i `<script>`. */
function izvorTela(): string {
  const a = PROTOTIP_HTML.indexOf('<body>')
  const b = PROTOTIP_HTML.indexOf('<script>')
  expect(a).toBeGreaterThan(0)
  expect(b).toBeGreaterThan(a)
  return PROTOTIP_HTML.slice(a + '<body>'.length, b)
}

function prazanDokument(): Document {
  return new JSDOM('<!DOCTYPE html><html lang="sr"><head></head><body></body></html>').window
    .document
}

const sha = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex')

describe('skelet = <body> prototipa', () => {
  it('izvor: skeletHtml() je bajt-identičan prototipu između <body> i <script>, osim D17', () => {
    const proto = izvorTela()
    expect(proto.split(PROTO_PODNASLOV).length - 1).toBe(1)
    expect(skeletHtml()).toBe(proto.replace(PROTO_PODNASLOV, NAS_PODNASLOV))
  })

  it('izvor: sa vraćenim „v0.3" linije L262–335 imaju sha256 iz 04 §6', () => {
    const vraceno = skeletHtml().replace(NAS_PODNASLOV, PROTO_PODNASLOV)
    // skeletHtml = '\n' + L262…L335 (svaka sa \n) + '\n' (prazna L336)
    expect(vraceno.startsWith('\n<div id="app">\n')).toBe(true)
    expect(vraceno.endsWith('<div id="nivoVeo"><div id="nivoKartica"></div></div>\n\n')).toBe(true)
    expect(sha(vraceno.slice(1, -1))).toBe(
      '10644ab0ed13a359872824913646b5284b15010e4238d3de8ff695b8ee156bca',
    )
  })

  it('DOM: body.innerHTML posle montirajSkelet === body.innerHTML prototipa bez <script> (D17)', () => {
    const protoDoc = new JSDOM(PROTOTIP_HTML).window.document // skripte se NE izvršavaju
    const skripte = protoDoc.body.querySelectorAll('script')
    expect(skripte).toHaveLength(1)
    expect(protoDoc.body.lastElementChild?.tagName).toBe('SCRIPT')
    const protoTelo = protoDoc.body.innerHTML
    const i = protoTelo.indexOf('<script>')
    const posle = protoTelo.slice(protoTelo.indexOf('</script>') + '</script>'.length)
    // Posle skripte u prototipu su samo prelomi redova (L1218–1220).
    expect(posle).toMatch(/^\s*$/)

    const d = prazanDokument()
    montirajSkelet(d)
    expect(d.body.innerHTML).toBe(protoTelo.slice(0, i).replace(PROTO_PODNASLOV, NAS_PODNASLOV))
  })

  it('DOM: ista deca body-ja istim redom (#app, #veo, #list, #toast, #nivoVeo)', () => {
    const protoDoc = new JSDOM(PROTOTIP_HTML).window.document
    const d = prazanDokument()
    montirajSkelet(d)
    const deca = (doc: Document): string[] =>
      [...doc.body.children].filter((e) => e.tagName !== 'SCRIPT').map((e) => e.id)
    expect(deca(d)).toEqual(deca(protoDoc))
    expect(deca(d)).toEqual(['app', 'veo', 'list', 'toast', 'nivoVeo'])
  })

  it('D17: jedina razlika u tekstu je podnaslov na tabli', () => {
    const protoDoc = new JSDOM(PROTOTIP_HTML).window.document
    // Ukloni <script> i prelome redova POSLE njega (L1218–1220); prelomi ispred ostaju (L336).
    const skripta = protoDoc.querySelector('script')
    const posle = skripta?.nextSibling
    expect(posle?.nodeType).toBe(3)
    expect(posle?.textContent).toMatch(/^\s+$/)
    posle?.remove()
    skripta?.remove()
    const d = prazanDokument()
    montirajSkelet(d)
    expect(d.querySelector('.tabla small')?.textContent).toBe(`prototip v${VERZIJA}`)
    expect(protoDoc.querySelector('.tabla small')?.textContent).toBe('prototip v0.3')
    const small = d.querySelector('.tabla small')
    if (small) small.textContent = 'prototip v0.3'
    expect(d.body.textContent).toBe(protoDoc.body.textContent)
  })
})
