/*
 * Portovi prema browseru/uređaju. Sve što UI dodiruje van DOM-a ide kroz ove interfejse,
 * da bi Capacitor (Faza 3) zamenio samo adaptere, a testovi ubrizgali lažnjake.
 */
import type { ZvukId } from '../core/dogadjaji'

export interface StorageAdapter {
  /** Sačuvani string, ili null ako ključ ne postoji. ODBIJA (reject) samo kad samo skladište
   *  zakaže — to NIJE isto što i „nema sejva" i ne sme da dovede do pregaženog sejva. */
  get(key: string): Promise<string | null>
  /** Upisuje vrednost. localStorage adapter upisuje sinhrono unutar poziva, da zapis iz
   *  visibilitychange handlera stigne pre nego što OS zamrzne stranicu. */
  set(key: string, value: string): Promise<void>
}

export interface Clock {
  /** Epoch ms (Date.now()). */
  now(): number
  /** Monotoni ms za animacije (performance.now()). */
  perfNow(): number
  /** Lokalni kalendarski dan za `now` u formatu 'YYYY-MM-DD' (toLocaleDateString('sv')). */
  danas(now: number): string
}

export interface Timers {
  setTimeout(cb: () => void, ms: number): number
  clearTimeout(id: number): void
  setInterval(cb: () => void, ms: number): number
  clearInterval(id: number): void
  raf(cb: (t: number) => void): number
  cancelRaf(id: number): void
}

export interface AudioPort {
  /** Pušta zvuk. Provera `mute` je posao pozivaoca (u trenutku puštanja, kao u prototipu). */
  play(id: ZvukId): void
}

export interface HapticsPort {
  vibrate(obrazac: number | readonly number[]): void
}

export interface DialogPort {
  confirm(poruka: string): Promise<boolean>
}

export interface LifecyclePort {
  /** Poziva cb kad aplikacija ode u pozadinu (visibilitychange → hidden, pagehide; kasnije
   *  Capacitor `pause`). Vraća funkciju za odjavu. */
  onHidden(cb: () => void): () => void
}

export interface Platforma {
  storage: StorageAdapter | null
  clock: Clock
  timers: Timers
  audio: AudioPort
  haptics: HapticsPort
  dialog: DialogPort
  lifecycle: LifecyclePort
  /** Nasumičnost igre (narudžbine). */
  random: () => number
  /** Nasumičnost efekata (novčići, konfete) — odvojena, da FX ne troši rng igre. */
  fxRandom: () => number
}
