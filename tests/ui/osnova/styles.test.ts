// Node okruženje: test čita fajlove, DOM mu ne treba (a u jsdom/client okruženju Vite prepisuje
// `new URL(…, import.meta.url)` u URL resursa).
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { PROTOTIP_HTML } from '../../helpers/prototip'

const CSS = readFileSync(
  fileURLToPath(new URL('../../../src/ui/styles.css', import.meta.url)),
  'utf8',
)

describe('styles.css = CSS prototipa bajt za bajt (04 §6)', () => {
  it('jednako je linijama 11–258 moja-farma-v3.html (sa završnim LF)', () => {
    const linije = PROTOTIP_HTML.split('\n').slice(10, 258)
    expect(CSS).toBe(linije.join('\n') + '\n')
  })

  it('SHA-256 i veličina iz specifikacije (248 linija, 19 305 bajtova)', () => {
    expect(createHash('sha256').update(CSS, 'utf8').digest('hex')).toBe(
      '56d233f23a8bfa9841b094d9ddda9101176dfa47435b3e20b51e3176ef042c75',
    )
    expect(Buffer.byteLength(CSS, 'utf8')).toBe(19305)
    expect(CSS.split('\n')).toHaveLength(249)
  })

  it('nema Google Fonts linka ni @import-a (font se uvozi iz main.ts: ui/fonts.css)', () => {
    expect(CSS).not.toMatch(/fonts\.googleapis|@import/)
    expect(CSS).toContain("font-family:'Baloo 2',system-ui,sans-serif")
  })

  it('klase koje JS pali/gasi postoje (vidljiv, otvoren, aktivan, ima) i CSS varijable iz šablona', () => {
    for (const s of [
      '#toast.vidljiv',
      '#nivoVeo.otvoren',
      '#veo.otvoren',
      '#list.otvoren',
      '.tab.aktivan',
      'nav button.aktivan',
      'nav button .tacka.ima',
      '--zlato-t:',
      '--mastilo-b:',
    ]) {
      expect(CSS, s).toContain(s)
    }
  })
})
