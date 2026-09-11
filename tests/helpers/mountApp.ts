/*
 * mountApp — UI harness (07 §0.5): prava aplikacija (`createApp`) nad skeletom stranice u jsdom-u, sa
 * POTPUNO ubrizganom lažnom platformom. Oponaša referenca-sim (`napraviDom`/`alat`), pa se njegovi
 * scenariji prenose red po red:
 *
 * - sat igre (`clock.now`) je `t0 + pomak` i pomera ga SAMO `h.skok(ms)` (= referenca `t.skok`);
 * - `clock.perfNow` pomera SAMO `h.pauza(ms)` — „prošlo je vremena za igrača": ističu D15 zaključavanja
 *   tapova, a u režimu 'red' izvršavaju se i dospeli setTimeout-i. Pauza NE pomera sat igre i NE tika;
 * - interval se samo hvata; `h.tik(n)` ga pokreće n puta (= referenca `t.tick`);
 * - tajmeri 'odmah' (podrazumevano, kao referenca-sim): setTimeout se izvršava odmah; 'red': čeka pauzu;
 * - rAF se izvršava odmah sa pečatom perfNow + 1000 (brojanje novca se završi u istom kliku);
 * - skladište je MemoryStorage (upis je sinhron unutar poziva), `confirm` vraća zadatu potvrdu.
 */
import { KLJUC_SEJVA, ZAKLJUCAVANJE_TAPA_MS } from '../../src/config'
import type { Igra, Stanje, ZvukId } from '../../src/core'
import { MemoryStorage, lokalniDan } from '../../src/platform'
import type { Platforma } from '../../src/platform/tipovi'
import { createApp, type App } from '../../src/ui/app'
import { montirajSkelet } from '../../src/ui/skelet'
import { T0, mulberry32 } from './index'

export interface OpcijeMontiranja {
  /** Sejv pod KLJUC_SEJVA: objekat (JSON.stringify), sirov string, ili null/izostavljeno = nema sejva. */
  sejv?: object | string | null
  /** Početni epoch sata igre (podrazumevano T0). */
  t0?: number
  /** 'odmah' = setTimeout odmah (kao referenca-sim); 'red' = čeka `h.pauza(ms)`. */
  tajmeri?: 'odmah' | 'red'
  /** Rng igre (narudžbine). Podrazumevano seedovan, da testovi budu ponovljivi. */
  random?: () => number
  /** Rng efekata. */
  fxRandom?: () => number
  /** Za koliko ms sat igre ode napred POSLE svakog čitanja `clock.now()` (R1b: 1). */
  korakSata?: number
  /** Gotovo skladište (npr. sa `odbijGet`), ili null = igra bez trajnog skladišta. */
  skladiste?: MemoryStorage | null
  /** Odgovor na `confirm` (reset). */
  potvrda?: boolean
  /** false = ne pokreći boot (test zove `h.app.boot()` sam). */
  boot?: boolean
  /** Dokument u koji se montira (podrazumevano globalni jsdom `document`; paritet u node okruženju
   *  daje svoj JSDOM dokument). */
  doc?: Document
}

export interface Montirana {
  app: App
  platforma: Platforma
  skladiste: MemoryStorage | null
  q<E extends HTMLElement = HTMLElement>(s: string): E | null
  qa<E extends HTMLElement = HTMLElement>(s: string): E[]
  /** Klik kao referenca-sim: `MouseEvent('click', {bubbles:true})` na element (i odvojen od DOM-a). */
  klik(x: string | Element | null | undefined): boolean
  /** Pokreće uhvaćeni interval n puta (ne pomera sat). */
  tik(n?: number): void
  /** Pomera sat igre (ne tika, ne pomera perfNow). */
  skok(ms: number): void
  /** Pomera perfNow (D15) i, u režimu 'red', izvršava dospele setTimeout-e. Ne tika, ne pomera sat igre. */
  pauza(ms: number): void
  /** Sat igre bez pomeranja (korakSata se ne primenjuje). */
  sad(): number
  perf(): number
  /** Zatvara overlay kartice kao čovek: pre svakog OK sačeka ZAKLJUCAVANJE_TAPA_MS (D15). */
  zatvoriOverlaye(): number
  stanje(): Stanje
  igra(): Igra
  /** Parsiran sejv iz skladišta, ili null. */
  sacuvano(): unknown
  /** Registrovani intervali (ms). */
  intervali(): number[]
  /** setTimeout-i koji čekaju u režimu 'red' (kašnjenja). */
  timeouti(): number[]
  /** Pušteni zvuci (posle provere `mute`), redom. */
  zvuci: ZvukId[]
  vibracije: (number | readonly number[])[]
  /** Poruke prosleđene `confirm`. */
  potvrde: string[]
  /** Simulira odlazak aplikacije u pozadinu (LifecyclePort.onHidden). */
  sakrij(): void
  /** Neuhvaćene greške iz handlera (window 'error'). */
  greske: string[]
  /** Pušta mikrotaskove (reset čeka `await confirm`). */
  mikro(): Promise<void>
}

let prethodnaOdjava: (() => void) | null = null

export async function mountApp(o: OpcijeMontiranja = {}): Promise<Montirana> {
  if (prethodnaOdjava) prethodnaOdjava()
  const doc = o.doc ?? document
  const win = doc.defaultView
  if (!win) throw new Error('mountApp: dokument nema prozor (defaultView)')
  doc.body.innerHTML = ''
  montirajSkelet(doc)

  const t0 = o.t0 ?? T0
  const korak = o.korakSata ?? 0
  const rezim = o.tajmeri ?? 'odmah'
  let pomak = 0
  let perf = 1000
  let sledeciId = 0
  let red: { id: number; rok: number; cb: () => void }[] = []
  let intervali: { id: number; cb: () => void; ms: number }[] = []
  const skriveni: (() => void)[] = []
  const zvuci: ZvukId[] = []
  const vibracije: (number | readonly number[])[] = []
  const potvrde: string[] = []
  const greske: string[] = []

  const skladiste =
    o.skladiste !== undefined
      ? o.skladiste
      : new MemoryStorage(
          o.sejv === undefined || o.sejv === null
            ? {}
            : { [KLJUC_SEJVA]: typeof o.sejv === 'string' ? o.sejv : JSON.stringify(o.sejv) },
        )

  const platforma: Platforma = {
    storage: skladiste,
    clock: {
      now: () => {
        const v = t0 + pomak
        pomak += korak
        return v
      },
      perfNow: () => perf,
      danas: lokalniDan,
    },
    timers: {
      setTimeout(cb, ms) {
        const id = ++sledeciId
        if (rezim === 'odmah') cb()
        else red.push({ id, rok: perf + ms, cb })
        return id
      },
      clearTimeout(id) {
        red = red.filter((x) => x.id !== id)
      },
      setInterval(cb, ms) {
        const id = ++sledeciId
        intervali.push({ id, cb, ms })
        return id
      },
      clearInterval(id) {
        intervali = intervali.filter((x) => x.id !== id)
      },
      raf(cb) {
        const id = ++sledeciId
        cb(perf + 1000)
        return id
      },
      cancelRaf() {},
    },
    audio: { play: (id) => void zvuci.push(id) },
    haptics: { vibrate: (obrazac) => void vibracije.push(obrazac) },
    dialog: {
      confirm: (poruka) => {
        potvrde.push(poruka)
        return Promise.resolve(o.potvrda ?? true)
      },
    },
    lifecycle: {
      onHidden(cb) {
        skriveni.push(cb)
        return () => {
          const i = skriveni.indexOf(cb)
          if (i >= 0) skriveni.splice(i, 1)
        }
      },
    },
    random: o.random ?? mulberry32(20260911),
    fxRandom: o.fxRandom ?? mulberry32(911),
  }

  const naGresku = (e: ErrorEvent) => {
    const err: unknown = e.error
    greske.push(err instanceof Error ? (err.stack ?? err.message) : e.message)
  }
  win.addEventListener('error', naGresku)

  const app = createApp(doc, platforma)
  prethodnaOdjava = () => {
    app.ugasi()
    win.removeEventListener('error', naGresku)
  }
  if (o.boot !== false) await app.boot()

  const h: Montirana = {
    app,
    platforma,
    skladiste,
    q: <E extends HTMLElement = HTMLElement>(s: string) => doc.querySelector<E>(s),
    qa: <E extends HTMLElement = HTMLElement>(s: string) => [...doc.querySelectorAll<E>(s)],
    klik(x) {
      const el = typeof x === 'string' ? h.q(x) : x
      if (!el) return false
      el.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
      return true
    },
    tik(n = 1) {
      for (let i = 0; i < n; i++) for (const x of [...intervali]) x.cb()
    },
    skok(ms) {
      pomak += ms
    },
    pauza(ms) {
      const cilj = perf + ms
      for (;;) {
        const [d] = red.filter((x) => x.rok <= cilj).sort((a, b) => a.rok - b.rok || a.id - b.id)
        if (!d) break
        red = red.filter((x) => x !== d)
        perf = Math.max(perf, d.rok)
        d.cb()
      }
      perf = cilj
    },
    sad: () => t0 + pomak,
    perf: () => perf,
    zatvoriOverlaye() {
      let n = 0
      while (h.q('#nivoVeo.otvoren') && n < 30) {
        // D15: tek prikazana kartica ignoriše OK ZAKLJUCAVANJE_TAPA_MS — čovek je prvo pročita.
        h.pauza(ZAKLJUCAVANJE_TAPA_MS)
        h.klik('#nivoOk')
        n++
      }
      return n
    },
    stanje: () => app.igra().s,
    igra: () => app.igra(),
    sacuvano() {
      const v = skladiste?.podaci.get(KLJUC_SEJVA)
      return v === undefined ? null : (JSON.parse(v) as unknown)
    },
    intervali: () => intervali.map((x) => x.ms),
    timeouti: () => red.map((x) => x.rok - perf),
    zvuci,
    vibracije,
    potvrde,
    sakrij() {
      for (const cb of [...skriveni]) cb()
    },
    greske,
    async mikro() {
      for (let i = 0; i < 10; i++) await Promise.resolve()
    },
  }
  return h
}
