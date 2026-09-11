// @vitest-environment node
/*
 * DOM paritet porta sa prototipom (04 §7.5 — najjači čuvar šablona i redosleda).
 *
 * Dva jsdom-a jedan pored drugog: ZAKRPLJEN prototip (tools/parity/zakrpe.ts = D1–D6, D8, D12 +
 * tests/ui/zakrpe-ui.ts = D14, D16, D17, ugovor §6) i port (mountApp). Isti sejv, isti sat (T0), isti
 * rng narudžbina (mulberry32(seme)) i efekata (mulberry32(seme ^ 0x9e3779b9)), isti skriptovani i
 * nasumični dostupni tapovi, tikovi i skokovi sata. Posle SVAKOG koraka moraju biti isti:
 *   innerHTML `#app` (scena, HUD, svi tabovi, nav), `#semena`, `#nivoKartica`; klase #nivoVeo/#veo/#list/
 *   #toast; tekst `#toast`; FX čvorovi u body-ju (.letac/.plusxp/.konfeta, sa stilovima iz fxRandom-a);
 *   stanje igre, brojacN, prosliNivo; niz puštenih zvukova (posle provere `mute`) i vibracija.
 * Sejv (parsiran) mora biti isti kad su obe strane upisale: u režimu 'odmah' posle svakog koraka, u
 * režimu 'red' posle „smirivanja" (≥ SEJV_ODLAGANJE_MS bez zahteva) — D13 menja samo TRENUTAK upisa.
 *
 * Nema normalizacije DOM-a: sva odobrena DOM odstupanja su zakrpljena u oraklu. Jedina projekcija je D11
 * (v2 ključevi `kazan`/`kazanT` koje prototip nosi zauvek) — samo u stanju i sejvu.
 *
 * Tajmeri: 'odmah' = kao referenca-sim (setTimeout se izvršava odmah); 'red' = na obe strane tajmeri
 * čekaju i pomeraju se ZAJEDNO (180 ms crtanje posle žetve, savet posle 700 ms, sakrivanje toasta,
 * uklanjanje FX-a, zvuk novca posle 480 ms, debounce sejva). D15: pre svakog tapa na obe strane protekne
 * ≥ RAZMAK_MIN ms (i perf vreme porta i sat igre), pa zaključavanja oblasti nikad ne progutaju tap.
 * Izuzetak je `dupliTap` (D1/D2), i to samo u oblastima koje D15 ne zaključava (seme, zrela parcela).
 *
 * Node okruženje (ne jsdom): obe strane dobijaju SVOJ JSDOM prozor (prototip preko pomoćnika, port preko
 * `mountApp({ doc })`), pa globalni jsdom nije potreban.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'
import { describe, expect, it } from 'vitest'
import { KLJUC_SEJVA, SEJV_ODLAGANJE_MS, ZAKLJUCAVANJE_TAPA_MS } from '../../src/config'
import { START_V2 } from '../../tools/parity/scenariji'
import { oraklHtml } from '../../tools/parity/tragovi'
import { MAG0, T0, mulberry32, narudzba, stanje } from '../helpers'
import { mountApp, type Montirana } from '../helpers/mountApp'
import { primeniZakrpe, ucitajPrototip, type Prototip } from '../helpers/prototip'
import { dostupniTapovi, izaberi, type Tap } from './dostupno'
import { INSTRUMENT_UI, zakrpeUi } from './zakrpe-ui'

// Putanja od ovog fajla (ne `new URL(…, import.meta.url)`, koji Vite prepisuje u jsdom okruženju).
const PAKET = resolve(dirname(fileURLToPath(import.meta.url)), '../../package.json')
const VERZIJA = (JSON.parse(readFileSync(PAKET, 'utf8')) as { version: string }).version
const ORAKL = primeniZakrpe(oraklHtml(), [...zakrpeUi(VERZIJA), ...INSTRUMENT_UI])

/** Najmanji razmak između dva tapa (D15 zaključava oblast ZAKLJUCAVANJE_TAPA_MS). */
const RAZMAK_MIN = 350
/** Razmaci pre tapa u nasumičnom hodu: pogađaju prozore 480 ms (zvuk), 700 (savet), 800 (kapi),
 *  900 (+XP), 1200 (sejv), 2300 (toast). */
const RAZMACI = [350, 400, 480, 650, 800, 1000, 1300, 2400] as const
const MIN = 60_000
const SAT = 60 * MIN

type Rezim = 'odmah' | 'red'

// ── Snimak ─────────────────────────────────────────────────────────────────────

/** JSON sa sortiranim ključevima (prototip i port grade objekte različitim redosledom). */
function kanon(x: unknown): string {
  return JSON.stringify(x, (_k, v: unknown) =>
    v !== null && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  )
}

/** D11: v2 ključevi koje prototip prenosi zauvek (06#13), a port izbacuje. */
function bezD11(o: unknown): unknown {
  if (o === null || typeof o !== 'object' || Array.isArray(o)) return o
  const c: Record<string, unknown> = { ...(o as Record<string, unknown>) }
  delete c.kazan
  delete c.kazanT
  return c
}

interface Snimak {
  app: string
  semena: string
  kartica: string
  klase: string
  toast: string
  fx: string
  stanje: string
  brojacN: number
  prosliNivo: number
  zvuci: string
  vibracije: string
}

const FX = new Set(['letac', 'plusxp', 'konfeta'])

function snimakDom(
  d: Document,
): Pick<Snimak, 'app' | 'semena' | 'kartica' | 'klase' | 'toast' | 'fx'> {
  const html = (s: string) => d.querySelector(s)?.innerHTML ?? '∅'
  const klase = (s: string) => d.querySelector(s)?.className ?? '∅'
  return {
    app: html('#app'),
    semena: html('#semena'),
    kartica: html('#nivoKartica'),
    klase: ['#nivoVeo', '#veo', '#list', '#toast'].map(klase).join('|'),
    toast: d.querySelector('#toast')?.textContent ?? '∅',
    fx: [...d.body.children]
      .filter((e) => FX.has(e.className))
      .map((e) => e.outerHTML)
      .join('\n'),
  }
}

function snimakPrototipa(p: Prototip): Snimak {
  return {
    ...snimakDom(p.d),
    stanje: kanon(bezD11(p.S())),
    brojacN: p.ev<number>('brojacN'),
    prosliNivo: p.ev<number>('prosliNivo'),
    zvuci: p.ev<string>('JSON.stringify(window.__zvuci||[])'),
    vibracije: p.ev<string>('JSON.stringify(window.__vibracije||[])'),
  }
}

function snimakPorta(h: Montirana, d: Document): Snimak {
  return {
    ...snimakDom(d),
    stanje: kanon(JSON.parse(JSON.stringify(h.stanje()))),
    brojacN: h.igra().brojacN,
    prosliNivo: h.igra().prosliNivo,
    zvuci: JSON.stringify(h.zvuci),
    vibracije: JSON.stringify(h.vibracije.map((v) => JSON.stringify(v))),
  }
}

/** Čitljiva odstupanja: za svako polje prvo mesto razlike i okolina. */
function odstupanja(proto: Snimak, port: Snimak): string[] {
  const out: string[] = []
  for (const k of Object.keys(proto) as (keyof Snimak)[]) {
    const a = String(proto[k])
    const b = String(port[k])
    if (a === b) continue
    let i = 0
    while (i < a.length && i < b.length && a[i] === b[i]) i++
    const okolina = (s: string) => s.slice(Math.max(0, i - 160), i + 200)
    out.push(`${k} @${i}\n  prototip: …${okolina(a)}…\n  port:     …${okolina(b)}…`)
  }
  return out
}

// ── Par ────────────────────────────────────────────────────────────────────────

interface Par {
  readonly p: Prototip
  readonly h: Montirana
  /** Protekne `dt` ms na obe strane: dospeli tajmeri, pa sat igre (i perf vreme porta). */
  vreme(dt: number): void
  /** Tap na `qa(sel)[i]` na obe strane posle razmaka `dt` (≥ RAZMAK_MIN). Element mora postojati na obe
   *  strane ili ni na jednoj; vraća da li postoji. */
  klik(sel: string, i?: number, dt?: number): Promise<boolean>
  /** Tap odmah (razmak je već protekao preko `vreme`). */
  tapSada(sel: string, i: number): Promise<boolean>
  /** Isti (zastareli) element prethodnog tapa, posle `dt` ms — samo seme ili zrela parcela (D2/D1). */
  dupliTap(dt: number): Promise<void>
  /** Sat napred `ms`, pa jedan otkucaj. */
  tik(ms?: number): void
  /** Samo sat (bez otkucaja): DOM ostaje star do sledećeg ticka ili crtanja. */
  skok(ms: number): void
  /** ≥ SEJV_ODLAGANJE_MS bez zahteva: obe strane su upisale — sejvovi se porede. */
  smiri(): void
  zatvori(): Promise<void>
  ima(sel: string): boolean
  /** Završne provere i gašenje prozora. Vraća broj uporedjenih koraka i sejvova. */
  kraj(): { koraka: number; sejvova: number }
}

async function napraviPar(sejv: object | null, seme: number, rezim: Rezim): Promise<Par> {
  const raw = sejv === null ? null : JSON.stringify(sejv)
  const s = seme >>> 0
  const p = await ucitajPrototip({
    html: ORAKL,
    t0: T0,
    tajmeri: rezim,
    skladiste: raw === null ? {} : { [KLJUC_SEJVA]: raw },
    random: mulberry32(s ^ 0x9e3779b9),
    rngNarudzbina: mulberry32(s),
  })
  const prozor = new JSDOM('<!DOCTYPE html><html lang="sr"><head></head><body></body></html>')
    .window
  const doc = prozor.document
  const h = await mountApp({
    doc,
    sejv: raw,
    t0: T0,
    tajmeri: rezim,
    random: mulberry32(s),
    fxRandom: mulberry32(s ^ 0x9e3779b9),
  })

  let koraka = 0
  let sejvova = 0
  const istorija: string[] = []
  let poslednji: { a: HTMLElement; b: HTMLElement; opis: string } | null = null

  const sejvPrototipa = (): string | null => {
    const v = p.w.__mem[KLJUC_SEJVA]
    return v === undefined ? null : kanon(bezD11(JSON.parse(v)))
  }
  const sejvPorta = (): string | null => {
    const v = h.skladiste?.podaci.get(KLJUC_SEJVA)
    return v === undefined ? null : kanon(JSON.parse(v))
  }
  const uporediSejv = (opis: string) => {
    const a = sejvPrototipa()
    const b = sejvPorta()
    expect(a !== null && b !== null, `${opis}: obe strane su upisale sejv`).toBe(true)
    expect(b, `${opis}: sejv porta = sejv prototipa`).toBe(a)
    expect(b, `${opis}: sejv porta = tekuće stanje`).toBe(
      kanon(JSON.parse(JSON.stringify(h.stanje()))),
    )
    sejvova++
  }
  const uporedi = (opis: string) => {
    koraka++
    istorija.push(opis)
    if (istorija.length > 14) istorija.shift()
    const kontekst = `korak ${koraka} (${opis}); prethodni: ${istorija.slice(0, -1).join(' → ')}`
    expect(odstupanja(snimakPrototipa(p), snimakPorta(h, doc)), kontekst).toEqual([])
    expect(p.greske, `greške prototipa — ${kontekst}`).toEqual([])
    expect(h.greske, `greške porta — ${kontekst}`).toEqual([])
    if (rezim === 'odmah') uporediSejv(kontekst)
  }

  const vreme = (dt: number) => {
    // Oba harnesa okidaju tajmere redom po roku i tajmer zakazan IZ tajmera (savet posle 700 ms →
    // sakrivanje toasta za 2300 ms) računaju od trenutka okidanja, kao browser.
    p.tajmeri(dt)
    p.skok(dt)
    h.pauza(dt)
    h.skok(dt)
    uporedi(`vreme ${dt}`)
  }

  const tap = async (a: HTMLElement, b: HTMLElement, opis: string) => {
    p.klik(a)
    h.klik(b)
    await h.mikro() // reset čeka `await dialog.confirm`
    uporedi(opis)
  }

  uporedi('boot')

  const tapSada = async (sel: string, i: number): Promise<boolean> => {
    const a = p.qa(sel)[i] ?? null
    const b = h.qa(sel)[i] ?? null
    expect(!!b, `„${sel}"[${i}] postoji na obe strane ili ni na jednoj`).toBe(!!a)
    if (!a || !b) return false
    poslednji = { a, b, opis: `${sel}[${i}]` }
    await tap(a, b, `tap ${sel}[${i}]`)
    return true
  }

  const par: Par = {
    p,
    h,
    vreme,
    async klik(sel, i = 0, dt = 400) {
      expect(dt, 'D15: razmak između tapova').toBeGreaterThanOrEqual(RAZMAK_MIN)
      vreme(dt)
      return tapSada(sel, i)
    },
    tapSada,
    async dupliTap(dt) {
      const x = poslednji
      if (!x) throw new Error('dupliTap bez prethodnog tapa')
      const dozvoljeno = x.a.classList.contains('seme') || x.a.classList.contains('zrelo')
      expect(dozvoljeno, `dupliTap samo na seme/zrelu parcelu (${x.opis})`).toBe(true)
      vreme(dt)
      await tap(x.a, x.b, `dupli tap ${x.opis} posle ${dt} ms`)
    },
    tik(ms = 1000) {
      p.skok(ms)
      p.tik()
      h.skok(ms)
      h.tik()
      uporedi(`tik +${ms}`)
    },
    skok(ms) {
      p.skok(ms)
      h.skok(ms)
      uporedi(`skok ${ms}`)
    },
    smiri() {
      vreme(SEJV_ODLAGANJE_MS + 100)
      uporediSejv(`smiri posle koraka ${koraka}`)
    },
    async zatvori() {
      for (let n = 0; n < 30 && p.q('#nivoVeo.otvoren'); n++) await par.klik('#nivoOk')
      expect(h.q('#nivoVeo.otvoren')).toBeNull()
    },
    ima: (sel) => p.q(sel) !== null,
    kraj() {
      par.smiri()
      p.w.close()
      prozor.close()
      return { koraka, sejvova }
    },
  }
  return par
}

// ── Početni sejvovi ────────────────────────────────────────────────────────────

/** Kao referenca-sim TEST 3 (nivo 8, poklon nije uzet), ali sa zvukom — da se porede i zvuci. */
const BOGAT = stanje({
  novac: 100_000,
  xp: 5000,
  mute: false,
  poklonDan: '',
  mag: { ...MAG0, psenica: 20, sargarepa: 10, paprika: 9, bundeva: 2 },
})

/** referenca-sim TEST 4 relativno na T0 (v2: kazan/kazanT, `ko` narudžbine, parcele bez `z`). */
const V2 = JSON.parse(START_V2.raw ?? 'null') as object

/** Povratak posle 3 h: pšenica sazrela dok te nije bilo (sargarepa zrela i pre odlaska — ne broji se),
 *  bundeva raste, OBE mašine gotove (D16: dva reda), kokošinjac +3, štala već puna, poklon nije uzet,
 *  zvuk isključen, narudžbine 11 i 12 (brojacN nastavlja od 13). */
const ODSUSTVO = stanje({
  novac: 3000,
  xp: 900,
  mute: true,
  poklonDan: '2026-01-14',
  videno: T0 - 3 * SAT,
  parcele: [
    { c: 'psenica', t: T0 - 2 * SAT, z: false },
    { c: 'bundeva', t: T0 - 20 * MIN, z: true },
    { c: 'sargarepa', t: T0 - 4 * SAT, z: false },
    { c: null, t: 0, z: false },
  ],
  masine: { mlin: { k: true, t: T0 - 2 * SAT }, kazan: { k: true, t: T0 - SAT } },
  ziv: { kokosinjac: { k: true, t: T0 - 3 * SAT - 5 * MIN }, stala: { k: true, t: T0 - 5 * SAT } },
  mag: { ...MAG0, psenica: 6, paprika: 4, jaje: 2 },
  narudzbe: [narudzba(11, 'psenica', 3, 60, 5), narudzba(12, 'jaje', 2, 120, 9)],
  stat: { ubrano: 40, zaradjeno: 2500, isporuke: 3 },
})

/** Sat uređaja vraćen unazad (D4): `videno` i vremena useva, mašine i kokošinjca su u BUDUĆNOSTI —
 *  nema kartice povratka, trake su negativne, mlin „kuva" duže od svog vremena, kokošinjac ima 0. */
const SAT_UNAZAD = stanje({
  novac: 2000,
  xp: 900,
  mute: false,
  videno: T0 + SAT,
  parcele: [
    { c: 'psenica', t: T0 + 10 * MIN, z: false },
    { c: 'paprika', t: T0 + 30 * MIN, z: true },
    { c: null, t: 0, z: false },
  ],
  masine: { mlin: { k: true, t: T0 + 5 * MIN }, kazan: { k: true, t: 0 } },
  ziv: { kokosinjac: { k: true, t: T0 + 20 * MIN }, stala: { k: true, t: T0 - 20 * MIN } },
  mag: { ...MAG0, psenica: 2, paprika: 6 },
})

const STARTOVI: readonly { ime: string; sejv: object | null }[] = [
  { ime: 'nova igra', sejv: null },
  { ime: 'bogat (T3)', sejv: BOGAT },
  { ime: 'v2 sejv', sejv: V2 },
  { ime: 'odsustvo sa mašinama', sejv: ODSUSTVO },
  { ime: 'sat unazad', sejv: SAT_UNAZAD },
]

// ── Nasumičan dostupan hod ─────────────────────────────────────────────────────

type Potez = { vrsta: 'tap' | 'tik' | 'cekaj' | 'skok' | 'smiri'; tezina: number }

const POTEZI: readonly Potez[] = [
  { vrsta: 'tap', tezina: 70 },
  { vrsta: 'tik', tezina: 12 },
  { vrsta: 'cekaj', tezina: 9 },
  { vrsta: 'skok', tezina: 3 },
  { vrsta: 'smiri', tezina: 6 },
]

/** 50 %: 5–60 s · 35 %: 1–15 min · 15 %: 15 min – 3 h. */
function cekanje(drv: () => number): number {
  const r = drv()
  if (r < 0.5) return 5000 + Math.floor(drv() * 55_000)
  if (r < 0.85) return MIN + Math.floor(drv() * 14 * MIN)
  return 15 * MIN + Math.floor(drv() * 165 * MIN)
}

/** 85 %: 1–40 s napred · 15 %: sat vraćen 1–10 min (D4). */
function skokSata(drv: () => number): number {
  return drv() < 0.85 ? 1000 + Math.floor(drv() * 39_000) : -(MIN + Math.floor(drv() * 9 * MIN))
}

/** Nasumičan hod (seedovan `drv`). Tap: prvo protekne razmak (tajmeri mogu da precrtaju ekran — npr.
 *  180 ms posle žetve), PA se biraju tapovi sa ekrana kakav je sada. Vraća broj tapova. */
async function nasumicanHod(x: Par, drv: () => number, koraka: number): Promise<number> {
  let tapova = 0
  for (let n = 0; n < koraka; n++) {
    const potez = izaberi(POTEZI, drv)
    switch (potez.vrsta) {
      case 'tap': {
        x.vreme(RAZMACI[Math.floor(drv() * RAZMACI.length)] ?? RAZMAK_MIN)
        const tapovi: Tap[] = dostupniTapovi(x.p)
        // Obe strane nude ISTE tapove (isti elementi, isti redosled).
        expect(dostupniTapovi(x.h).map((t) => t.opis)).toEqual(tapovi.map((t) => t.opis))
        const t = izaberi(tapovi, drv)
        expect(await x.tapSada(t.sel, t.i), t.opis).toBe(true)
        tapova++
        break
      }
      case 'tik':
        x.tik(1000)
        break
      case 'cekaj':
        x.tik(cekanje(drv))
        break
      case 'skok':
        x.skok(skokSata(drv))
        break
      case 'smiri':
        x.smiri()
        break
    }
  }
  return tapova
}

// ── Testovi ────────────────────────────────────────────────────────────────────

describe('DOM paritet — preduslovi', () => {
  it('razmak između tapova je veći od D15 zaključavanja; orakl nosi sve UI zakrpe', () => {
    expect(RAZMAK_MIN).toBeGreaterThan(ZAKLJUCAVANJE_TAPA_MS)
    expect(Math.min(...RAZMACI)).toBeGreaterThanOrEqual(RAZMAK_MIN)
    expect(ORAKL).toContain(`<small>prototip v${VERZIJA}</small>`)
    expect(ORAKL).toContain("(s/60).toLocaleString('sr-RS')+' min'")
    expect(ORAKL).toContain('otvoriList(izabrana); }')
  })
})

const REZIMI: readonly Rezim[] = ['odmah', 'red']

describe.each(REZIMI)('DOM paritet, tajmeri „%s" — skriptovani scenariji', (rezim) => {
  it('nova igra: sadnja, D16 „1,5 min", zalivanje, rast, žetva (D1 dupli tap), D2, tezga, narudžbine, zvuk, nivo 2, reset', async () => {
    const x = await napraviPar(null, 3, rezim)
    await x.klik('.parcela.prazna')
    expect(x.h.q('[data-seme="sargarepa"] .info span')?.textContent).toBe(
      'raste 1,5 min · prodaja ~62 din',
    )
    await x.klik('[data-seme="psenica"]')
    await x.dupliTap(60) // D2: list se još zatvara — drugi tap ne naplaćuje
    await x.klik('.parcela[data-i="0"]') // zalivanje: 3 kapi UNUTAR pločice (u #app)
    x.vreme(399) // 'red': kapi i dalje tu …
    x.vreme(400) // … i na 799 ms …
    x.vreme(1) // … a na 800 ms uklonjene (prototip L648) — granica tajmera se poredi tačno
    await x.klik('.parcela[data-i="0"]') // već zaliveno
    x.tik(5000)
    x.tik(3000)
    x.tik(3500) // faza 3: inline transform biljke
    x.skok(4000) // zrelo, ali DOM još „raste" (bez ticka)
    await x.klik('.parcela[data-i="0"]') // zastareo handler zalivanja: „Već je zaliveno"
    x.tik(1000)
    await x.klik('.parcela.zrelo')
    await x.dupliTap(60) // D1: zastarela pločica pre crtanja posle 180 ms — no-op
    await x.klik('nav [data-tab="pijaca"]')
    await x.klik('[data-prodaj="psenica"]')
    await x.klik('nav [data-tab="narudzbe"]')
    await x.klik('[data-odbij]', 1)
    await x.klik('nav [data-tab="radnja"]')
    await x.klik('#zvukDugme')
    await x.klik('#zvukDugme')
    await x.klik('nav [data-tab="farma"]')
    await x.klik('.parcela.zakljucana') // nema dovoljno dinara
    for (let krug = 0; krug < 12; krug++) {
      for (const i of [0, 1]) {
        if (await x.klik(`.parcela.prazna[data-i="${i}"]`)) {
          if (!(await x.klik('[data-seme="psenica"]:not([disabled])'))) await x.klik('#veo')
        }
      }
      x.tik(21_000)
      if (!(await x.klik('#uberiSve'))) {
        for (let n = 0; n < 9 && (await x.klik('.parcela.zrelo')); n++);
      }
      await x.zatvori()
      if (krug % 3 === 2) {
        await x.klik('nav [data-tab="pijaca"]')
        await x.klik('[data-prodaj]')
        await x.klik('nav [data-tab="farma"]')
      }
    }
    expect(x.h.q('#nivoBr')?.textContent).toBe('2')
    await x.klik('nav [data-tab="radnja"]')
    await x.klik('#resetDugme')
    expect(x.h.stanje().xp).toBe(0)
    const { koraka } = x.kraj()
    expect(koraka).toBeGreaterThan(150)
  }, 30_000)

  it('bogat sejv: poklon, radnja, mašine, životinje, D14 trend na tezgi kroz vreme, isporuke, parcele do 9, sve kulture, sat unazad', async () => {
    const x = await napraviPar(BOGAT, 5, rezim)
    await x.zatvori() // dnevni poklon
    await x.klik('nav [data-tab="radnja"]')
    for (const id of ['mlin', 'kazan', 'kokosinjac', 'stala']) {
      expect(await x.klik(`[data-kupi="${id}"]`)).toBe(true)
    }
    await x.klik('nav [data-tab="farma"]')
    await x.klik('[data-kuvaj="kazan"]')
    await x.klik('[data-kuvaj="mlin"]')
    x.tik(60_000) // mašine u mestu
    x.tik(181_000) // obe gotove u istom ticku
    x.tik(27 * MIN)
    await x.klik('[data-pokupi="kokosinjac"]')
    await x.klik('[data-pokupi="stala"]')
    x.tik(3 * MIN) // jaje spremno — samo tačkica i dugme u mestu
    x.skok(-10 * MIN) // sat unazad (D4): dugme se gasi u sledećem ticku
    x.tik(1000)
    expect(x.h.q<HTMLButtonElement>('[data-pokupi="kokosinjac"]')?.disabled).toBe(true)
    x.skok(10 * MIN)
    await x.klik('nav [data-tab="pijaca"]')
    // D14: tick osvežava cenu i oznaku trenda; 10 × 50 s pokriva pola perioda cene.
    for (let n = 0; n < 10; n++) x.tik(50_000)
    await x.klik('[data-prodaj="brasno"]')
    await x.klik('nav [data-tab="narudzbe"]')
    for (let i = 0; i < 12; i++) {
      if (!(await x.klik('[data-isporuci]:not([disabled])'))) await x.klik('[data-odbij]', i % 2)
      await x.zatvori()
    }
    await x.klik('nav [data-tab="radnja"]')
    await x.klik('nav [data-tab="farma"]')
    for (let i = 0; i < 7; i++) await x.klik('.parcela.zakljucana')
    expect(x.h.qa('.parcela')).toHaveLength(9)
    const kulture = ['psenica', 'sargarepa', 'paprika', 'bundeva', 'grozdje']
    for (const [j, k] of kulture.entries()) {
      await x.klik(`.parcela.prazna[data-i="${j}"]`)
      await x.klik(`[data-seme="${k}"]`)
    }
    for (const dt of [8_000, 60_000, 600_000, 7_200_000]) x.tik(dt)
    await x.klik('#uberiSve')
    await x.klik('nav [data-tab="pijaca"]')
    await x.klik('nav [data-tab="narudzbe"]')
    const { koraka } = x.kraj()
    expect(koraka).toBeGreaterThan(100)
  }, 30_000)

  it('granice tajmera: 180 ms crtanje, +XP 900, konfete 3200, savet 700, toast 2300, zvuk novca 480, novčići 700 + i·40', async () => {
    const x = await napraviPar(
      stanje({
        sadio: false,
        mute: false,
        xp: 28,
        novac: 60,
        mag: { ...MAG0, psenica: 4 },
        parcele: [
          { c: 'psenica', t: T0 - 20_000, z: false },
          { c: null, t: 0, z: false },
        ],
      }),
      17,
      rezim,
    )
    await x.klik('.parcela.zrelo') // +2 XP → nivo 2: kartica, konfete, +XP, crtanje posle 180 ms
    x.vreme(179)
    x.vreme(1) // 180: njiva nacrtana
    x.vreme(719)
    x.vreme(1) // 900: „+2 XP" uklonjen
    x.vreme(2299)
    x.vreme(1) // 3200: konfete uklonjene (usput i sakrivanje toasta dobrodošlice)
    await x.zatvori()
    await x.klik('.parcela.prazna')
    await x.klik('[data-seme="psenica"]') // prva sadnja: savet posle 700 ms
    x.vreme(699)
    x.vreme(1) // 700: savet
    x.vreme(2299)
    x.vreme(1) // 3000: savet sakriven
    await x.klik('nav [data-tab="pijaca"]')
    await x.klik('[data-prodaj="psenica"]') // 5 kom → 5 novčića
    x.vreme(479)
    x.vreme(1) // 480: zvuk novca
    x.vreme(219)
    x.vreme(1) // 700: prvi novčić uklonjen
    x.vreme(39)
    x.vreme(1) // 740: drugi
    x.kraj()
  }, 30_000)

  it('jedna isporuka preko tri nivoa: kartice u redu, novac, konfete i crtanje posle svakog OK', async () => {
    const x = await napraviPar(
      stanje({
        mute: false,
        mag: { ...MAG0, psenica: 1 },
        narudzbe: [narudzba(1, 'psenica', 1, 25, 200), narudzba(2, 'sargarepa', 9, 700, 70)],
      }),
      9,
      rezim,
    )
    await x.klik('nav [data-tab="narudzbe"]')
    await x.klik('[data-isporuci="1"]')
    expect(x.h.q('#nivoKartica h3')?.textContent).toBe('Nivo 2!')
    await x.klik('#nivoOk')
    await x.klik('#nivoOk')
    await x.klik('#nivoOk')
    await x.klik('nav [data-tab="radnja"]')
    x.kraj()
  }, 30_000)

  it('odsustvo: „Dobro došao nazad" (D16 red po mašini), poklon, prvi tick završava obe mašine, skupljanje, prodaja', async () => {
    const x = await napraviPar(ODSUSTVO, 7, rezim)
    expect(x.h.qa('#nivoKartica .spisak > div').map((d) => d.textContent)).toEqual([
      'Sazrelo useva: 1',
      'Brašno je samleveno!',
      'Ajvar je gotov!',
      'Jaja: +3',
    ])
    x.tik(1000) // ispod kartice: obe mašine završavaju (toast, XP, crtanje)
    await x.zatvori() // dobrodošlica → poklon → „Hvala!"
    await x.klik('#uberiSve')
    await x.klik('[data-pokupi="kokosinjac"]')
    await x.klik('[data-pokupi="stala"]')
    await x.klik('.parcela[data-i="1"]') // bundeva: već zalivena
    await x.klik('[data-kuvaj="mlin"]')
    x.tik(95_000)
    await x.klik('nav [data-tab="pijaca"]')
    await x.klik('[data-prodaj]')
    await x.klik('nav [data-tab="narudzbe"]')
    await x.klik('[data-isporuci]:not([disabled])')
    await x.zatvori()
    await x.klik('nav [data-tab="radnja"]')
    await x.klik('#zvukDugme') // uključi zvuk: od sada se porede i zvuci
    await x.klik('nav [data-tab="farma"]')
    x.tik(3 * MIN)
    await x.klik('[data-pokupi="kokosinjac"]')
    x.kraj()
  }, 30_000)

  it('D14: mašina u ticku donese nivo dok je list semena otvoren — posle OK list se gradi ponovo (06#12)', async () => {
    const x = await napraviPar(
      stanje({
        novac: 100,
        xp: 85,
        mute: false,
        masine: { mlin: { k: true, t: T0 - 80_000 }, kazan: { k: false, t: 0 } },
      }),
      11,
      rezim,
    )
    await x.klik('.parcela.prazna')
    expect(x.h.q<HTMLButtonElement>('[data-seme="bundeva"]')?.disabled).toBe(true)
    x.tik(10_000) // mlin gotov: +8 XP → nivo 3 (+120 din) ispod otvorenog lista
    expect(x.h.q('#nivoKartica h3')?.textContent).toBe('Nivo 3!')
    await x.klik('#nivoOk') // crtajSve → list se gradi ponovo
    expect(x.ima('#list.otvoren')).toBe(true)
    expect(x.h.q<HTMLButtonElement>('[data-seme="bundeva"]')?.disabled).toBe(false)
    await x.klik('[data-seme="bundeva"]')
    expect(x.h.stanje().parcele[0]?.c).toBe('bundeva')
    x.kraj()
  }, 30_000)

  it('v2 sejv: poklon, spljoštene narudžbine (D8), kazan iz v2, odbijanje (ID od 7), isporuka, paprika raste', async () => {
    const x = await napraviPar(V2, 13, rezim)
    await x.zatvori()
    expect(x.h.q('[data-masina="kazan"]')).not.toBeNull()
    await x.klik('nav [data-tab="narudzbe"]')
    await x.klik('[data-odbij]', 1)
    await x.klik('[data-isporuci]:not([disabled])')
    await x.zatvori()
    await x.klik('nav [data-tab="farma"]')
    x.tik(4 * MIN)
    await x.klik('.parcela.zrelo')
    x.tik(1000)
    await x.klik('nav [data-tab="pijaca"]')
    await x.klik('[data-prodaj="grozdje"]')
    x.kraj()
  }, 30_000)
})

/** Dublje pretraživanje (ručno, van `npm test`): PARITET_SEMENA=40 PARITET_KORAKA=200 npx vitest run
 *  tests/ui/dom-paritet.ui.test.ts — dodaje semena 1000…1000+N po startu i režimu. */
const DODATNA_SEMENA = Number(process.env.PARITET_SEMENA ?? 0)
const KORAKA = Number(process.env.PARITET_KORAKA ?? 45)

describe.each(REZIMI)('DOM paritet, tajmeri „%s" — nasumičan dostupan hod', (rezim) => {
  const SEMENA = [
    ...(rezim === 'odmah' ? [21] : [31, 32]),
    ...Array.from({ length: DODATNA_SEMENA }, (_, i) => 1000 + i),
  ]
  it.each(STARTOVI.flatMap((st) => SEMENA.map((seme) => ({ ...st, seme }))))(
    '$ime, seme $seme',
    async ({ sejv, seme }) => {
      const x = await napraviPar(sejv, seme, rezim)
      const tapova = await nasumicanHod(x, mulberry32(seme ^ 0xa5a5a5a5), KORAKA)
      const { koraka, sejvova } = x.kraj()
      expect(tapova).toBeGreaterThan(KORAKA / 3)
      expect(koraka).toBeGreaterThanOrEqual(KORAKA + tapova)
      expect(sejvova).toBeGreaterThan(0)
    },
    30_000,
  )
})
