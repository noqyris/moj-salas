/*
 * Prototip kao proročište: učitava moja-farma-v3.html u jsdom sa virtuelnim satom, uhvaćenim
 * tickom i stubovima za storage/zvuk, pa testovi mogu da porede port sa izvorom istine.
 *
 * Top-level `let`/`const` prototipa (S, KULTURE, brojacN…) NISU svojstva `window`-a — čitaj ih
 * preko `ev('izraz')` (indirektni eval u globalnom opsegu jsdom-a). Funkcije jesu na `window`.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { JSDOM, VirtualConsole, type DOMWindow } from 'jsdom'

// Putanja od putanje OVOG fajla, ne `new URL('…', import.meta.url)`: taj izraz Vite u jsdom
// okruženju prepisuje u URL resursa, pa helper ne bi radio u `*.ui.test.ts` fajlovima.
const PUTANJA = resolve(dirname(fileURLToPath(import.meta.url)), '../../moja-farma-v3.html')
export const PROTOTIP_HTML = readFileSync(PUTANJA, 'utf8')

/** Zamena u izvornom kodu prototipa; `ocekivano` je tačan broj pojavljivanja (štiti od tihog promašaja). */
export interface Zakrpa {
  id: string
  nadji: string
  zameni: string
  ocekivano: number
}

export function primeniZakrpe(html: string, zakrpe: readonly Zakrpa[]): string {
  let izlaz = html
  for (const z of zakrpe) {
    const n = izlaz.split(z.nadji).length - 1
    if (n !== z.ocekivano) {
      throw new Error(`zakrpa ${z.id}: očekivano ${z.ocekivano} pojavljivanja, nađeno ${n}`)
    }
    izlaz = izlaz.split(z.nadji).join(z.zameni)
  }
  return izlaz
}

/** Svih 5 `Math.random()` poziva u `novaNarudzba` ide na poseban tok `window.__rngN`, da FX
 *  (koji takođe troše Math.random) ne pomere izvlačenja narudžbina. */
export function instrumentujNarudzbine(html: string): string {
  const a = html.indexOf('function novaNarudzba(){')
  const b = html.indexOf('function osigurajNarudzbe()')
  if (a < 0 || b < a) throw new Error('novaNarudzba nije nađena')
  const telo = html.slice(a, b)
  const n = telo.split('Math.random()').length - 1
  if (n !== 5) throw new Error(`očekivano 5 Math.random() u novaNarudzba, nađeno ${n}`)
  return html.slice(0, a) + telo.split('Math.random()').join('window.__rngN()') + html.slice(b)
}

export interface OpcijePrototipa {
  html?: string
  /** Početni sadržaj window.storage (ključ → string). */
  skladiste?: Record<string, string>
  /** Fiksni virtuelni epoch (ms); `Date.now()` i `new Date()` bez argumenata prate t0 + pomak. */
  t0: number
  /** 'odmah' = setTimeout se izvršava odmah (kao referenca-sim); 'red' = čeka `tajmeri(ms)`. */
  tajmeri?: 'odmah' | 'red'
  /** Zamena za Math.random (FX i sve ostalo). */
  random?: () => number
  /** Tok za instrumentovanu novaNarudzba (vidi instrumentujNarudzbine). */
  rngNarudzbina?: () => number
}

type ProtoWindow = DOMWindow & {
  __pomak: number
  __tikovi: (() => void)[]
  __mem: Record<string, string>
  __rngN?: () => number
}

export interface Prototip {
  w: ProtoWindow
  d: Document
  greske: string[]
  q(s: string): HTMLElement | null
  qa(s: string): HTMLElement[]
  klik(el: Element | null): boolean
  /** Pokreće uhvaćeni 1 s tick n puta (ne pomera sat). */
  tik(n?: number): void
  /** Pomera virtuelni sat (ne pokreće tick). */
  skok(ms: number): void
  /** U režimu 'red' izvršava tajmere dospele u narednih ms virtuelnog vremena tajmera, redom
   *  (rok, pa redosled zakazivanja); tokom svakog tajmera sat tajmera stoji na njegovom roku. */
  tajmeri(ms: number): void
  zatvoriOverlaye(): number
  /** Duboka kopija prototipovog stanja S. */
  S(): unknown
  ev<T = unknown>(izraz: string): T
  sacuvano(kljuc?: string): unknown
}

export async function ucitajPrototip(o: OpcijePrototipa): Promise<Prototip> {
  const greske: string[] = []
  const vc = new VirtualConsole()
  vc.on('jsdomError', (e: unknown) =>
    greske.push('jsdomError: ' + String((e as Error)?.stack ?? e)),
  )
  let red: { id: number; at: number; cb: () => void }[] = []
  let vt = 0
  let sledeciId = 0
  const dom = new JSDOM(o.html ?? PROTOTIP_HTML, {
    runScripts: 'dangerously',
    virtualConsole: vc,
    beforeParse(win) {
      const w = win as ProtoWindow
      const PraviDate = w.Date
      w.__pomak = 0
      const sad = () => o.t0 + w.__pomak
      class VDate extends PraviDate {
        constructor(...a: []) {
          if (a.length === 0) super(sad())
          else super(...(a as unknown as [number]))
        }
        static override now() {
          return sad()
        }
      }
      w.Date = VDate as DateConstructor
      if (o.random) w.Math.random = o.random
      if (o.rngNarudzbina) w.__rngN = o.rngNarudzbina
      w.__tikovi = []
      w.setInterval = ((cb: () => void) => {
        w.__tikovi.push(cb)
        return w.__tikovi.length
      }) as unknown as typeof w.setInterval
      w.clearInterval = (() => {}) as typeof w.clearInterval
      w.setTimeout = ((cb: () => void, ms?: number) => {
        if ((o.tajmeri ?? 'odmah') === 'odmah') {
          try {
            cb()
          } catch (e) {
            greske.push('timeout: ' + String((e as Error)?.stack ?? e))
          }
          return 0
        }
        red.push({ id: ++sledeciId, at: vt + (ms ?? 0), cb })
        return sledeciId
      }) as unknown as typeof w.setTimeout
      w.clearTimeout = ((id: number) => {
        red = red.filter((x) => x.id !== id)
      }) as typeof w.clearTimeout
      w.requestAnimationFrame = (cb: FrameRequestCallback) => {
        try {
          cb(w.performance.now() + 1000)
        } catch (e) {
          greske.push('raf: ' + String((e as Error)?.stack ?? e))
        }
        return 1
      }
      w.cancelAnimationFrame = () => {}
      w.confirm = () => true
      ;(w as unknown as { AudioContext: unknown }).AudioContext = class {
        currentTime = 0
        state = 'running'
        destination = {}
        resume() {}
        createOscillator() {
          return { type: '', frequency: { value: 0 }, connect() {}, start() {}, stop() {} }
        }
        createGain() {
          return {
            gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
            connect() {},
          }
        }
      }
      w.__mem = { ...(o.skladiste ?? {}) }
      ;(w as unknown as { storage: unknown }).storage = {
        async get(k: string) {
          if (!(k in w.__mem)) throw new Error('nema kljuca')
          return { key: k, value: w.__mem[k] }
        },
        async set(k: string, v: string) {
          w.__mem[k] = v
          return { key: k, value: v }
        },
      }
    },
  })
  // Startni IIFE prototipa čeka `await ucitaj()` — pusti mikro- i makro-taskove da se završe.
  await new Promise<void>((r) => process.nextTick(() => setImmediate(r)))
  const w = dom.window as ProtoWindow
  const d = w.document
  const p: Prototip = {
    w,
    d,
    greske,
    q: (s) => d.querySelector<HTMLElement>(s),
    qa: (s) => [...d.querySelectorAll<HTMLElement>(s)],
    klik(el) {
      if (!el) return false
      el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }))
      return true
    },
    tik(n = 1) {
      for (let i = 0; i < n; i++) {
        for (const cb of w.__tikovi) {
          try {
            cb()
          } catch (e) {
            greske.push('tik: ' + String((e as Error)?.stack ?? e))
          }
        }
      }
    },
    skok(ms) {
      w.__pomak += ms
    },
    tajmeri(ms) {
      const cilj = vt + ms
      for (;;) {
        const dospeli = red.filter((x) => x.at <= cilj).sort((a, b) => a.at - b.at || a.id - b.id)
        const x = dospeli[0]
        if (!x) break
        red = red.filter((y) => y !== x)
        // Sat tajmera je na trenutku okidanja, pa tajmer zakazan IZ tajmera (savet posle 700 ms →
        // sakrivanje toasta posle još 2300) računa od tog trenutka, kao u browseru.
        vt = Math.max(vt, x.at)
        try {
          x.cb()
        } catch (e) {
          greske.push('tajmer: ' + String((e as Error)?.stack ?? e))
        }
      }
      vt = cilj
    },
    zatvoriOverlaye() {
      let n = 0
      while (p.q('#nivoVeo.otvoren') && n < 30) {
        p.klik(p.q('#nivoOk'))
        n++
      }
      return n
    },
    S: () => JSON.parse(w.eval('JSON.stringify(S)') as string) as unknown,
    ev: <T>(izraz: string) => w.eval(izraz) as T,
    sacuvano(kljuc = 'moja-farma-v2') {
      const v = w.__mem[kljuc]
      return v === undefined ? undefined : (JSON.parse(v) as unknown)
    },
  }
  return p
}
