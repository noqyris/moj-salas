/*
 * WebAudio sinteza zvukova, 1:1 sa prototipom (L601–620, 05 §4):
 * - AudioContext se pravi lenjo, pri PRVOM puštanju, i nikad se ne zatvara;
 * - dok je kontekst `suspended`, SVAKO puštanje zove `resume()` (bez čekanja) i ipak zakazuje tonove;
 * - fallback na `webkitAudioContext`; bez ijednog konstruktora zvuk je tih, igra ide dalje;
 * - sve je u try/catch — zvuk nikad ne sme da obori igru.
 * Provera `mute` NIJE ovde: UI je radi u trenutku puštanja (i za odloženi 'novac').
 */
import type { ZvukId } from '../core/dogadjaji'
import type { AudioPort } from './tipovi'

/** Jedan ton: oscilator → pojačanje → izlaz. Vremena su u sekundama od `currentTime`. */
export interface Ton {
  /** Frekvencija (Hz). */
  readonly f: number
  /** Kraj eksponencijalnog opadanja, od početka tona (s). */
  readonly t: number
  readonly tip: OscillatorType
  /** Vršna jačina. */
  readonly gl: number
  /** Kašnjenje početka (s). */
  readonly kad: number
}

/** Tabela tonova iz prototipa (05 §4.3), sa razrešenim podrazumevanim vrednostima. */
export const TONOVI: Readonly<Record<ZvukId, readonly Ton[]>> = {
  tap: [{ f: 660, t: 0.06, tip: 'triangle', gl: 0.12, kad: 0 }],
  sadnja: [
    { f: 520, t: 0.07, tip: 'triangle', gl: 0.12, kad: 0 },
    { f: 392, t: 0.09, tip: 'triangle', gl: 0.1, kad: 0.06 },
  ],
  voda: [
    { f: 880, t: 0.06, tip: 'sine', gl: 0.09, kad: 0 },
    { f: 640, t: 0.09, tip: 'sine', gl: 0.08, kad: 0.07 },
  ],
  zetva: [
    { f: 523, t: 0.07, tip: 'triangle', gl: 0.12, kad: 0 },
    { f: 659, t: 0.07, tip: 'triangle', gl: 0.12, kad: 0.06 },
    { f: 784, t: 0.1, tip: 'triangle', gl: 0.12, kad: 0.12 },
  ],
  novac: [
    { f: 1175, t: 0.05, tip: 'square', gl: 0.06, kad: 0 },
    { f: 1568, t: 0.07, tip: 'square', gl: 0.05, kad: 0.05 },
  ],
  // Arpeđo: kašnjenja su i·0.09 → [0, 0.09, 0.18, 0.27] (bit-identično prototipu).
  nivo: [392, 523, 659, 784].map((f, i) => ({
    f,
    t: 0.14,
    tip: 'triangle',
    gl: 0.14,
    kad: i * 0.09,
  })),
  greska: [{ f: 170, t: 0.13, tip: 'sawtooth', gl: 0.08, kad: 0 }],
}

/** Početna i završna jačina (eksponencijalna rampa ne sme do nule). */
export const TISINA = 0.0001
/** Napad: od tišine do vrha (s). */
export const NAPAD_S = 0.012
/** Oscilator staje ovoliko posle kraja opadanja (s). */
export const REP_S = 0.02

// ── Strukturni tipovi: podskup WebAudio-a koji se koristi (lažnjaci u testovima ih zadovoljavaju) ──
export interface ParametarZvuka {
  setValueAtTime(vrednost: number, vreme: number): unknown
  exponentialRampToValueAtTime(vrednost: number, vreme: number): unknown
}
export interface Oscilator {
  type: string
  readonly frequency: { value: number }
  connect(cilj: unknown): unknown
  start(vreme: number): void
  stop(vreme: number): void
}
export interface Pojacanje {
  readonly gain: ParametarZvuka
  connect(cilj: unknown): unknown
}
export interface AudioKontekst {
  readonly currentTime: number
  readonly state: string
  readonly destination: unknown
  resume(): unknown
  createOscillator(): Oscilator
  createGain(): Pojacanje
}
export type AudioKonstruktor = new () => AudioKontekst
export interface AudioOkruzenje {
  readonly AudioContext?: AudioKonstruktor
  readonly webkitAudioContext?: AudioKonstruktor
}

function sviraj(ac: AudioKontekst, ton: Ton): void {
  const o = ac.createOscillator()
  const g = ac.createGain()
  o.type = ton.tip
  o.frequency.value = ton.f
  o.connect(g)
  g.connect(ac.destination)
  const s = ac.currentTime + ton.kad
  g.gain.setValueAtTime(TISINA, s)
  g.gain.exponentialRampToValueAtTime(ton.gl, s + NAPAD_S)
  g.gain.exponentialRampToValueAtTime(TISINA, s + ton.t)
  o.start(s)
  o.stop(s + ton.t + REP_S)
}

/** `okruzenje` se čita pri svakom puštanju dok kontekst ne postoji (kao `window.AudioContext`). */
export function createAudio(
  okruzenje: () => AudioOkruzenje = () => window as unknown as AudioOkruzenje,
): AudioPort {
  let ac: AudioKontekst | null = null
  return {
    play(id) {
      try {
        if (!ac) {
          const okr = okruzenje()
          const K = okr.AudioContext ?? okr.webkitAudioContext
          if (!K) return
          ac = new K()
        }
        if (ac.state === 'suspended') {
          // Obećanje se ne čeka (tonovi se zakazuju odmah, kao u prototipu); odbijanje se guta,
          // da ne postane „unhandled rejection".
          Promise.resolve(ac.resume()).catch(() => {})
        }
        for (const ton of TONOVI[id]) sviraj(ac, ton)
      } catch {
        // Zvuk nije kritičan (prototip: try{…}catch(e){}).
      }
    },
  }
}
