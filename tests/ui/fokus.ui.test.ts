// @vitest-environment jsdom
/*
 * Fokusirani UI testovi za odobrena odstupanja i bagove koje DOM paritet ne može da vidi (jer ih
 * prototip nema, ili ih test pariteta namerno zaobilazi):
 *   D9  učitavanje koje ne uspe ne sme da pregazi sejv (get odbijen, pokvaren sejv, novija verzija,
 *       neuspela rezerva, odbijen upis);
 *   D14 tick osvežava oznaku trenda za SVAKI artikal; list se gradi ponovo bez novog zaključavanja;
 *   D15 zaključavanje po oblastima (sve oblasti, granica tačno ZAKLJUCAVANJE_TAPA_MS, druge oblasti rade);
 *   D16 redovi „Dobro došao nazad" po mašini, decimalni zarez u trajanju;
 *   reset (ugovor §6 + D6), zvuk (mute u trenutku puštanja, AudioContext tek pri prvom zvuku),
 *   D13 kroz UI (neprekidna igra piše bar na 5 s), lifecycle (sakrivanje → trenutni upis),
 *   06#1 (dupla žetva) i 06#2 (dupla sadnja).
 * Vrednosti su iz prototipa/konfiga; svaki test ima proveru koja pada ako se ponašanje promeni.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ART } from '../../src/art'
import {
  KLJUC_REZERVE,
  KLJUC_SEJVA,
  NOVAC_ZVUK_ODLAGANJE_MS,
  SEJV_MAX_CEKANJE_MS,
  SEJV_ODLAGANJE_MS,
  SVI_KLJUCEVI,
  UBERI_CRTANJE_ODLAGANJE_MS,
  ZAKLJUCAVANJE_TAPA_MS,
} from '../../src/config'
import { trzisnaCena, type ZvukId } from '../../src/core'
import { t } from '../../src/i18n'
import { MemoryStorage, createAudio, type AudioKontekst } from '../../src/platform'
import { smerHtml } from '../../src/ui/tezga'
import { MAG0, T0, narudzba, stanje } from '../helpers'
import { mountApp, type Montirana } from '../helpers/mountApp'

const MIN = 60_000
const SAT = 60 * MIN

/** HTML kako ga serijalizuje DOM (SVG sprajtovi). */
function kaoDom(html: string): string {
  const d = document.createElement('div')
  d.innerHTML = html
  return d.innerHTML
}

let neuhvaceno: string[] = []
const naOdbijanje = (e: unknown) => {
  neuhvaceno.push(String(e instanceof Error ? e.message : e))
}
beforeEach(() => {
  neuhvaceno = []
  process.on('unhandledRejection', naOdbijanje)
})
afterEach(() => {
  process.off('unhandledRejection', naOdbijanje)
})

/** Pun krug igre koji bi, da čuvanje radi, upisao sejv na svaki mogući način: odložene i trenutne
 *  zahteve, tick sa mašinom, prodaju, zvuk, sakrivanje, reset i dugo smirivanje. */
async function sesija(h: Montirana): Promise<void> {
  h.zatvoriOverlaye()
  h.pauza(ZAKLJUCAVANJE_TAPA_MS)
  h.klik('.parcela.prazna')
  h.klik('[data-seme="psenica"]')
  h.pauza(ZAKLJUCAVANJE_TAPA_MS)
  h.klik('.parcela[data-i="0"]') // zalivanje
  h.skok(20_000)
  h.tik()
  h.klik('.parcela.zrelo')
  h.pauza(SEJV_ODLAGANJE_MS + 100)
  h.klik('nav [data-tab="pijaca"]')
  h.klik('[data-prodaj]')
  h.klik('nav [data-tab="radnja"]')
  h.klik('#zvukDugme')
  h.sakrij()
  h.pauza(10_000)
  h.klik('#resetDugme')
  await h.mikro()
  h.sakrij()
  h.pauza(10_000)
}

describe('D9 — učitavanje koje ne uspe ne sme da pregazi sejv', () => {
  it('get odbijen: toast upozorenja, nova igra u memoriji, NIŠTA se nikad ne upisuje (ni rezerva)', async () => {
    const original = JSON.stringify(stanje({ novac: 9999, xp: 800 }))
    const sk = new MemoryStorage({ [KLJUC_SEJVA]: original })
    sk.odbijGet = true
    const h = await mountApp({ skladiste: sk, tajmeri: 'red' })
    expect(h.q('#toast')?.textContent).toBe(t.toast.ucitavanjeNeuspelo)
    expect(h.stanje()).toMatchObject({ novac: 50, xp: 0 })
    await sesija(h)
    expect(h.stanje().novac).toBe(50) // reset je prošao (samo u memoriji)
    expect(sk.setPozivi).toBe(0)
    expect([...sk.podaci.keys()]).toEqual([KLJUC_SEJVA])
    expect(sk.podaci.get(KLJUC_SEJVA)).toBe(original)
    expect(h.greske).toEqual([])
    expect(neuhvaceno).toEqual([])
  })

  it('sejv iz novije verzije: toast, readOnly cele sesije, original bajt-identičan', async () => {
    const buduci = JSON.stringify({ ...stanje({ novac: 1234 }), v: 4, novoPolje: [1, 2] })
    const sk = new MemoryStorage({ [KLJUC_SEJVA]: buduci })
    const h = await mountApp({ skladiste: sk, tajmeri: 'red' })
    expect(h.q('#toast')?.textContent).toBe(t.toast.sejvNovijeVerzije)
    await sesija(h)
    expect(sk.setPozivi).toBe(0)
    expect(sk.podaci.get(KLJUC_SEJVA)).toBe(buduci)
    expect(sk.podaci.has(KLJUC_REZERVE)).toBe(false)
  })

  it('pokvaren sejv: sirovi original u rezervu PRE prvog upisa, igra se igra i čuva, rezerva ostaje netaknuta', async () => {
    const pokvaren = '{"v":3,"novac":777,"parcele":[{"c":"psenica"'
    const sk = new MemoryStorage({ [KLJUC_SEJVA]: pokvaren })
    const h = await mountApp({ skladiste: sk, tajmeri: 'red' })
    expect(sk.upisi.map((u) => u.kljuc)).toEqual([KLJUC_REZERVE])
    expect(sk.podaci.get(KLJUC_REZERVE)).toBe(pokvaren)
    expect(h.q('#toast')?.textContent).toBe(t.toast.dobrodosao) // nova igra, bez upozorenja
    h.klik('.parcela.prazna')
    h.klik('[data-seme="psenica"]')
    h.pauza(SEJV_ODLAGANJE_MS)
    expect(h.sacuvano()).toMatchObject({ novac: 40, sadio: true, parcele: [{ c: 'psenica' }, {}] })
    h.sakrij()
    h.klik('#resetDugme')
    await h.mikro()
    // Svi kasniji upisi idu samo na glavni ključ; rezerva je upisana TAČNO jednom.
    expect(sk.upisi.filter((u) => u.kljuc === KLJUC_REZERVE)).toHaveLength(1)
    expect(sk.upisi.length).toBeGreaterThan(2)
    expect(sk.podaci.get(KLJUC_REZERVE)).toBe(pokvaren)
  })

  it('pokvaren sejv, a rezerva ne može da se upiše: upozorenje i readOnly — original se ne gazi', async () => {
    const pokvaren = 'nije json'
    const sk = new MemoryStorage({ [KLJUC_SEJVA]: pokvaren })
    sk.odbijSet = true
    const h = await mountApp({ skladiste: sk, tajmeri: 'red' })
    expect(h.q('#toast')?.textContent).toBe(t.toast.ucitavanjeNeuspelo)
    sk.odbijSet = false // skladište se „oporavilo" — sesija i dalje ne sme da piše
    await sesija(h)
    expect(sk.upisi).toEqual([])
    expect(sk.podaci.get(KLJUC_SEJVA)).toBe(pokvaren)
    expect(neuhvaceno).toEqual([])
  })

  it('upis odbijen (npr. kvota): igra ide dalje bez grešaka, sledeći zahtev pokušava ponovo', async () => {
    const sk = new MemoryStorage()
    const h = await mountApp({ skladiste: sk, tajmeri: 'red' })
    sk.odbijSet = true
    h.klik('.parcela.prazna')
    h.klik('[data-seme="psenica"]')
    h.pauza(SEJV_ODLAGANJE_MS + 100)
    h.sakrij()
    await h.mikro()
    expect(sk.setPozivi).toBeGreaterThanOrEqual(2)
    expect(sk.upisi).toEqual([])
    sk.odbijSet = false
    h.pauza(ZAKLJUCAVANJE_TAPA_MS)
    h.klik('.parcela[data-i="0"]') // zalivanje → novi zahtev
    h.pauza(SEJV_ODLAGANJE_MS)
    expect(h.sacuvano()).toMatchObject({ novac: 40, parcele: [{ c: 'psenica', z: true }, {}] })
    expect(h.greske).toEqual([])
    expect(neuhvaceno).toEqual([])
  })
})

describe('D14 — osvežavanje uživo', () => {
  it('tick osvežava cenu I oznaku trenda za SVAKI artikal na tezgi, kroz ceo period cene', async () => {
    const svega = Object.fromEntries(SVI_KLJUCEVI.map((k) => [k, 2])) as typeof MAG0
    const h = await mountApp({ sejv: stanje({ mag: svega }) })
    h.klik('nav [data-tab="pijaca"]')
    const redovi = h.qa('[data-cena]')
    expect(redovi).toHaveLength(SVI_KLJUCEVI.length)
    const smerovi = new Set<number>()
    for (let n = 1; n <= 20; n++) {
      h.skok(30_000)
      h.tik()
      const now = h.sad()
      for (const k of SVI_KLJUCEVI) {
        const el = h.q(`[data-cena="${k}"]`)
        const { cena, smer } = trzisnaCena(k, now)
        smerovi.add(smer)
        expect(el, `${k} u mestu`).toBe(redovi[SVI_KLJUCEVI.indexOf(k)])
        expect(el?.textContent, `${k} cena @${n}`).toBe(t.din(cena))
        expect(el?.nextElementSibling?.outerHTML, `${k} oznaka @${n}`).toBe(kaoDom(smerHtml(smer)))
      }
    }
    expect([...smerovi].sort()).toEqual([-1, 0, 1]) // prošle su sve tri oznake
  })

  it('list se gradi ponovo posle level-up OK bez novog zaključavanja #veo i bez promene izabrane parcele', async () => {
    const h = await mountApp({
      sejv: stanje({
        novac: 100,
        xp: 85,
        masine: { mlin: { k: true, t: T0 - 80_000 }, kazan: { k: false, t: 0 } },
      }),
    })
    h.klik('.parcela[data-i="1"]') // list za parcelu 1
    const stariList = h.q('[data-seme="bundeva"]')
    expect(stariList?.classList.contains('zakljucano')).toBe(true)
    h.skok(10_000)
    h.tik() // mlin: +8 XP → nivo 3 (+120 din) ispod otvorenog lista
    h.zatvoriOverlaye()
    const bundeva = h.q<HTMLButtonElement>('[data-seme="bundeva"]')
    expect(bundeva).not.toBe(stariList)
    expect(bundeva?.disabled).toBe(false)
    expect(bundeva?.querySelector('.kosta')?.innerHTML).toBe('200 din<small>+40 XP</small>')
    h.klik(bundeva) // izabrana je i dalje parcela 1
    expect(h.stanje().parcele.map((p) => p.c)).toEqual([null, 'bundeva'])
    // Ponovno građenje nije „otvaranje": pozadina nije ponovo zaključana.
    h.klik('.parcela[data-i="0"]')
    h.pauza(ZAKLJUCAVANJE_TAPA_MS)
    h.skok(1000)
    h.tik()
    expect(h.q('#list.otvoren')).not.toBeNull()
    h.app.crtajSve() // crtajSve dok je list otvoren — posle isteka zaključavanja od otvaranja
    h.klik('#veo')
    expect(h.q('#list.otvoren')).toBeNull()
  })
})

describe('D15 — zaštita od duplog tapa po oblastima', () => {
  interface Slucaj {
    oblast: string
    sejv: object
    pripremi(h: Montirana): void
    /** Akcija koja zaključava oblast. */
    prvi(h: Montirana): void
    /** Tap u ISTOJ oblasti; vraća opažljiv efekat (menja se kad tap prođe). */
    drugi(h: Montirana): void
    efekat(h: Montirana): unknown
  }
  const narudzbine = [narudzba(1, 'psenica', 1, 25, 3), narudzba(2, 'psenica', 1, 30, 3)]
  const SLUCAJEVI: Slucaj[] = [
    {
      oblast: '#tezga (prodaja)',
      sejv: stanje({ mag: { ...MAG0, psenica: 2, sargarepa: 1 } }),
      pripremi: (h) => h.klik('nav [data-tab="pijaca"]'),
      prvi: (h) => h.klik('[data-prodaj="psenica"]'),
      drugi: (h) => h.klik('[data-prodaj="sargarepa"]'),
      efekat: (h) => h.stanje().mag.sargarepa,
    },
    {
      oblast: '#narudzbeKuca (isporuka)',
      sejv: stanje({ mag: { ...MAG0, psenica: 5 }, narudzbe: narudzbine }),
      pripremi: (h) => h.klik('nav [data-tab="narudzbe"]'),
      prvi: (h) => h.klik('[data-isporuci="1"]'),
      drugi: (h) => h.klik('[data-isporuci="2"]'),
      efekat: (h) => h.stanje().stat.isporuke,
    },
    {
      oblast: '#narudzbeKuca (odbijanje)',
      sejv: stanje({ narudzbe: narudzbine }),
      pripremi: (h) => h.klik('nav [data-tab="narudzbe"]'),
      prvi: (h) => h.klik('[data-odbij="1"]'),
      drugi: (h) => h.klik('[data-odbij="2"]'),
      efekat: (h) =>
        h
          .stanje()
          .narudzbe.map((o) => o.id)
          .join(','),
    },
    {
      oblast: '#veo (otvaranje lista)',
      sejv: stanje(),
      pripremi: () => {},
      prvi: (h) => h.klik('.parcela[data-i="0"]'),
      drugi: (h) => h.klik('#veo'),
      efekat: (h) => h.q('#list.otvoren') !== null,
    },
    {
      oblast: '#njive („Uberi sve")',
      sejv: stanje({
        parcele: [
          { c: 'psenica', t: T0 - 20_000, z: false },
          { c: 'psenica', t: T0 - 20_000, z: false },
        ],
      }),
      pripremi: () => {},
      prvi: (h) => h.klik('#uberiSve'),
      drugi: (h) => h.klik('.parcela[data-i="0"]'),
      efekat: (h) => h.q('#list.otvoren') !== null,
    },
    {
      oblast: '#nivoOk (prikaz kartice)',
      sejv: stanje({
        xp: 28,
        parcele: [
          { c: 'psenica', t: T0 - 20_000, z: false },
          { c: null, t: 0, z: false },
        ],
      }),
      pripremi: () => {},
      prvi: (h) => h.klik('.parcela.zrelo'), // +2 XP → kartica „Nivo 2!"
      drugi: (h) => h.klik('#nivoOk'),
      efekat: (h) => h.q('#nivoVeo.otvoren') !== null,
    },
  ]

  it.each(SLUCAJEVI)(
    '$oblast: isti tap na +0 i +299 ms se ignoriše, na +300 ms prolazi',
    async (s) => {
      const h = await mountApp({ sejv: s.sejv })
      s.pripremi(h)
      h.pauza(ZAKLJUCAVANJE_TAPA_MS)
      s.prvi(h)
      const pre = s.efekat(h)
      s.drugi(h)
      expect(s.efekat(h), '+0 ms').toEqual(pre)
      h.pauza(ZAKLJUCAVANJE_TAPA_MS - 1)
      s.drugi(h)
      expect(s.efekat(h), '+299 ms').toEqual(pre)
      h.pauza(1)
      s.drugi(h)
      expect(s.efekat(h), '+300 ms').not.toEqual(pre)
    },
  )

  it('zaključana oblast ne blokira druge: posle prodaje u istoj ms rade odbijanje, njiva i nav', async () => {
    const h = await mountApp({
      sejv: stanje({ mag: { ...MAG0, psenica: 2 }, narudzbe: narudzbine }),
    })
    h.klik('nav [data-tab="pijaca"]')
    h.klik('[data-prodaj="psenica"]')
    h.klik('nav [data-tab="narudzbe"]')
    expect(h.q('#tab-narudzbe.aktivan')).not.toBeNull()
    h.klik('[data-odbij="1"]')
    expect(h.stanje().narudzbe.map((o) => o.id)).toEqual([2, 3])
    // #narudzbeKuca je sada zaključana, ali njiva i seme u istoj ms rade (referenca-sim TEST 1).
    h.klik('.parcela[data-i="0"]')
    h.klik('[data-seme="psenica"]')
    expect(h.stanje().parcele[0]?.c).toBe('psenica')
    // … a „Uberi sve" zaključava samo #njive: tezga ostaje otvorena.
    const h2 = await mountApp({
      sejv: stanje({
        mag: { ...MAG0, sargarepa: 1 },
        parcele: [
          { c: 'psenica', t: T0 - 20_000, z: false },
          { c: 'psenica', t: T0 - 20_000, z: false },
        ],
      }),
    })
    h2.klik('#uberiSve')
    h2.klik('nav [data-tab="pijaca"]')
    h2.klik('[data-prodaj="sargarepa"]')
    expect(h2.stanje().mag.sargarepa).toBe(0)
  })

  it('#nivoOk: svaka SLEDEĆA kartica u redu se ponovo zaključava (brz drugi tap ne preskače karticu)', async () => {
    const h = await mountApp({
      sejv: stanje({
        mag: { ...MAG0, psenica: 1 },
        narudzbe: [narudzba(1, 'psenica', 1, 25, 200), narudzba(2, 'sargarepa', 9, 700, 70)],
      }),
    })
    h.klik('nav [data-tab="narudzbe"]')
    h.klik('[data-isporuci="1"]') // 200 XP → nivoi 2, 3, 4
    const naslov = () => h.q('#nivoKartica h3')?.textContent
    expect(naslov()).toBe('Nivo 2!')
    h.pauza(ZAKLJUCAVANJE_TAPA_MS)
    h.klik('#nivoOk')
    expect(naslov()).toBe('Nivo 3!')
    h.klik('#nivoOk') // odmah posle prikaza kartice 3 — ignorisano
    h.pauza(ZAKLJUCAVANJE_TAPA_MS - 1)
    h.klik('#nivoOk')
    expect(naslov()).toBe('Nivo 3!')
    h.pauza(1)
    h.klik('#nivoOk')
    expect(naslov()).toBe('Nivo 4!')
    h.pauza(ZAKLJUCAVANJE_TAPA_MS)
    h.klik('#nivoOk')
    expect(h.q('#nivoVeo.otvoren')).toBeNull()
  })
})

describe('D16 — tekstovi', () => {
  it('„Dobro došao nazad": samo kazan gotov (mlin i dalje radi) → jedan red, ikonica kazana', async () => {
    const h = await mountApp({
      sejv: stanje({
        xp: 200,
        videno: T0 - SAT,
        masine: { mlin: { k: true, t: T0 - 30_000 }, kazan: { k: true, t: T0 - 50 * MIN } },
      }),
    })
    const linije = h.qa('#nivoKartica .spisak > div')
    expect(linije.map((d) => d.textContent)).toEqual(['Ajvar je gotov!'])
    expect(linije[0]?.querySelector('.slicica')?.innerHTML).toBe(kaoDom(ART.kazan))
  })

  it('„Dobro došao nazad" bez mašina: samo proizvodi životinja, jaja pre mleka', async () => {
    const h = await mountApp({
      sejv: stanje({
        xp: 900,
        videno: T0 - SAT,
        ziv: { kokosinjac: { k: true, t: T0 - SAT }, stala: { k: true, t: T0 - SAT } },
      }),
    })
    expect(h.qa('#nivoKartica .spisak > div').map((d) => d.textContent)).toEqual([
      'Jaja: +4',
      'Mleko: +3',
    ])
  })

  it('trajanje sa decimalnim zarezom samo gde postoji razlomak: list semena i kartice životinja', async () => {
    const h = await mountApp({
      sejv: stanje({
        novac: 10_000,
        xp: 900,
        ziv: { kokosinjac: { k: true, t: T0 }, stala: { k: true, t: T0 } },
      }),
    })
    h.klik('.parcela[data-i="0"]')
    expect(h.qa('#semena .info span').map((s) => s.textContent)).toEqual([
      'raste 20 s · prodaja ~18 din',
      'raste 1,5 min · prodaja ~62 din',
      'raste 5 min · prodaja ~185 din',
      'raste 30 min · prodaja ~900 din',
      'raste 2 h · prodaja ~2.300 din',
    ])
    expect(h.qa('[data-zgz] p').map((p) => p.textContent)).toEqual([
      '0/4 × jaja spremno · novo na 3 min',
      '0/3 × mleko spremno · novo na 10 min',
    ])
  })
})

describe('reset (ugovor §6, D6)', () => {
  it('potvrda odbijena: DOM, stanje, sejv, toast i zvuci — ništa se ne menja', async () => {
    const h = await mountApp({
      potvrda: false,
      tajmeri: 'red',
      sejv: stanje({ novac: 5000, xp: 500, mute: false, mag: { ...MAG0, psenica: 3 } }),
    })
    h.pauza(SEJV_ODLAGANJE_MS)
    h.klik('nav [data-tab="radnja"]')
    const app = h.q('#app')?.innerHTML
    const stanjePre = JSON.stringify(h.stanje())
    const upisa = h.skladiste?.setPozivi
    const zvuci = [...h.zvuci]
    h.klik('#resetDugme')
    await h.mikro()
    h.pauza(SEJV_ODLAGANJE_MS * 3)
    expect(h.potvrde).toEqual([t.reset.potvrda])
    expect(h.q('#app')?.innerHTML).toBe(app)
    expect(JSON.stringify(h.stanje())).toBe(stanjePre)
    expect(h.skladiste?.setPozivi).toBe(upisa)
    expect(h.zvuci).toEqual(zvuci)
    expect(h.q('#toast')?.textContent).not.toBe(t.toast.novaIgra)
  })

  it('dijalog baci: isto kao „ne"; nema neuhvaćene greške', async () => {
    const h = await mountApp({ sejv: stanje({ novac: 5000 }) })
    h.platforma.dialog = { confirm: () => Promise.reject(new Error('dijalog pao')) }
    h.klik('#resetDugme')
    await h.mikro()
    expect(h.stanje().novac).toBe(5000)
    expect(h.greske).toEqual([])
    expect(neuhvaceno).toEqual([])
  })

  it('potvrda: nova igra čuva zvuk i SAČUVANI dan poklona, izabrana = -1, list zatvoren, trenutni upis', async () => {
    // sadio: false → nema poklona na startu, pa `poklonDan` ostaje stari datum (≠ danas i ≠ '').
    const h = await mountApp({
      tajmeri: 'red',
      sejv: stanje({ novac: 5000, xp: 500, mute: false, sadio: false, poklonDan: '2026-01-10' }),
    })
    expect(h.q('#nivoVeo.otvoren')).toBeNull()
    h.pauza(SEJV_ODLAGANJE_MS)
    h.klik('.parcela[data-i="1"]') // izabrana = 1
    const staroSeme = h.q('[data-seme="psenica"]')
    const upisa = h.skladiste?.upisi.length ?? 0
    h.klik('#resetDugme') // jsdom isporuči klik i ispod lista
    await h.mikro()
    expect(h.stanje()).toMatchObject({
      novac: 50,
      xp: 0,
      sadio: false,
      mute: false,
      poklonDan: '2026-01-10',
    })
    expect(h.q('#list.otvoren')).toBeNull()
    expect(h.skladiste?.upisi.length).toBe(upisa + 1) // trenutni upis, pre crtanja
    expect(h.sacuvano()).toMatchObject({ novac: 50, mute: false, poklonDan: '2026-01-10' })
    h.klik(staroSeme) // izabrana = -1: zastarelo dugme ne sadi nigde
    expect(h.stanje().parcele.map((p) => p.c)).toEqual([null, null])
    expect(h.stanje().novac).toBe(50)
    expect(h.q('#toast')?.textContent).toBe(t.toast.novaIgra)
    // Isti test sa isključenim zvukom: i `mute: true` preživi reset.
    const h2 = await mountApp({ sejv: stanje({ mute: true, novac: 5000 }) })
    h2.klik('#resetDugme')
    await h2.mikro()
    expect(h2.stanje().mute).toBe(true)
    expect(h2.q('#zvukDugme')?.textContent).toBe(t.podesavanja.zvuk(true))
  })
})

describe('zvuk — `mute` u trenutku puštanja, AudioContext tek pri prvom zvuku', () => {
  /** Pravi audio adapter nad lažnim AudioContext-om koji broji pravljenja i tonove. */
  function lazanAudio() {
    const brojac = { konteksta: 0, tonova: 0, pozivi: [] as ZvukId[] }
    class Kontekst implements AudioKontekst {
      readonly currentTime = 0
      readonly state = 'running'
      readonly destination = {}
      constructor() {
        brojac.konteksta++
      }
      resume() {}
      createOscillator() {
        brojac.tonova++
        return { type: '', frequency: { value: 0 }, connect() {}, start() {}, stop() {} }
      }
      createGain() {
        return {
          gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
          connect() {},
        }
      }
    }
    const pravi = createAudio(() => ({ AudioContext: Kontekst }))
    return {
      brojac,
      port: {
        play(id: ZvukId) {
          brojac.pozivi.push(id)
          pravi.play(id)
        },
      },
    }
  }

  it('isključen zvuk kroz celu sesiju: audio.play se nikad ne zove, AudioContext se nikad ne pravi', async () => {
    const a = lazanAudio()
    const h = await mountApp({
      boot: false,
      tajmeri: 'red',
      sejv: stanje({
        mute: true,
        xp: 28,
        poklonDan: '',
        mag: { ...MAG0, psenica: 3 },
        parcele: [
          { c: 'psenica', t: T0 - 20_000, z: false },
          { c: null, t: 0, z: false },
        ],
        masine: { mlin: { k: true, t: T0 - 85_000 }, kazan: { k: false, t: 0 } },
      }),
    })
    h.platforma.audio = a.port
    await h.app.boot()
    h.zatvoriOverlaye() // poklon: „Hvala!" → tap + odloženi „novac"
    h.pauza(ZAKLJUCAVANJE_TAPA_MS)
    h.klik('.parcela.zrelo') // žetva → nivo 2 (zvuk 'nivo')
    h.zatvoriOverlaye()
    h.skok(10_000)
    h.tik() // mlin gotov ('zetva')
    h.klik('nav [data-tab="pijaca"]')
    h.klik('[data-prodaj]') // odloženi 'novac' posle 480 ms
    h.pauza(NOVAC_ZVUK_ODLAGANJE_MS * 2)
    h.klik('nav [data-tab="narudzbe"]')
    h.klik('[data-odbij]')
    expect(h.stanje().stat.ubrano).toBe(1) // sesija se stvarno odigrala
    expect(a.brojac.pozivi).toEqual([])
    expect(a.brojac.konteksta).toBe(0)
    // Uključivanje: prvi zvuk („tap") pravi kontekst — tačno jednom, i dalje se isti koristi.
    h.klik('nav [data-tab="radnja"]')
    h.klik('#zvukDugme')
    expect(a.brojac.pozivi).toEqual(['tap'])
    expect(a.brojac.konteksta).toBe(1)
    h.klik('nav [data-tab="farma"]')
    h.klik('nav [data-tab="radnja"]')
    expect(a.brojac.pozivi).toEqual(['tap', 'tap', 'tap'])
    expect(a.brojac.konteksta).toBe(1)
    expect(a.brojac.tonova).toBe(3) // 'tap' je jedan ton
  })

  it('odloženi „novac": zakazan dok je zvuk ISKLJUČEN, pušta se jer je pri puštanju UKLJUČEN', async () => {
    const h = await mountApp({
      tajmeri: 'red',
      sejv: stanje({ mute: true, mag: { ...MAG0, psenica: 3 } }),
    })
    h.klik('nav [data-tab="pijaca"]')
    h.klik('[data-prodaj="psenica"]')
    h.klik('nav [data-tab="radnja"]')
    h.klik('#zvukDugme') // uključi pre isteka 480 ms
    expect(h.zvuci).toEqual(['tap'])
    h.pauza(NOVAC_ZVUK_ODLAGANJE_MS - 1)
    expect(h.zvuci).toEqual(['tap'])
    h.pauza(1)
    expect(h.zvuci).toEqual(['tap', 'novac'])
  })

  it('odloženi „novac": zakazan dok je zvuk UKLJUČEN, ne pušta se jer je pri puštanju ISKLJUČEN', async () => {
    const h = await mountApp({
      tajmeri: 'red',
      sejv: stanje({ mute: false, mag: { ...MAG0, psenica: 3 } }),
    })
    h.klik('nav [data-tab="pijaca"]')
    h.klik('[data-prodaj="psenica"]')
    h.klik('nav [data-tab="radnja"]')
    h.klik('#zvukDugme') // isključi
    h.pauza(NOVAC_ZVUK_ODLAGANJE_MS * 2)
    expect(h.zvuci).toEqual(['tap', 'tap'])
  })
})

describe('D13 kroz UI — neprekidna igra ipak piše', () => {
  it('tap koji traži čuvanje svakih 400 ms tokom 12 s: upis bar na SEJV_MAX_CEKANJE_MS, poslednji posle pauze', async () => {
    const h = await mountApp({ tajmeri: 'red', sejv: stanje() })
    const sk = h.skladiste
    if (!sk) throw new Error('nema skladišta')
    h.pauza(SEJV_ODLAGANJE_MS)
    h.klik('nav [data-tab="radnja"]')
    const pre = sk.upisi.length
    const pocetak = h.sad()
    for (let n = 0; n < 30; n++) {
      h.pauza(400) // perf (tajmeri) i sat igre idu zajedno, kao u browseru
      h.skok(400)
      h.klik('#zvukDugme') // prebacivanje zvuka traži odloženo čuvanje
    }
    // Prototip bez max-wait ne bi upisao NIŠTA dok tapovi traju (06#18).
    const tokom = sk.upisi
      .slice(pre)
      .map((u) => (JSON.parse(u.vrednost) as { videno: number }).videno)
    expect(tokom.length).toBeGreaterThanOrEqual(2)
    let prethodni = pocetak
    for (const v of tokom) {
      expect(v - prethodni).toBeLessThanOrEqual(SEJV_MAX_CEKANJE_MS)
      prethodni = v
    }
    h.pauza(SEJV_ODLAGANJE_MS)
    expect(h.sacuvano()).toEqual(JSON.parse(JSON.stringify(h.stanje())))
  })
})

describe('lifecycle — sakrivanje piše odmah', () => {
  it('odloženi zahtev na čekanju: sakrivanje piše TEKUĆE stanje odmah i otkazuje odloženi upis', async () => {
    const h = await mountApp({ tajmeri: 'red' })
    h.pauza(SEJV_ODLAGANJE_MS)
    const sk = h.skladiste
    if (!sk) throw new Error('nema skladišta')
    const pre = sk.upisi.length
    h.klik('.parcela.prazna')
    h.klik('[data-seme="psenica"]')
    h.skok(5000)
    expect(sk.upisi.length).toBe(pre) // debounce još čeka
    h.sakrij()
    expect(sk.upisi.length).toBe(pre + 1)
    expect(h.sacuvano()).toMatchObject({ novac: 40, sadio: true, videno: T0 + 5000 })
    h.pauza(SEJV_ODLAGANJE_MS * 5)
    expect(sk.upisi.length).toBe(pre + 1)
  })

  it('bez promena: sakrivanje ipak upisuje (videno = sada); posle ugasi() više ništa', async () => {
    const h = await mountApp({ sejv: stanje({ novac: 321 }) })
    const sk = h.skladiste
    if (!sk) throw new Error('nema skladišta')
    const pre = sk.upisi.length
    h.skok(42_000)
    h.sakrij()
    expect(sk.upisi.length).toBe(pre + 1)
    expect(h.sacuvano()).toMatchObject({ novac: 321, videno: T0 + 42_000 })
    h.app.ugasi()
    h.sakrij()
    expect(sk.upisi.length).toBe(pre + 1)
  })
})

describe('06#1 i 06#2 kroz DOM (D1, D2)', () => {
  it('06#1: tri tapa na zrelu pločicu pre crtanja posle 180 ms → jedna žetva, bez ključa „null", i u sejvu', async () => {
    const h = await mountApp({
      tajmeri: 'red',
      sejv: stanje({
        mute: false,
        parcele: [
          { c: 'psenica', t: T0 - 20_000, z: false },
          { c: null, t: 0, z: false },
        ],
      }),
    })
    const zrela = h.q('.parcela.zrelo')
    h.klik(zrela)
    h.pauza(60)
    h.klik(zrela)
    h.pauza(UBERI_CRTANJE_ODLAGANJE_MS - 61)
    expect(h.q('.parcela.zrelo')).toBe(zrela) // i dalje na ekranu
    h.klik(zrela)
    const s = h.stanje()
    expect(s.mag.psenica).toBe(1)
    expect(s.stat.ubrano).toBe(1)
    expect(s.xp).toBe(2)
    expect(Object.keys(s.mag).sort()).toEqual([...SVI_KLJUCEVI].sort())
    expect(h.zvuci).toEqual(['zetva'])
    expect(h.vibracije).toEqual([18])
    h.pauza(SEJV_ODLAGANJE_MS + 100)
    expect(h.q('.parcela.zrelo')).toBeNull()
    const sacuvano = h.sacuvano() as { mag: Record<string, unknown>; stat: { ubrano: number } }
    expect(Object.keys(sacuvano.mag).sort()).toEqual([...SVI_KLJUCEVI].sort())
    expect(sacuvano.stat.ubrano).toBe(1)
    expect(h.greske).toEqual([])
  })

  it('06#2: dupli tap na seme i tap na DRUGO seme dok se list zatvara → jedna naplata, prva kultura ostaje', async () => {
    const h = await mountApp({ tajmeri: 'red', sejv: stanje({ mute: false, novac: 100 }) })
    h.klik('.parcela[data-i="0"]')
    const psenica = h.q('[data-seme="psenica"]')
    const sargarepa = h.q('[data-seme="sargarepa"]')
    h.klik(psenica)
    const posle = JSON.stringify(h.stanje().parcele[0])
    h.pauza(60)
    h.skok(60)
    h.klik(psenica)
    h.pauza(60)
    h.skok(60)
    h.klik(sargarepa)
    expect(h.stanje().novac).toBe(90)
    expect(JSON.stringify(h.stanje().parcele[0])).toBe(posle)
    expect(h.zvuci).toEqual(['tap', 'sadnja'])
    expect(h.vibracije).toEqual([12])
  })
})
