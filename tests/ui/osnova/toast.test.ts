// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { TOAST_MS } from '../../../src/config'
import { $ } from '../../../src/ui/dom'
import { napraviToast } from '../../../src/ui/toast'
import { lazniTajmeri, trenutniTajmeri } from './lazno'

const el = () => $(document, '#toast')
const vidljiv = () => el().classList.contains('vidljiv')

beforeEach(() => {
  document.body.innerHTML = '<div id="toast" class="ostalo"></div>'
})

describe('toast (prototip L596–598)', () => {
  it('TOAST_MS je 2300 ms kao u prototipu', () => {
    expect(TOAST_MS).toBe(2300)
  })

  it('odmah upisuje tekst i dodaje klasu vidljiv, ne dirajući druge klase', () => {
    const lt = lazniTajmeri()
    napraviToast({ koren: document, tajmeri: lt.tajmeri })('Zaliveno — raste 25% brže 💧')
    expect(el().textContent).toBe('Zaliveno — raste 25% brže 💧')
    expect(el().className).toBe('ostalo vidljiv')
    expect(lt.kasnjenja).toEqual([TOAST_MS])
  })

  it('sakriva se tačno posle TOAST_MS, samo uklanjanjem klase; tekst ostaje', () => {
    const lt = lazniTajmeri()
    napraviToast({ koren: document, tajmeri: lt.tajmeri })('A')
    lt.pomeri(TOAST_MS - 1)
    expect(vidljiv()).toBe(true)
    lt.pomeri(1)
    expect(vidljiv()).toBe(false)
    expect(el().textContent).toBe('A')
    expect(el().className).toBe('ostalo')
  })

  it('novi toast menja tekst i ponovo pokreće tajmer (A, pa B posle 2000 ms)', () => {
    const lt = lazniTajmeri()
    const toast = napraviToast({ koren: document, tajmeri: lt.tajmeri })
    toast('A')
    lt.pomeri(2000)
    toast('B')
    expect(el().textContent).toBe('B')
    // Tajmer od A (rok 2300) je otkazan: na 2300 od A, B je i dalje vidljiv.
    lt.pomeri(300)
    expect(vidljiv()).toBe(true)
    lt.pomeri(TOAST_MS - 300 - 1)
    expect(vidljiv()).toBe(true)
    lt.pomeri(1)
    expect(vidljiv()).toBe(false)
    expect(el().textContent).toBe('B')
  })

  it('otkazuje tačno prethodni tajmer; prvi poziv nema šta da otkaže', () => {
    const lt = lazniTajmeri()
    const toast = napraviToast({ koren: document, tajmeri: lt.tajmeri })
    toast('A')
    expect(lt.otkazaniTimeout).toEqual([])
    toast('B')
    toast('C')
    expect(lt.otkazaniTimeout).toHaveLength(2)
    expect(lt.timeoutUredu()).toBe(1)
  })

  it('poslednji poziv pobeđuje (više toastova u jednom handleru)', () => {
    const lt = lazniTajmeri()
    const toast = napraviToast({ koren: document, tajmeri: lt.tajmeri })
    toast('Nemaš dovoljno dinara')
    toast('Ostavi bar za seme pšenice 🙂')
    expect(el().textContent).toBe('Ostavi bar za seme pšenice 🙂')
    lt.pomeri(TOAST_MS)
    expect(vidljiv()).toBe(false)
  })

  it('element se traži pri svakom pozivu (skelet montiran posle pravljenja toasta)', () => {
    document.body.innerHTML = ''
    const lt = lazniTajmeri()
    const toast = napraviToast({ koren: document, tajmeri: lt.tajmeri })
    document.body.innerHTML = '<div id="toast"></div>'
    toast('X')
    expect(el().textContent).toBe('X')
  })

  it('sa trenutnim tajmerima (referenca-sim) klasa odmah nestaje, a tekst ostaje za čitanje', () => {
    napraviToast({ koren: document, tajmeri: trenutniTajmeri() })('Već je zaliveno 💧')
    expect(vidljiv()).toBe(false)
    expect(el().textContent).toBe('Već je zaliveno 💧')
  })

  it('instance ne dele stanje (nema modul-nivo tajmera)', () => {
    const drugi = document.implementation.createHTMLDocument('')
    drugi.body.innerHTML = '<div id="toast"></div>'
    const lt1 = lazniTajmeri()
    const lt2 = lazniTajmeri()
    const t1 = napraviToast({ koren: document, tajmeri: lt1.tajmeri })
    const t2 = napraviToast({ koren: drugi, tajmeri: lt2.tajmeri })
    t1('prvi')
    t2('drugi')
    // Prvi poziv druge instance nema prethodni tajmer koji bi otkazao.
    expect(lt2.otkazaniTimeout).toEqual([])
    expect(el().textContent).toBe('prvi')
    expect($(drugi, '#toast').textContent).toBe('drugi')
    lt1.pomeri(TOAST_MS)
    expect(vidljiv()).toBe(false)
    expect($(drugi, '#toast').classList.contains('vidljiv')).toBe(true)
  })
})
