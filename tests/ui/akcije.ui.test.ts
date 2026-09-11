// @vitest-environment jsdom
/*
 * Akcije kroz UI (04 §4.1, 03 §3.17): zvuk po `mute` u trenutku puštanja, reset (D6 + UI stanje),
 * D15 oblasti tapova, D1/D2 kroz DOM, D14 ponovno građenje lista semena, raspored crtanja.
 */
import { describe, expect, it } from 'vitest'
import {
  KLJUC_SEJVA,
  NOVAC_ZVUK_ODLAGANJE_MS,
  UBERI_CRTANJE_ODLAGANJE_MS,
  ZAKLJUCAVANJE_TAPA_MS,
} from '../../src/config'
import { DAN_T0, MAG0, T0, narudzba, stanje } from '../helpers'
import { mountApp, type Montirana } from '../helpers/mountApp'

function posadi(h: Montirana, i: number, k = 'psenica'): void {
  h.klik(`.parcela[data-i="${i}"]`)
  h.klik(`[data-seme="${k}"]`)
}

describe('zvuk i vibracija', () => {
  it('zvuci i vibracije idu redom događaja; „tap" pri uključivanju zvuka tek posle prebacivanja', async () => {
    const h = await mountApp()
    posadi(h, 0)
    expect(h.zvuci).toEqual(['tap', 'sadnja'])
    expect(h.vibracije).toEqual([12])
    h.klik('#zvukDugme')
    expect(h.q('#zvukDugme')?.textContent).toBe('Zvuk: isključen')
    expect(h.stanje().mute).toBe(true)
    h.klik('.parcela[data-i="1"]') // tap dok je zvuk isključen: ništa
    expect(h.zvuci).toEqual(['tap', 'sadnja'])
    expect(h.vibracije).toEqual([12]) // vibracija ne zavisi od zvuka, ali tap je nema
    h.klik('#zvukDugme')
    expect(h.q('#zvukDugme')?.textContent).toBe('Zvuk: uključen')
    expect(h.zvuci).toEqual(['tap', 'sadnja', 'tap'])
  })

  it('odloženi zvuk novca proverava `mute` kad se PUŠTA, ne kad se zakazuje', async () => {
    const h = await mountApp({
      tajmeri: 'red',
      sejv: stanje({ mute: false, mag: { ...MAG0, psenica: 3 } }),
    })
    h.klik('nav [data-tab="pijaca"]')
    h.klik('[data-prodaj="psenica"]')
    expect(h.qa('body > .letac')).toHaveLength(3)
    h.pauza(ZAKLJUCAVANJE_TAPA_MS)
    h.klik('#zvukDugme') // isključi pre nego što prođe 480 ms
    h.pauza(NOVAC_ZVUK_ODLAGANJE_MS)
    expect(h.zvuci).toEqual(['tap'])
  })
})

describe('reset (ugovor §6, D6)', () => {
  it('potvrda → nova igra koja zadržava zvuk i današnji poklon; list zatvoren, izabrana = -1', async () => {
    const h = await mountApp({
      tajmeri: 'red',
      sejv: stanje({
        novac: 5000,
        xp: 500,
        mute: true,
        poklonDan: DAN_T0,
        mag: { ...MAG0, psenica: 7 },
      }),
    })
    h.klik('nav [data-tab="radnja"]')
    h.klik('.parcela[data-i="0"]') // otvori list za parcelu 0 (izabrana = 0)
    expect(h.q('#list.otvoren')).not.toBeNull()
    const upisaPre = h.skladiste?.upisi.length ?? 0
    h.klik('#resetDugme')
    await h.mikro()
    expect(h.potvrde).toEqual(['Sigurno? Sav napredak se briše.'])
    const s = h.stanje()
    expect(s).toMatchObject({ novac: 50, xp: 0, sadio: false, mute: true, poklonDan: DAN_T0 })
    expect(s.narudzbe.map((o) => o.id)).toEqual([1, 2])
    expect(h.q('#list.otvoren')).toBeNull()
    expect(h.q('#toast')?.textContent).toBe('Nova igra. Srećno! 🌱')
    // Upis je ODMAH (ne čeka debounce) i već sadrži novu igru.
    expect(h.skladiste?.upisi.length).toBe(upisaPre + 1)
    expect(h.sacuvano()).toMatchObject({ novac: 50, xp: 0, mute: true, poklonDan: DAN_T0 })
    // crtajSve: hint se vratio, tab ostaje Radnja, natpis zvuka prati sačuvani mute.
    expect(h.q('.parcela[data-i="0"] .hint')).not.toBeNull()
    expect(h.q('#tab-radnja.aktivan')).not.toBeNull()
    expect(h.q('#zvukDugme')?.textContent).toBe('Zvuk: isključen')
    // Zastarelo dugme semena iz starog lista više ne sadi (izabrana je -1).
    h.klik('[data-seme="psenica"]')
    expect(h.stanje().parcele[0]?.c).toBeNull()
    expect(h.stanje().novac).toBe(50)
  })

  it('odbijena potvrda: ništa se ne menja i ništa se ne piše', async () => {
    const h = await mountApp({ potvrda: false, sejv: stanje({ novac: 5000 }) })
    const upisaPre = h.skladiste?.upisi.length
    h.klik('#resetDugme')
    await h.mikro()
    expect(h.stanje().novac).toBe(5000)
    expect(h.skladiste?.upisi.length).toBe(upisaPre)
  })
})

describe('D15 — zaštita od duplog tapa po oblastima', () => {
  it('#tezga: drugi tap na tezgi odmah posle prodaje se ignoriše; posle 300 ms radi', async () => {
    const h = await mountApp({ sejv: stanje({ mag: { ...MAG0, psenica: 2, sargarepa: 1 } }) })
    h.klik('nav [data-tab="pijaca"]')
    h.klik('[data-prodaj="psenica"]')
    expect(h.stanje().mag.psenica).toBe(0)
    h.klik('[data-prodaj="sargarepa"]') // red je iskočio na isto mesto — tap se ignoriše
    expect(h.stanje().mag.sargarepa).toBe(1)
    // Druge oblasti NISU zaključane prodajom: tabla narudžbina i njiva rade u istoj ms.
    h.klik('nav [data-tab="narudzbe"]')
    const ids = h.stanje().narudzbe.map((o) => o.id)
    h.klik('[data-odbij]')
    expect(h.stanje().narudzbe.map((o) => o.id)).not.toEqual(ids)
    h.klik('.parcela[data-i="0"]')
    expect(h.q('#list.otvoren')).not.toBeNull()
    h.klik('nav [data-tab="pijaca"]')
    h.pauza(ZAKLJUCAVANJE_TAPA_MS - 1)
    h.klik('[data-prodaj="sargarepa"]')
    expect(h.stanje().mag.sargarepa).toBe(1)
    h.pauza(1)
    h.klik('[data-prodaj="sargarepa"]')
    expect(h.stanje().mag.sargarepa).toBe(0)
  })

  it('#narudzbeKuca: odbijanje zaključava tablu; druge oblasti nisu zaključane', async () => {
    const h = await mountApp({ sejv: stanje({ mag: { ...MAG0, psenica: 1 } }) })
    h.klik('nav [data-tab="narudzbe"]')
    const pre = h.stanje().narudzbe.map((o) => o.id)
    h.klik('[data-odbij]')
    const posle = h.stanje().narudzbe.map((o) => o.id)
    expect(posle).not.toEqual(pre)
    h.klik('[data-odbij]')
    expect(h.stanje().narudzbe.map((o) => o.id)).toEqual(posle)
    // Tezga nije zaključana odbijanjem.
    h.klik('nav [data-tab="pijaca"]')
    h.klik('[data-prodaj="psenica"]')
    expect(h.stanje().mag.psenica).toBe(0)
    h.pauza(ZAKLJUCAVANJE_TAPA_MS)
    h.klik('nav [data-tab="narudzbe"]')
    h.klik('[data-odbij]')
    expect(h.stanje().narudzbe.map((o) => o.id)).not.toEqual(posle)
  })

  it('#veo: pozadina odmah posle otvaranja lista ne zatvara list; seme u istoj ms radi', async () => {
    const h = await mountApp()
    h.klik('.parcela[data-i="0"]')
    h.klik('#veo')
    expect(h.q('#list.otvoren')).not.toBeNull()
    h.pauza(ZAKLJUCAVANJE_TAPA_MS)
    h.klik('#veo')
    expect(h.q('#list.otvoren')).toBeNull()
    expect(h.q('#veo.otvoren')).toBeNull()
    // Druga oblast: parcela pa seme u istoj ms (referenca-sim TEST 1).
    h.klik('.parcela[data-i="1"]')
    h.klik('[data-seme="psenica"]')
    expect(h.stanje().parcele[1]?.c).toBe('psenica')
  })

  it('#njive: posle „Uberi sve" tap na njivu se ignoriše ZAKLJUCAVANJE_TAPA_MS', async () => {
    const h = await mountApp({
      sejv: stanje({
        parcele: [
          { c: 'psenica', t: T0 - 20_000, z: false },
          { c: 'psenica', t: T0 - 20_000, z: false },
        ],
      }),
    })
    h.klik('#uberiSve')
    expect(h.stanje().mag.psenica).toBe(2)
    expect(h.q('#toast')?.textContent).toBe('Ubrano 2 useva 🌾')
    h.klik('.parcela[data-i="0"]')
    expect(h.q('#list.otvoren')).toBeNull()
    h.pauza(ZAKLJUCAVANJE_TAPA_MS)
    h.klik('.parcela[data-i="0"]')
    expect(h.q('#list.otvoren')).not.toBeNull()
  })
})

describe('žetva i sadnja kroz DOM (D1, D2, 180 ms)', () => {
  it('žetva jedne parcele: DOM se crta tek posle 180 ms; dupli tap u tom prozoru bere jednom', async () => {
    const h = await mountApp({
      tajmeri: 'red',
      sejv: stanje({
        parcele: [
          { c: 'psenica', t: T0 - 20_000, z: false },
          { c: null, t: 0, z: false },
        ],
      }),
    })
    const zrela = h.q('.parcela.zrelo')
    h.klik(zrela)
    expect(h.q('.parcela.zrelo')).toBe(zrela) // još na ekranu (animacija)
    h.klik(zrela) // D1: drugi tap — no-op
    expect(h.stanje().mag.psenica).toBe(1)
    expect(h.stanje().stat.ubrano).toBe(1)
    expect(h.stanje().xp).toBe(2)
    expect(h.stanje().mag).not.toHaveProperty('null')
    h.pauza(UBERI_CRTANJE_ODLAGANJE_MS - 1)
    expect(h.q('.parcela.zrelo')).toBe(zrela)
    h.pauza(1)
    expect(h.q('.parcela.zrelo')).toBeNull()
    expect(h.qa('.parcela.prazna')).toHaveLength(2)
    expect(h.greske).toEqual([])
  })

  it('D2: dupli tap na seme naplati i posadi jednom', async () => {
    const h = await mountApp()
    h.klik('.parcela[data-i="0"]')
    const seme = h.q('[data-seme="psenica"]')
    h.klik(seme)
    const t = h.stanje().parcele[0]?.t
    h.skok(100)
    h.klik(seme) // zastarelo dugme lista koji se zatvara
    expect(h.stanje().novac).toBe(40)
    expect(h.stanje().parcele[0]?.t).toBe(t)
  })

  it('zaključano seme (disabled) ne sadi ni kad jsdom ipak isporuči klik (04 B8)', async () => {
    const h = await mountApp()
    h.klik('.parcela[data-i="0"]')
    const b = h.q<HTMLButtonElement>('[data-seme="bundeva"]')
    expect(b?.disabled).toBe(true)
    h.klik(b)
    expect(h.stanje().parcele[0]?.c).toBeNull()
    expect(h.stanje().novac).toBe(50)
  })

  it('zalivanje ne crta njivu: ista pločica, bez kapljice, kapi FX unutar pločice', async () => {
    const h = await mountApp({ tajmeri: 'red' })
    posadi(h, 0)
    const el = h.q('.parcela[data-i="0"]')
    h.klik(el)
    expect(h.q('.parcela[data-i="0"]')).toBe(el)
    expect(el?.querySelector('.zalij')).toBeNull()
    expect(el?.querySelectorAll('.kapFx')).toHaveLength(3)
    expect(h.stanje().parcele[0]).toMatchObject({ z: true, t: T0 - 5000 })
  })

  it('kupovina parcele: cena se računa pri kliku, anti-softlock poruka kad bi ostalo < 10 din', async () => {
    const h = await mountApp({ sejv: stanje({ novac: 159 }) })
    expect(h.q('.parcela.zakljucana .znak')?.textContent).toBe('150 din')
    h.klik('.parcela.zakljucana')
    expect(h.q('#toast')?.textContent).toBe('Ostavi bar za seme pšenice 🙂')
    expect(h.stanje().parcele).toHaveLength(2)
    const h2 = await mountApp({ sejv: stanje({ novac: 160 }) })
    h2.klik('.parcela.zakljucana')
    expect(h2.stanje().parcele).toHaveLength(3)
    expect(h2.q('#novac')?.textContent).toBe('10')
    expect(h2.q('.parcela.zakljucana .znak')?.textContent).toBe('330 din')
    expect(h2.q('#toast')?.textContent).toBe('Nova parcela je tvoja 🎉')
  })
})

describe('D14 — list semena se gradi ponovo kad crtajSve radi dok je otvoren', () => {
  it('level-up OK dok je list otvoren: paprika postaje dostupna bez ponovnog otvaranja', async () => {
    const h = await mountApp({
      sejv: stanje({
        novac: 100,
        xp: 28,
        parcele: [
          { c: null, t: 0, z: false },
          { c: 'psenica', t: T0 - 20_000, z: false },
        ],
      }),
    })
    h.klik('.parcela[data-i="0"]')
    const paprika = () => h.q<HTMLButtonElement>('[data-seme="paprika"]')
    expect(paprika()?.disabled).toBe(true)
    h.klik('.parcela[data-i="1"]') // žetva (+2 XP → nivo 2) dok je list otvoren
    expect(h.q('#nivoKartica h3')?.textContent).toBe('Nivo 2!')
    expect(paprika()?.disabled).toBe(true) // još stari list
    h.zatvoriOverlaye() // OK → crtajSve → list se gradi ponovo
    expect(h.q('#list.otvoren')).not.toBeNull()
    expect(paprika()?.disabled).toBe(false)
    expect(paprika()?.classList.contains('zakljucano')).toBe(false)
    h.klik(paprika())
    expect(h.stanje().parcele[0]?.c).toBe('paprika')
  })
})

describe('isporuka i narudžbine', () => {
  it('neisporučiva narudžbina (disabled, ali klik stigne): samo zvuk greške, ništa se ne menja', async () => {
    const h = await mountApp({
      sejv: stanje({
        mute: false,
        narudzbe: [narudzba(1, 'psenica', 5, 60, 5), narudzba(2, 'sargarepa', 1, 80, 6)],
      }),
    })
    h.klik('nav [data-tab="narudzbe"]')
    const b = h.q<HTMLButtonElement>('[data-isporuci="1"]')
    expect(b?.disabled).toBe(true)
    h.klik(b)
    expect(h.zvuci).toEqual(['tap', 'greska'])
    expect(h.stanje().narudzbe.map((o) => o.id)).toEqual([1, 2])
    expect(h.stanje().stat.isporuke).toBe(0)
  })

  it('isporuka: novčići, zahvalnica, zamenska narudžbina na kraju, čuvanje', async () => {
    const h = await mountApp({
      sejv: stanje({
        mag: { ...MAG0, psenica: 5 },
        narudzbe: [narudzba(5, 'psenica', 2, 60, 5), narudzba(6, 'sargarepa', 1, 80, 6)],
      }),
    })
    h.klik('nav [data-tab="narudzbe"]')
    h.klik('[data-isporuci="5"]')
    expect(h.qa('body > .letac')).toHaveLength(0) // 'odmah': uklonjeni odmah posle leta
    expect(h.q('#toast')?.textContent).toBe('Baka Mira ti zahvaljuje! +60 din')
    expect(h.stanje().narudzbe.map((o) => o.id)).toEqual([6, 7])
    expect(h.qa('[data-isporuci]').map((b) => b.dataset.isporuci)).toEqual(['6', '7'])
    expect(h.q('#novac')?.textContent).toBe('110')
    const s = h.sacuvano() as { stat: { isporuke: number }; narudzbe: { id: number }[] }
    expect(s.stat.isporuke).toBe(1)
    expect(s.narudzbe.map((o) => o.id)).toEqual([6, 7])
    expect(h.skladiste?.podaci.has(KLJUC_SEJVA)).toBe(true)
  })
})
