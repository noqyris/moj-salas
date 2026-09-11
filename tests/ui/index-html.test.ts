/*
 * index.html (ugovor §6): samo `<head>` prototipa bez Google Fonts-a (fontovi su self-hostovani,
 * DECISIONS) i jedan module skript. Naslov stranice mora biti isti kao `t.naslov` i kao u prototipu,
 * jer je index.html jedino mesto van src/i18n gde UI tekst sme da postoji (pre nego što JS krene).
 */
import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'
import { describe, expect, it } from 'vitest'
import { t } from '../../src/i18n'
import { PROTOTIP_HTML } from '../helpers/prototip'

const INDEX = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
const d = new JSDOM(INDEX).window.document
const proto = new JSDOM(PROTOTIP_HTML).window.document

describe('index.html', () => {
  it('jezik, charset, viewport i naslov kao prototip; naslov iz i18n', () => {
    expect(d.documentElement.lang).toBe(proto.documentElement.lang)
    expect(d.characterSet).toBe('UTF-8')
    const vp = (x: Document) => x.querySelector('meta[name="viewport"]')?.getAttribute('content')
    expect(vp(d)).toBe(vp(proto))
    expect(d.title).toBe(t.naslov)
    expect(d.title).toBe(proto.title)
  })

  it('jedan module skript ka src/main.ts, bez spoljnih resursa i bez sadržaja body-ja', () => {
    const skripte = [...d.querySelectorAll('script')]
    expect(skripte.map((s) => [s.type, s.getAttribute('src')])).toEqual([
      ['module', './src/main.ts'],
    ])
    expect(d.querySelectorAll('link')).toHaveLength(0)
    expect(INDEX).not.toMatch(/https?:\/\//)
    expect([...d.body.children].map((e) => e.tagName)).toEqual(['SCRIPT'])
  })
})
