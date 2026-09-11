/*
 * Lažni tajmeri + rAF + sat za testove UI osnove. Jedna virtuelna vremenska osa: `perfNow()`
 * vraća virtuelno vreme, `setTimeout` zakazuje na njemu, a rAF okviri se puštaju ručno sa
 * zadatim vremenskim pečatom — tako se vide stvarni prozori (180 ms, 480 ms, 2300 ms…).
 */
import type { Clock, Timers } from '../../../src/platform/tipovi'

export interface LazniTajmeri {
  tajmeri: Timers
  sat: Clock
  /** Pomera vreme za `ms` i izvršava dospele setTimeout-e redom (rok, pa redosled zakazivanja). */
  pomeri(ms: number): void
  /** Pušta rAF pozive zakazane PRE ovog poziva, sa pečatom `ts` (podrazumevano: sadašnje vreme). */
  okvir(ts?: number): number
  vreme(): number
  /** Kašnjenja svih setTimeout poziva, redom. */
  readonly kasnjenja: number[]
  readonly otkazaniTimeout: number[]
  readonly otkazaniRaf: number[]
  timeoutUredu(): number
  rafUredu(): number
}

export function lazniTajmeri(pocetak = 1000): LazniTajmeri {
  let vreme = pocetak
  let sledeciId = 0
  let timeouti: { id: number; rok: number; cb: () => void }[] = []
  let rafovi: { id: number; cb: (t: number) => void }[] = []
  const kasnjenja: number[] = []
  const otkazaniTimeout: number[] = []
  const otkazaniRaf: number[] = []

  const tajmeri: Timers = {
    setTimeout(cb, ms) {
      const id = ++sledeciId
      kasnjenja.push(ms)
      timeouti.push({ id, rok: vreme + ms, cb })
      return id
    },
    clearTimeout(id) {
      otkazaniTimeout.push(id)
      timeouti = timeouti.filter((t) => t.id !== id)
    },
    setInterval() {
      throw new Error('setInterval nije predviđen u testovima UI osnove')
    },
    clearInterval() {},
    raf(cb) {
      const id = ++sledeciId
      rafovi.push({ id, cb })
      return id
    },
    cancelRaf(id) {
      otkazaniRaf.push(id)
      rafovi = rafovi.filter((r) => r.id !== id)
    },
  }

  return {
    tajmeri,
    sat: {
      now: () => vreme,
      perfNow: () => vreme,
      danas: (now) => new Date(now).toLocaleDateString('sv'),
    },
    pomeri(ms) {
      const cilj = vreme + ms
      for (;;) {
        const [prvi] = timeouti
          .filter((t) => t.rok <= cilj)
          .sort((a, b) => a.rok - b.rok || a.id - b.id)
        if (!prvi) break
        timeouti = timeouti.filter((t) => t !== prvi)
        vreme = prvi.rok
        prvi.cb()
      }
      vreme = cilj
    },
    okvir(ts) {
      const sada = rafovi
      rafovi = []
      for (const r of sada) r.cb(ts ?? vreme)
      return sada.length
    },
    vreme: () => vreme,
    kasnjenja,
    otkazaniTimeout,
    otkazaniRaf,
    timeoutUredu: () => timeouti.length,
    rafUredu: () => rafovi.length,
  }
}

/** Tajmeri kao u referenca-sim-u: setTimeout se izvršava odmah, rAF odmah sa pečatom +1000. */
export function trenutniTajmeri(): Timers {
  return {
    setTimeout(cb) {
      cb()
      return 0
    },
    clearTimeout() {},
    setInterval() {
      return 0
    },
    clearInterval() {},
    raf(cb) {
      cb(1_000_000)
      return 0
    },
    cancelRaf() {},
  }
}

/** Omotač rng-a koji broji izvlačenja. */
export function brojac(r: () => number): (() => number) & { n(): number } {
  let n = 0
  return Object.assign(
    () => {
      n++
      return r()
    },
    { n: () => n },
  )
}

/** Element niza koji MORA da postoji (bez `!`). */
export function dohvati<T>(niz: readonly T[], i: number): T {
  const v = niz[i]
  if (v === undefined) throw new Error(`nema elementa ${i} (dužina ${niz.length})`)
  return v
}

/** Pravougaonik za zamenu getBoundingClientRect (jsdom uvek vraća nule). */
export function pravougaonik(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left,
    top,
    width,
    height,
    x: left,
    y: top,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({}),
  }
}
