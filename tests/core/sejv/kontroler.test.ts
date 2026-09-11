/*
 * SaveController (ugovor §5, 01 §h.4 S1–S9, D9, D10, D13). Lažno vreme: tajmeri po monotonom
 * vremenu, `now()` je zidni sat (lazni.ts). Boot u testovima ide redom iz ugovora §6:
 * ucitaj → igraIzStanja → osigurajNarudzbe → spreman → sacuvaj.
 *
 * Mutacije koje ovi testovi hvataju (proverene ručno nad kontrolerom):
 *  - bez max-wait (čist debounce, prototip L575)          → „svake sekunde 30 s" pada (1 upis)
 *  - videno pečatiran pri UPISU umesto pri zahtevu          → S2 (upisani videno ≠ vreme zahteva)
 *  - serijalizacija pri zahtevu umesto pri upisu            → S2 (promena posle zahteva nedostaje)
 *  - `odmah` ne otkazuje odloženi                           → S3 (drugi upis na +1200)
 *  - piše pre spreman() / pre kraja ucitaj()                → S5
 *  - rezerva posle prvog upisa ili bez nje                  → S8
 *  - `get` odbijen tretiran kao „nema sejva"                → D9 (nova igra pregazi sejv)
 *  - bez zaštite od sata unazad                             → nijedan upis 20 s posle −1 h
 */
import { describe, expect, it } from 'vitest'
import {
  KLJUC_REZERVE,
  KLJUC_SEJVA,
  SEJV_MAX_CEKANJE_MS,
  SEJV_ODLAGANJE_MS,
} from '../../../src/config'
import type { Igra } from '../../../src/core/dogadjaji'
import { igraIzStanja, novaIgra } from '../../../src/core/igra'
import { osigurajNarudzbe } from '../../../src/core/narudzbine'
import {
  SaveController,
  dekodirajSejv,
  kodirajSejv,
  type Rasporedjivac,
  type SkladisteSejva,
} from '../../../src/core/sejv'
import { pocetnoStanje } from '../../../src/core/stanje'
import type { Stanje } from '../../../src/core/types'
import { createLifecycle } from '../../../src/platform/lifecycle'
import { MemoryStorage, hostStorage, localStorageAdapter } from '../../../src/platform/storage'
import type { StorageAdapter, Timers } from '../../../src/platform/tipovi'
import { T0, mulberry32 } from '../../helpers'
import { bogatoStanje, json, v2Test4 } from './alati'
import { LaznoVreme, MemorijskoSkladiste, isprazniMikrotaskove } from './lazni'

const ODL = SEJV_ODLAGANJE_MS
const MAX = SEJV_MAX_CEKANJE_MS

interface Postavka {
  vreme: LaznoVreme
  sk: MemorijskoSkladiste
  k: SaveController
  /** Tekuća sesija; boot i reset je zamenjuju NOVIM objektom (kontroler je čita kroz getter). */
  sesija: { g: Igra }
  /** Boot po ugovoru §6 (bez UI-ja): vraća rezultat učitavanja. */
  boot(): Promise<Awaited<ReturnType<SaveController['ucitaj']>>>
}

function postavi(o: { pocetno?: Record<string, string>; bezSkladista?: boolean } = {}): Postavka {
  const vreme = new LaznoVreme(T0)
  const sk = new MemorijskoSkladiste(vreme, o.pocetno)
  // Pre učitavanja UI ima samo privremeno stanje; ono NIKAD ne sme da stigne u skladište.
  const sesija = { g: igraIzStanja(pocetnoStanje(0)) }
  const k = new SaveController({
    skladiste: o.bezSkladista ? null : sk,
    now: vreme.now,
    rasporedjivac: vreme,
    stanje: () => sesija.g.s,
  })
  return {
    vreme,
    sk,
    k,
    sesija,
    async boot() {
      const r = await k.ucitaj()
      sesija.g = igraIzStanja(r.dekodirano.stanje)
      osigurajNarudzbe(sesija.g, mulberry32(1))
      k.spreman()
      k.sacuvaj()
      return r
    },
  }
}

/** Boot, pa isprazni početni odloženi upis — posle ovoga nema ni jednog tajmera. */
async function podignuto(pocetno?: Record<string, string>): Promise<Postavka> {
  const p = postavi({ pocetno })
  await p.boot()
  p.vreme.napreduj(ODL)
  expect(p.vreme.aktivni()).toBe(0)
  return p
}

const razmaci = (x: readonly number[]): number[] => x.slice(1).map((v, i) => v - (x[i] ?? 0))

describe('portovi platforme zadovoljavaju portove kontrolera (strukturno, bez importa u core-u)', () => {
  it('StorageAdapter → SkladisteSejva, Timers → Rasporedjivac (proverava tsc)', () => {
    const skladiste: SkladisteSejva = new MemoryStorage() satisfies StorageAdapter
    const adapteri: SkladisteSejva[] = [
      hostStorage({ get: async () => null, set: async () => undefined }),
      localStorageAdapter({} as Storage),
    ]
    const tajmeri = (t: Timers): Rasporedjivac => t
    expect([skladiste, ...adapteri]).toHaveLength(3)
    expect(typeof tajmeri).toBe('function')
  })
})

describe('S1 — videno se pečatira pri SVAKOM zahtevu, i bez skladišta', () => {
  it('skladište null: ucitaj → prazan (bez greške, nije readOnly), sacuvaj samo pečatira videno', async () => {
    const p = postavi({ bezSkladista: true })
    const r = await p.boot()
    expect(r).toEqual({
      dekodirano: { vrsta: 'prazan', stanje: expect.anything() },
      greskaSkladista: false,
    })
    expect(p.k.readOnly()).toBe(false)
    expect(p.sesija.g.s.videno).toBe(T0)
    p.vreme.napreduj(5000)
    p.k.sacuvaj()
    expect(p.sesija.g.s.videno).toBe(T0 + 5000)
    p.vreme.napreduj(1)
    p.k.sacuvaj(true)
    expect(p.sesija.g.s.videno).toBe(T0 + 5001)
    expect(p.vreme.aktivni()).toBe(0) // ništa nije ni zakazano
    p.vreme.napreduj(60_000)
    expect(p.sk.upisi).toEqual([])
    expect(p.sk.getPozivi).toBe(0)
  })

  it('pre spreman(), i u readOnly sesiji: videno se i dalje pečatira (upisa nema)', async () => {
    const p = postavi()
    p.k.sacuvaj()
    expect(p.sesija.g.s.videno).toBe(T0)
    await p.k.ucitaj()
    p.vreme.napreduj(700)
    p.k.sacuvaj(true)
    expect(p.sesija.g.s.videno).toBe(T0 + 700)

    const b = postavi({ pocetno: { [KLJUC_SEJVA]: '{"v":4}' } })
    await b.boot()
    b.vreme.napreduj(900)
    b.k.sacuvaj()
    expect(b.sesija.g.s.videno).toBe(T0 + 900)
    expect([...p.sk.upisi, ...b.sk.upisi]).toEqual([])
  })
})

describe('S2 / D13 — debounce sa max-wait', () => {
  it('3 zahteva u 1200 ms → 0 upisa na +1199 posle poslednjeg, tačno 1 na +1200', async () => {
    const p = await podignuto()
    p.k.sacuvaj()
    p.vreme.napreduj(400)
    p.k.sacuvaj()
    p.vreme.napreduj(400)
    p.k.sacuvaj()
    const poslednji = p.vreme.now()
    p.vreme.napreduj(ODL - 1)
    expect(p.sk.upisiSejva()).toHaveLength(1) // samo boot
    p.vreme.napreduj(1)
    expect(p.sk.upisiSejva()).toHaveLength(2)
    expect(p.sk.upisiSejva()[1]?.vreme).toBe(poslednji + ODL)
    p.vreme.napreduj(60_000)
    expect(p.sk.upisiSejva()).toHaveLength(2)
  })

  it('upisani videno = vreme POSLEDNJEG zahteva; promena posle zahteva (pre upisa) JE upisana', async () => {
    const p = await podignuto()
    p.k.sacuvaj()
    p.vreme.napreduj(300)
    p.k.sacuvaj()
    const zahtev = p.vreme.now()
    p.vreme.napreduj(500)
    p.sesija.g.s.novac = 4321 // bez novog zahteva
    p.vreme.napreduj(ODL)
    const s = p.sk.sacuvano()
    expect(s?.videno).toBe(zahtev)
    expect(s?.novac).toBe(4321)
    expect(p.sesija.g.s.videno).toBe(zahtev) // upis ga ne menja
  })

  it('usamljen zahtev → tačno jedan upis 1200 ms kasnije, nijedan na 1199', async () => {
    const p = await podignuto()
    p.vreme.napreduj(10_000)
    const t = p.vreme.now()
    p.k.sacuvaj()
    p.vreme.napreduj(ODL - 1)
    expect(p.sk.upisiSejva()).toHaveLength(1)
    p.vreme.napreduj(1)
    expect(p.sk.upisiSejva().map((u) => u.vreme)).toEqual([T0 + ODL, t + ODL])
    p.vreme.napreduj(3600_000)
    expect(p.sk.upisiSejva()).toHaveLength(2)
  })

  it('zahtev svake sekunde 30 s → upis na svakih 5 s (prototip: nijedan dok igra traje)', async () => {
    const p = await podignuto()
    const pocetak = p.vreme.monotono()
    const pre = p.sk.upisiSejva().length
    for (let i = 0; i <= 30; i++) {
      p.sesija.g.s.novac = i
      p.k.sacuvaj()
      p.vreme.napreduj(1000)
    }
    const tokom = p.sk.upisiSejva().slice(pre)
    expect(tokom.map((u) => u.mono - pocetak)).toEqual([
      5000, 10_000, 15_000, 20_000, 25_000, 30_000,
    ])
    // svaki upis nosi stanje iz trenutka upisa i videno poslednjeg zahteva pre njega
    expect(tokom.map((u) => (JSON.parse(u.vrednost) as Stanje).novac)).toEqual([
      4, 9, 14, 19, 24, 29,
    ])
    expect(tokom.map((u) => (JSON.parse(u.vrednost) as Stanje).videno - T0 - pocetak)).toEqual([
      4000, 9000, 14_000, 19_000, 24_000, 29_000,
    ])
    p.vreme.napreduj(60_000)
    const sve = p.sk
      .upisiSejva()
      .slice(pre)
      .map((u) => u.mono - pocetak)
    expect(sve.at(-1)).toBe(30_000 + ODL) // poslednji zahtev dobija svoj debounce
    expect(Math.max(...razmaci([0, ...sve]))).toBeLessThanOrEqual(MAX)
    expect(p.sk.sacuvano()?.novac).toBe(30)
  })

  it('zahtevi u neparnim trenucima (svakih 700 ms, 20 s): razmak između upisa nikad > 5 s', async () => {
    const p = await podignuto()
    const pocetak = p.vreme.monotono()
    const pre = p.sk.upisiSejva().length
    for (let t = 0; t < 20_000; t += 700) {
      p.k.sacuvaj()
      p.vreme.napreduj(700)
    }
    p.vreme.napreduj(60_000)
    const mono = p.sk
      .upisiSejva()
      .slice(pre)
      .map((u) => u.mono - pocetak)
    expect(mono.length).toBeGreaterThanOrEqual(4)
    expect(Math.max(...razmaci([0, ...mono]))).toBeLessThanOrEqual(MAX)
  })

  it('prigušeni tajmeri (pozadinski tab): zahtev posle isteka max-wait upisuje ODMAH', async () => {
    const p = await podignuto()
    const pre = p.sk.upisiSejva().length
    for (let i = 0; i < 5; i++) {
      p.k.sacuvaj()
      p.vreme.skok(1000) // tajmer za +1200 nikad ne okine
    }
    expect(p.sk.upisiSejva()).toHaveLength(pre)
    p.k.sacuvaj() // 5000 ms od početka niza
    expect(p.sk.upisiSejva()).toHaveLength(pre + 1)
    expect(p.vreme.aktivni()).toBe(0)
  })

  it('odloženi upis je zakasnio (uređaj spavao 1 min): sledeći zahtev upisuje odmah, ne odlaže opet', async () => {
    const p = await podignuto()
    const pre = p.sk.upisiSejva().length
    p.k.sacuvaj()
    p.vreme.skok(60_000)
    p.sesija.g.s.novac = 99
    p.k.sacuvaj()
    expect(p.sk.upisiSejva()).toHaveLength(pre + 1)
    expect(p.sk.sacuvano()?.novac).toBe(99)
    expect(p.vreme.aktivni()).toBe(0)
    p.vreme.napreduj(60_000)
    expect(p.sk.upisiSejva()).toHaveLength(pre + 1)
  })
})

describe('D13 — sat na uređaju pomeren usred igre', () => {
  it('sat vraćen 1 h unazad usred neprekidne igre: upis odmah, pa opet najviše na 5 s', async () => {
    const p = await podignuto()
    const pocetak = p.vreme.monotono()
    const pre = p.sk.upisiSejva().length
    for (let i = 0; i < 3; i++) {
      p.k.sacuvaj()
      p.vreme.napreduj(1000)
    }
    p.vreme.pomeriSat(-3_600_000)
    for (let i = 0; i < 20; i++) {
      p.k.sacuvaj()
      p.vreme.napreduj(1000)
    }
    const mono = p.sk
      .upisiSejva()
      .slice(pre)
      .map((u) => u.mono - pocetak)
    expect(mono[0]).toBe(3000) // prvi zahtev posle vraćanja sata
    expect(mono.length).toBeGreaterThanOrEqual(5)
    expect(Math.max(...razmaci([0, ...mono]))).toBeLessThanOrEqual(MAX)
  })

  it('sat vraćen iza poslednjeg UPISA (ali ne iza poslednjeg zahteva) → upis odmah', async () => {
    const p = await podignuto()
    const pre = p.sk.upisiSejva().length
    p.k.sacuvaj()
    p.vreme.napreduj(ODL) // upis na +1200 (sidro)
    expect(p.sk.upisiSejva()).toHaveLength(pre + 1)
    p.vreme.pomeriSat(-500) // zidni sat: posle zahteva, pre upisa
    p.k.sacuvaj()
    expect(p.sk.upisiSejva()).toHaveLength(pre + 2)
  })

  it('sat pomeren 1 h napred dok upis čeka: sledeći zahtev ga upisuje odmah', async () => {
    const p = await podignuto()
    const pre = p.sk.upisiSejva().length
    p.k.sacuvaj()
    p.vreme.napreduj(500)
    p.vreme.pomeriSat(3_600_000)
    p.k.sacuvaj()
    expect(p.sk.upisiSejva()).toHaveLength(pre + 1)
    expect(p.sk.sacuvano()?.videno).toBe(T0 + ODL + 500 + 3_600_000)
  })
})

describe('S3 — odmah', () => {
  it('upisuje odmah i otkazuje odloženi (nema drugog upisa na +1200)', async () => {
    const p = await podignuto()
    const pre = p.sk.upisiSejva().length
    p.k.sacuvaj()
    p.vreme.napreduj(500)
    p.k.sacuvaj(true)
    expect(p.sk.upisiSejva()).toHaveLength(pre + 1)
    expect(p.sk.upisiSejva().at(-1)?.vreme).toBe(p.vreme.now())
    expect(p.vreme.aktivni()).toBe(0)
    p.vreme.napreduj(60_000)
    expect(p.sk.upisiSejva()).toHaveLength(pre + 1)
  })

  it('svaki odmah je jedan upis; bez odloženog tajmera', async () => {
    const p = await podignuto()
    const pre = p.sk.upisiSejva().length
    p.k.sacuvaj(true)
    p.k.sacuvaj(true)
    expect(p.sk.upisiSejva()).toHaveLength(pre + 2)
    expect(p.vreme.aktivni()).toBe(0)
  })
})

class LazniDokument extends EventTarget {
  hidden = false
}

describe('S4 — odlazak u pozadinu (lifecycle.onHidden → sacuvaj(true))', () => {
  it('visibilitychange: skriven → upis odmah; vidljiv → ništa; pagehide → upis odmah', async () => {
    const p = await podignuto()
    const dokument = new LazniDokument()
    const prozor = new EventTarget()
    createLifecycle(() => ({ dokument, prozor })).onHidden(() => p.k.sacuvaj(true))
    const pre = p.sk.upisiSejva().length
    dokument.dispatchEvent(new Event('visibilitychange'))
    expect(p.sk.upisiSejva()).toHaveLength(pre)
    dokument.hidden = true
    dokument.dispatchEvent(new Event('visibilitychange'))
    expect(p.sk.upisiSejva()).toHaveLength(pre + 1)
    prozor.dispatchEvent(new Event('pagehide'))
    expect(p.sk.upisiSejva()).toHaveLength(pre + 2)
    expect(p.vreme.aktivni()).toBe(0)
  })
})

describe('S5 / D9 — pre kraja učitavanja se ništa ne piše', () => {
  it('sporo skladište: sacuvaj / sacuvaj(true) / sakrivanje / čak i spreman() pre kraja ucitaj → 0 upisa', async () => {
    const pravi = JSON.stringify(bogatoStanje())
    const p = postavi({ pocetno: { [KLJUC_SEJVA]: pravi } })
    const dokument = new LazniDokument()
    createLifecycle(() => ({ dokument, prozor: new EventTarget() })).onHidden(() =>
      p.k.sacuvaj(true),
    )
    p.sk.zadrziGet = true
    const ucitavanje = p.k.ucitaj()
    p.k.sacuvaj()
    p.k.sacuvaj(true)
    dokument.hidden = true
    dokument.dispatchEvent(new Event('visibilitychange'))
    p.k.spreman() // pogrešan redosled u UI-ju: i dalje ništa dok se učitavanje ne završi
    p.k.sacuvaj(true)
    p.vreme.napreduj(10_000)
    expect(p.sk.upisi).toEqual([])
    expect(p.sk.mapa.get(KLJUC_SEJVA)).toBe(pravi)

    p.sk.pustiGet()
    const r = await ucitavanje
    expect(r.dekodirano.vrsta).toBe('ok')
    p.sesija.g = igraIzStanja(r.dekodirano.stanje)
    p.k.sacuvaj(true)
    expect(p.sk.upisiSejva()).toHaveLength(1)
    expect(p.sk.sacuvano()?.novac).toBe(bogatoStanje().novac)
  })

  it('bez spreman(): ni posle učitavanja se ne piše (UI poziva spreman tek posle boot koraka)', async () => {
    const p = postavi()
    const r = await p.k.ucitaj()
    p.sesija.g = igraIzStanja(r.dekodirano.stanje)
    p.k.sacuvaj()
    p.k.sacuvaj(true)
    p.vreme.napreduj(10_000)
    expect(p.sk.upisi).toEqual([])
    p.k.spreman()
    p.k.sacuvaj(true)
    expect(p.sk.upisiSejva()).toHaveLength(1)
  })

  it('ucitaj dekodira sa `pre` = trenutak PRE čitanja (sejv bez videno ne daje lažnu dobrodošlicu)', async () => {
    const bezVidjeno: Record<string, unknown> = { ...json(bogatoStanje()) }
    delete bezVidjeno.videno
    const p = postavi({ pocetno: { [KLJUC_SEJVA]: JSON.stringify(bezVidjeno) } })
    p.sk.zadrziGet = true
    const ucitavanje = p.k.ucitaj()
    p.vreme.napreduj(5000) // čitanje traje 5 s
    p.sk.pustiGet()
    const r = await ucitavanje
    expect(r.dekodirano.stanje.videno).toBe(T0)

    const prazno = postavi()
    prazno.sk.zadrziGet = true
    const u2 = prazno.k.ucitaj()
    prazno.vreme.napreduj(3000)
    prazno.sk.pustiGet()
    expect((await u2).dekodirano).toEqual({ vrsta: 'prazan', stanje: pocetnoStanje(T0) })
  })
})

describe('S6 — upis koji ne uspe', () => {
  it('odbijen set: bez bacanja i bez „unhandled rejection"; sledeći zahtev pokušava ponovo', async () => {
    const p = await podignuto()
    const pre = p.sk.mapa.get(KLJUC_SEJVA)
    p.sk.setOdbija = 1
    p.sesija.g.s.novac = 777
    expect(() => p.k.sacuvaj(true)).not.toThrow()
    await isprazniMikrotaskove()
    expect(p.sk.mapa.get(KLJUC_SEJVA)).toBe(pre)
    p.k.sacuvaj(true)
    expect(p.sk.sacuvano()?.novac).toBe(777)
  })

  it('odbijen odloženi upis: sledeći odloženi zahtev ga ponavlja', async () => {
    const p = await podignuto()
    p.sk.setOdbija = 1
    p.sesija.g.s.novac = 555
    p.k.sacuvaj()
    p.vreme.napreduj(ODL)
    await isprazniMikrotaskove()
    expect(p.sk.sacuvano()?.novac).not.toBe(555)
    p.k.sacuvaj()
    p.vreme.napreduj(ODL)
    expect(p.sk.sacuvano()?.novac).toBe(555)
  })

  it('set koji baca SINHRONO: ni odmah ni iz tajmera ne izlazi izuzetak', async () => {
    const p = await podignuto()
    p.sk.setBaca = true
    expect(() => p.k.sacuvaj(true)).not.toThrow()
    p.k.sacuvaj()
    expect(() => p.vreme.napreduj(ODL)).not.toThrow()
    p.sk.setBaca = false
    p.sesija.g.s.novac = 321
    p.k.sacuvaj(true)
    expect(p.sk.sacuvano()?.novac).toBe(321)
  })
})

describe('S7 — reset kroz kontroler', () => {
  it('novaIgra (D6) + sacuvaj(true): jedan trenutni upis NOVOG objekta, odloženi otkazan', async () => {
    const p = await podignuto({ [KLJUC_SEJVA]: JSON.stringify(bogatoStanje()) })
    expect(p.sesija.g.s.novac).toBe(bogatoStanje().novac)
    p.k.sacuvaj() // igra je nešto uradila; upis čeka
    const stara = p.sesija.g
    p.vreme.napreduj(300)
    const now = p.vreme.now()
    p.sesija.g = novaIgra(now, mulberry32(9), { mute: stara.s.mute, poklonDan: stara.s.poklonDan })
    const pre = p.sk.upisiSejva().length
    p.k.sacuvaj(true)
    expect(p.sk.upisiSejva()).toHaveLength(pre + 1)
    const s = p.sk.sacuvano()
    expect(s).toEqual({
      ...pocetnoStanje(now),
      mute: true, // D6
      poklonDan: bogatoStanje().poklonDan, // D6
      narudzbe: p.sesija.g.s.narudzbe,
      videno: now,
    })
    expect(s?.narudzbe.map((o) => o.id)).toEqual([1, 2])
    expect(p.sesija.g.brojacN).toBe(3)
    expect(p.sesija.g.prosliNivo).toBe(1)
    expect(stara.s.videno).not.toBe(now) // stari objekat se više ne dira
    p.vreme.napreduj(60_000)
    expect(p.sk.upisiSejva()).toHaveLength(pre + 1)
  })
})

describe('S8 / D9 / D10 — rezerva originala i readOnly', () => {
  it.each([
    ['nevažeći JSON', '{"v":3,"novac":', 'json'],
    ['JSON null', 'null', 'nije-objekat'],
    ['niz', '[]', 'nije-objekat'],
    ['broj', '5', 'nije-objekat'],
    ['v: 1', '{"v":1,"novac":999}', 'verzija'],
    ['v: "3"', '{"v":"3","novac":999}', 'verzija'],
  ])(
    'neispravan (%s) → sirovo u rezervu PRE prvog upisa sejva, pa nova igra',
    async (_o, raw, razlog) => {
      const p = postavi({ pocetno: { [KLJUC_SEJVA]: raw } })
      const r = await p.boot()
      expect(r.greskaSkladista).toBe(false)
      expect(r.dekodirano).toMatchObject({ vrsta: 'neispravan', razlog })
      expect(p.k.readOnly()).toBe(false)
      expect(p.sk.upisi.map((u) => u.kljuc)).toEqual([KLJUC_REZERVE]) // boot upis još čeka
      expect(p.sk.mapa.get(KLJUC_REZERVE)).toBe(raw) // bajt za bajt
      p.vreme.napreduj(ODL)
      expect(p.sk.upisi.map((u) => u.kljuc)).toEqual([KLJUC_REZERVE, KLJUC_SEJVA])
      const novo = dekodirajSejv(p.sk.mapa.get(KLJUC_SEJVA) ?? null, T0)
      expect(novo).toMatchObject({ vrsta: 'ok', popravke: [] })
      expect(p.sk.mapa.get(KLJUC_REZERVE)).toBe(raw)
    },
  )

  it('ok sa popravkama (nepoznat ključ, oštećena parcela) → rezerva; stanje je ispravljeno', async () => {
    const raw = JSON.stringify({ ...json(bogatoStanje()), tursija: 7, parcele: [null, null] })
    const p = postavi({ pocetno: { [KLJUC_SEJVA]: raw } })
    const r = await p.boot()
    expect(r.dekodirano.vrsta).toBe('ok')
    expect(r.dekodirano.vrsta === 'ok' && r.dekodirano.popravke.length).toBeGreaterThan(0)
    expect(p.sk.upisi.map((u) => u.kljuc)).toEqual([KLJUC_REZERVE])
    expect(p.sk.mapa.get(KLJUC_REZERVE)).toBe(raw)
    p.vreme.napreduj(ODL)
    expect(p.sk.sacuvano()?.parcele).toEqual([
      { c: null, t: 0, z: false },
      { c: null, t: 0, z: false },
    ])
  })

  it.each([
    ['čist v3', () => JSON.stringify(bogatoStanje())],
    ['čist v2 (TEST 4): premeštanje kazan/ko nije gubitak', () => JSON.stringify(v2Test4())],
  ])('%s → bez rezerve, normalan rad', async (_o, sirovo) => {
    const p = await podignuto({ [KLJUC_SEJVA]: sirovo() })
    expect(p.sk.upisiRezerve()).toEqual([])
    expect(p.sk.upisiSejva()).toHaveLength(1)
    expect(p.sk.mapa.has(KLJUC_REZERVE)).toBe(false)
  })

  it('ključ ne postoji (nova igra) → bez rezerve; prvi upis je nova igra', async () => {
    const p = await podignuto()
    expect(p.sk.upisi.map((u) => u.kljuc)).toEqual([KLJUC_SEJVA])
    expect(p.sk.sacuvano()?.narudzbe.map((o) => o.id)).toEqual([1, 2])
  })

  it('buduci (v: 4) → readOnly; original se nikad ne dira (ni rezerva, ni sejv)', async () => {
    const raw = JSON.stringify({ ...json(bogatoStanje()), v: 4, novoPolje: [1, 2, 3] })
    const p = postavi({ pocetno: { [KLJUC_SEJVA]: raw } })
    const r = await p.boot()
    expect(r).toMatchObject({ greskaSkladista: false, dekodirano: { vrsta: 'buduci', verzija: 4 } })
    expect(p.k.readOnly()).toBe(true)
    p.k.sacuvaj()
    p.k.sacuvaj(true)
    p.vreme.napreduj(3_600_000)
    expect(p.sk.upisi).toEqual([])
    expect(p.sk.mapa.get(KLJUC_SEJVA)).toBe(raw)
  })

  it('get odbijen (kvar, ne „nema ključa") → greskaSkladista, početno stanje, 0 upisa cele sesije', async () => {
    const raw = JSON.stringify(bogatoStanje())
    const p = postavi({ pocetno: { [KLJUC_SEJVA]: raw } })
    p.sk.getOdbija = true
    const r = await p.k.ucitaj()
    expect(r).toEqual({
      dekodirano: { vrsta: 'prazan', stanje: pocetnoStanje(T0) },
      greskaSkladista: true,
    })
    expect(p.k.readOnly()).toBe(true)
    p.sesija.g = igraIzStanja(r.dekodirano.stanje)
    osigurajNarudzbe(p.sesija.g, mulberry32(1))
    p.k.spreman()
    for (let i = 0; i < 10; i++) {
      p.k.sacuvaj(i % 3 === 0)
      p.vreme.napreduj(2000)
    }
    expect(p.sk.upisi).toEqual([])
    expect(p.sk.getPozivi).toBe(1)
    expect(p.sk.mapa.get(KLJUC_SEJVA)).toBe(raw)
  })

  it.each([
    ['odbija', (sk: MemorijskoSkladiste) => (sk.setOdbija = 1)],
    ['baca sinhrono', (sk: MemorijskoSkladiste) => (sk.setBaca = true)],
  ])(
    'rezerva ne može da se upiše (set %s) → greskaSkladista + readOnly; original ostaje',
    async (_o, kvar) => {
      const raw = '{"v":3,"novac":123456,"xp":'
      const p = postavi({ pocetno: { [KLJUC_SEJVA]: raw } })
      kvar(p.sk)
      const r = await p.boot()
      expect(r.greskaSkladista).toBe(true)
      expect(r.dekodirano.vrsta).toBe('neispravan')
      expect(p.k.readOnly()).toBe(true)
      p.sk.setOdbija = 0
      p.sk.setBaca = false
      p.k.sacuvaj(true)
      p.vreme.napreduj(60_000)
      expect(p.sk.upisiSejva()).toEqual([])
      expect(p.sk.mapa.get(KLJUC_SEJVA)).toBe(raw)
    },
  )
})

describe('sinhroni raspoređivač (referenca-sim režim UI testova: setTimeout = `cb(); return 0`)', () => {
  it('svaki odloženi zahtev je odmah upisan i ne ostaje „zakazan" tajmer koji ne postoji', async () => {
    const vreme = new LaznoVreme(T0)
    const sk = new MemorijskoSkladiste(vreme)
    const otkazani: number[] = []
    const sinhroni: Rasporedjivac = {
      setTimeout: (cb) => {
        cb()
        return 0
      },
      clearTimeout: (id) => otkazani.push(id),
    }
    const sesija = { g: igraIzStanja(pocetnoStanje(T0)) }
    const k = new SaveController({
      skladiste: sk,
      now: vreme.now,
      rasporedjivac: sinhroni,
      stanje: () => sesija.g.s,
    })
    await k.ucitaj()
    k.spreman()
    for (let i = 0; i < 3; i++) {
      sesija.g.s.novac = 100 + i
      k.sacuvaj()
      expect(sk.sacuvano()?.novac).toBe(100 + i)
      vreme.skok(i === 1 ? 5000 : 300)
    }
    expect(sk.upisiSejva()).toHaveLength(3)
    k.ocisti()
    k.sacuvaj(true)
    expect(otkazani).toEqual([]) // nijedan clearTimeout nad id-jem tajmera koji je već okinuo
  })
})

describe('ocisti / readOnly', () => {
  it('ocisti otkazuje odloženi upis; kontroler posle toga radi normalno', async () => {
    const p = await podignuto()
    const pre = p.sk.upisiSejva().length
    p.k.sacuvaj()
    expect(p.vreme.aktivni()).toBe(1)
    p.k.ocisti()
    expect(p.vreme.aktivni()).toBe(0)
    p.vreme.napreduj(60_000)
    expect(p.sk.upisiSejva()).toHaveLength(pre)
    p.k.ocisti() // bez tajmera: bezopasno
    p.k.sacuvaj()
    p.vreme.napreduj(ODL)
    expect(p.sk.upisiSejva()).toHaveLength(pre + 1)
    expect(p.k.readOnly()).toBe(false)
  })

  it('kodirajSejv pri upisu: skladište dobija tačno JSON tekućeg stanja', async () => {
    const p = await podignuto({ [KLJUC_SEJVA]: JSON.stringify(bogatoStanje()) })
    p.k.sacuvaj(true)
    expect(p.sk.mapa.get(KLJUC_SEJVA)).toBe(kodirajSejv(p.sesija.g.s))
  })
})
