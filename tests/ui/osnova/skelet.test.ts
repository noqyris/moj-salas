// @vitest-environment jsdom
/*
 * Posle montirajSkelet postoji svaki statički element na koji se oslanjaju referenca-sim selektori
 * (04 §3), prototipovi `$('#…')` pozivi i rendereri — sa početnim stanjem kao u prototipu pre boot-a.
 * Dinamički elementi (.parcela, [data-seme], #nivoOk, #uberiSve…) nisu deo skeleta; ovde se proverava
 * da postoje njihovi kontejneri.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it } from 'vitest'
import { NAV_IKONE } from '../../../src/art'
import { t } from '../../../src/i18n'
import { POCETNI_TAB, TABOVI, TACKA_ID, montirajSkelet } from '../../../src/ui/skelet'

const $ = (s: string): HTMLElement | null => document.querySelector<HTMLElement>(s)
const $$ = (s: string): HTMLElement[] => [...document.querySelectorAll<HTMLElement>(s)]

beforeEach(() => {
  document.body.innerHTML = ''
  montirajSkelet(document)
})

describe('selektori iz referenca-sim (04 §3) koji pogađaju statički DOM', () => {
  it.each([
    '#novac',
    '#toast',
    '#nivoVeo',
    '#veo',
    '#list',
    '#nivoBr',
    '#scenaKoka',
    '#scenaKrava',
    '#statKuca',
    'nav',
    'nav [data-tab]',
    'nav [data-tab="farma"]',
    'nav [data-tab="narudzbe"]',
    'nav [data-tab="pijaca"]',
    'nav [data-tab="radnja"]',
  ])('%s postoji', (selektor) => {
    expect($(selektor)).not.toBeNull()
  })

  it('tačno 4 dugmeta u navigaciji, redom farma, narudžbine, pijaca, radnja', () => {
    expect($$('nav [data-tab]').map((b) => b.dataset.tab)).toEqual([...TABOVI])
    expect($$('nav [data-tab]').every((b) => b.tagName === 'BUTTON')).toBe(true)
  })

  it('kontejneri dinamičkih selektora postoje i prazni su', () => {
    // .parcela → #njive; #uberiSve → #uberiSveKuca; [data-masina]/[data-kuvaj]/[data-pokupi] →
    // #zgradeKuca; [data-isporuci]/[data-odbij] → #narudzbeKuca; [data-prodaj] → #tezga;
    // [data-kupi] → #radnjaKuca; .seme/[data-seme] → #semena; #nivoOk → #nivoKartica.
    for (const id of [
      'njive',
      'uberiSveKuca',
      'zgradeKuca',
      'narudzbeKuca',
      'tezga',
      'radnjaKuca',
      'statKuca',
      'semena',
      'nivoKartica',
      'scenaKoka',
      'scenaKrava',
      'leptir1',
      'leptir2',
    ]) {
      const el = document.getElementById(id)
      expect(el, id).not.toBeNull()
      expect(el?.innerHTML, id).toBe('')
    }
    expect($('#nivoVeo > #nivoKartica')).not.toBeNull()
    expect($('#list > #semena')).not.toBeNull()
    expect($('#njive')?.classList.contains('njive')).toBe(true)
  })

  it('nijedan dinamički element još ne postoji', () => {
    for (const s of ['.parcela', '[data-seme]', '#nivoOk', '#uberiSve', '[data-isporuci]']) {
      expect($(s), s).toBeNull()
    }
  })
})

describe('svi prototipovi $("#…") pozivi nalaze element (osim dinamičkih)', () => {
  // U jsdom okruženju globalni URL je jsdom-ov, pa putanju gradimo preko node:path.
  const putanja = resolve(dirname(fileURLToPath(import.meta.url)), '../../../moja-farma-v3.html')
  const izvor = readFileSync(putanja, 'utf8')
  const skripta = izvor.slice(izvor.indexOf('<script>'))
  const ids = [...new Set([...skripta.matchAll(/\$\('#([A-Za-z0-9-]+)'\)/g)].map((m) => m[1]))]
  const DINAMICKI = new Set(['uberiSve', 'nivoOk'])

  it('lista je potpuna (kontrola ekstrakcije)', () => {
    expect([...ids].sort()).toEqual([
      'leptir1',
      'leptir2',
      'list',
      'narudzbeKuca',
      'nivoBr',
      'nivoKartica',
      'nivoOk',
      'nivoVeo',
      'njive',
      'novac',
      'novacPilula',
      'radnjaKuca',
      'resetDugme',
      'scenaKoka',
      'scenaKrava',
      'semena',
      'statKuca',
      'tackaFarma',
      'tackaNar',
      'tackaPij',
      'tackaRad',
      'tezga',
      'toast',
      'uberiSve',
      'uberiSveKuca',
      'veo',
      'xpTraka',
      'zgradeKuca',
      'zvukDugme',
    ])
  })

  it.each(ids.filter((id): id is string => id !== undefined && !DINAMICKI.has(id)))('#%s', (id) => {
    expect(document.getElementById(id)).not.toBeNull()
  })

  it('#tab-<id> sekcija za svaki tab (prototip: $("#tab-"+b.dataset.tab))', () => {
    for (const id of TABOVI) {
      const s = document.getElementById(`tab-${id}`)
      expect(s?.tagName, id).toBe('SECTION')
      expect(s?.classList.contains('tab'), id).toBe(true)
    }
    expect($$('.tab')).toHaveLength(4)
  })
})

describe('početno stanje (kao prototip pre boot-a)', () => {
  it('aktivan je samo tab farma, i u navigaciji i u sekcijama', () => {
    expect($$('.tab.aktivan').map((e) => e.id)).toEqual([`tab-${POCETNI_TAB}`])
    expect($$('nav [data-tab].aktivan').map((e) => e.dataset.tab)).toEqual([POCETNI_TAB])
  })

  it('#novac „0", #nivoBr „1", XP traka bez širine, toast prazan', () => {
    expect($('#novac')?.textContent).toBe('0')
    expect($('#nivoBr')?.textContent).toBe('1')
    expect($('#xpTraka')?.tagName).toBe('I')
    expect($('#xpTraka')?.getAttribute('style')).toBeNull()
    expect($('.xpTraka > #xpTraka')).not.toBeNull()
    expect($('#toast')?.textContent).toBe('')
  })

  it('list, veo i overlay su zatvoreni; nema klase vidljiv na toastu', () => {
    expect($('#list.otvoren')).toBeNull()
    expect($('#veo.otvoren')).toBeNull()
    expect($('#nivoVeo.otvoren')).toBeNull()
    expect($('#toast.vidljiv')).toBeNull()
  })

  it('životinje u sceni bez inline stila (CSS ih krije dok nisu kupljene)', () => {
    expect($('#scenaKoka')?.getAttribute('style')).toBeNull()
    expect($('#scenaKrava')?.getAttribute('style')).toBeNull()
    expect($('#scenaKoka')?.className).toBe('scenaKoka')
    expect($('#scenaKrava')?.className).toBe('scenaKrava')
    expect($('#leptir1')?.className).toBe('leptir')
    expect($('#leptir2')?.className).toBe('leptir l2')
  })

  it('dugmad podešavanja su pravi <button> (disabled/klik rade), tekstovi iz i18n', () => {
    expect($('#zvukDugme')?.tagName).toBe('BUTTON')
    expect($('#resetDugme')?.tagName).toBe('BUTTON')
    expect($('#zvukDugme')?.textContent).toBe(t.podesavanja.zvuk(false))
    expect($('#resetDugme')?.textContent).toBe(t.podesavanja.reset)
  })

  it('novčanik: SVG novčić, #novac, pa NBSP i „din"; cilj letećih novčića', () => {
    const pilula = $('#novacPilula')
    expect(pilula?.firstElementChild?.tagName.toLowerCase()).toBe('svg')
    expect(pilula?.textContent).toBe('0\u00a0' + t.hud.valuta)
  })

  it('#tezga i #statKuca su .kartica sa margin-top:0', () => {
    for (const id of ['tezga', 'statKuca']) {
      const el = document.getElementById(id)
      expect(el?.classList.contains('kartica'), id).toBe(true)
      expect(el?.getAttribute('style'), id).toBe('margin-top:0')
    }
  })

  it('crvene tačke: span.tacka sa ID-jem u svakom dugmetu, bez klase ima', () => {
    for (const id of TABOVI) {
      const tacka = $(`nav [data-tab="${id}"] > span.tacka`)
      expect(tacka?.id, id).toBe(TACKA_ID[id])
      expect(tacka?.classList.contains('ima'), id).toBe(false)
      expect($(`nav [data-tab="${id}"] > .ikona > svg`), id).not.toBeNull()
    }
    expect(Object.keys(NAV_IKONE)).toEqual([...TABOVI])
  })

  it('nav je unutar #app; deca body-ja: #app, #veo, #list, #toast, #nivoVeo', () => {
    expect($('#app nav .unutra')).not.toBeNull()
    expect([...document.body.children].map((e) => e.id)).toEqual([
      'app',
      'veo',
      'list',
      'toast',
      'nivoVeo',
    ])
  })
})

describe('montirajSkelet', () => {
  it('tačno ovi ID-jevi, redom kao u prototipu, svaki jednom', () => {
    expect($$('[id]').map((e) => e.id)).toEqual([
      'app',
      'scena',
      'scenaKoka',
      'scenaKrava',
      'leptir1',
      'leptir2',
      'hud',
      'hudDesno',
      'novacPilula',
      'novac',
      'nivoPilula',
      'nivoBr',
      'xpTraka',
      'tab-farma',
      'uberiSveKuca',
      'njive',
      'zgradeKuca',
      'tab-narudzbe',
      'narudzbeKuca',
      'tab-pijaca',
      'tezga',
      'tab-radnja',
      'radnjaKuca',
      'statKuca',
      'zvukDugme',
      'resetDugme',
      'tackaFarma',
      'tackaNar',
      'tackaPij',
      'tackaRad',
      'veo',
      'list',
      'semena',
      'toast',
      'nivoVeo',
      'nivoKartica',
    ])
  })

  it('zamenjuje zatečeni sadržaj i idempotentan je', () => {
    const prvi = document.body.innerHTML
    document.body.innerHTML = '<div id="novac">stari</div><script>1</script>'
    montirajSkelet(document)
    expect(document.body.innerHTML).toBe(prvi)
    montirajSkelet(document)
    expect(document.body.innerHTML).toBe(prvi)
    expect($$('#novac')).toHaveLength(1)
  })
})
