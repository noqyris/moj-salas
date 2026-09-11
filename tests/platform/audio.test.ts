import { describe, expect, it } from 'vitest'
import type { ZvukId } from '../../src/core/dogadjaji'
import {
  NAPAD_S,
  REP_S,
  TISINA,
  TONOVI,
  createAudio,
  type AudioKonstruktor,
} from '../../src/platform/audio'
import { T0 } from '../helpers'
import { ucitajPrototip } from '../helpers/prototip'

type Zapis = (string | number)[]

interface OpcijeSnimaca {
  currentTime?: number
  state?: string
  resume?: () => unknown
  bacaUKonstruktoru?: boolean
  bacaNaOscilatoru?: boolean
}

/** Lažni AudioContext koji beleži SVAKU operaciju (i dodele svojstava) redom. */
function snimac(o: OpcijeSnimaca = {}) {
  const log: Zapis[] = []
  const br = { konstrukcije: 0, resume: 0, osc: 0, gain: 0 }
  class LazniAudioContext {
    currentTime = o.currentTime ?? 0
    state = o.state ?? 'running'
    destination = { ime: 'izlaz' }
    constructor() {
      if (o.bacaUKonstruktoru) throw new Error('AudioContext nije dozvoljen')
      br.konstrukcije++
      log.push(['new'])
    }
    resume() {
      br.resume++
      log.push(['resume'])
      return o.resume?.()
    }
    createOscillator() {
      if (o.bacaNaOscilatoru) throw new Error('createOscillator pukao')
      const ime = 'osc' + br.osc++
      log.push(['createOscillator', ime])
      return {
        ime,
        get type() {
          return ''
        },
        set type(v: string) {
          log.push([ime + '.type', v])
        },
        frequency: {
          get value() {
            return 0
          },
          set value(v: number) {
            log.push([ime + '.frequency', v])
          },
        },
        connect(c: { ime: string }) {
          log.push([ime + '.connect', c.ime])
        },
        start(t: number) {
          log.push([ime + '.start', t])
        },
        stop(t: number) {
          log.push([ime + '.stop', t])
        },
      }
    }
    createGain() {
      const ime = 'gain' + br.gain++
      log.push(['createGain', ime])
      return {
        ime,
        gain: {
          setValueAtTime(v: number, t: number) {
            log.push([ime + '.setValueAtTime', v, t])
          },
          exponentialRampToValueAtTime(v: number, t: number) {
            log.push([ime + '.exponentialRampToValueAtTime', v, t])
          },
        },
        connect(c: { ime: string }) {
          log.push([ime + '.connect', c.ime])
        },
      }
    }
  }
  return { klasa: LazniAudioContext as AudioKonstruktor, log, br }
}

const SVI: ZvukId[] = ['tap', 'sadnja', 'voda', 'zetva', 'novac', 'nivo', 'greska']

interface Snimljeni {
  f: number
  tip: string
  pocetnaJacina: number
  pocetak: number
  vrh: number
  vrhVreme: number
  krajJacina: number
  krajVreme: number
  start: number
  stop: number
  veze: string[]
}

/** Iz loga izvlači tonove, sa vremenima RELATIVNIM na currentTime. */
function tonovi(log: Zapis[], ct: number): Snimljeni[] {
  const imena = log.filter((z) => z[0] === 'createOscillator').map((z) => String(z[1]))
  return imena.map((osc) => {
    const gain = 'gain' + osc.slice(3)
    const nadji = (op: string, n = 0) => {
      const z = log.filter((x) => x[0] === op)[n]
      if (!z) throw new Error('nema ' + op)
      return z
    }
    const [, v0, t0] = nadji(gain + '.setValueAtTime')
    const [, v1, t1] = nadji(gain + '.exponentialRampToValueAtTime', 0)
    const [, v2, t2] = nadji(gain + '.exponentialRampToValueAtTime', 1)
    return {
      f: Number(nadji(osc + '.frequency')[1]),
      tip: String(nadji(osc + '.type')[1]),
      pocetnaJacina: Number(v0),
      pocetak: Number(t0) - ct,
      vrh: Number(v1),
      vrhVreme: Number(t1) - ct,
      krajJacina: Number(v2),
      krajVreme: Number(t2) - ct,
      start: Number(nadji(osc + '.start')[1]) - ct,
      stop: Number(nadji(osc + '.stop')[1]) - ct,
      veze: [String(nadji(osc + '.connect')[1]), String(nadji(gain + '.connect')[1])],
    }
  })
}

/** 05 §4.3: [f, tip, vrh, početak, kraj opadanja, stop] — vremena od currentTime. */
const TABELA: Record<ZvukId, [number, string, number, number, number, number][]> = {
  tap: [[660, 'triangle', 0.12, 0, 0.06, 0.08]],
  sadnja: [
    [520, 'triangle', 0.12, 0, 0.07, 0.09],
    [392, 'triangle', 0.1, 0.06, 0.15, 0.17],
  ],
  voda: [
    [880, 'sine', 0.09, 0, 0.06, 0.08],
    [640, 'sine', 0.08, 0.07, 0.16, 0.18],
  ],
  zetva: [
    [523, 'triangle', 0.12, 0, 0.07, 0.09],
    [659, 'triangle', 0.12, 0.06, 0.13, 0.15],
    [784, 'triangle', 0.12, 0.12, 0.22, 0.24],
  ],
  novac: [
    [1175, 'square', 0.06, 0, 0.05, 0.07],
    [1568, 'square', 0.05, 0.05, 0.12, 0.14],
  ],
  nivo: [
    [392, 'triangle', 0.14, 0, 0.14, 0.16],
    [523, 'triangle', 0.14, 0.09, 0.23, 0.25],
    [659, 'triangle', 0.14, 0.18, 0.32, 0.34],
    [784, 'triangle', 0.14, 0.27, 0.41, 0.43],
  ],
  greska: [[170, 'sawtooth', 0.08, 0, 0.13, 0.15]],
}

describe('WebAudio sinteza — tabela tonova (05 §4.3)', () => {
  it('konstante envelope-a: tišina 0.0001, napad 12 ms, rep 20 ms', () => {
    expect([TISINA, NAPAD_S, REP_S]).toEqual([0.0001, 0.012, 0.02])
  })

  for (const id of SVI) {
    it(`${id}: tačni oscilatori, graf osc → gain → izlaz, envelope i start/stop`, () => {
      const CT = 5 // ne-nulti currentTime: vremena moraju biti RELATIVNA
      const s = snimac({ currentTime: CT })
      createAudio(() => ({ AudioContext: s.klasa })).play(id)
      const dobijeno = tonovi(s.log, CT)
      const ocekivano = TABELA[id]
      expect(dobijeno).toHaveLength(ocekivano.length)
      dobijeno.forEach((t, i) => {
        const [f, tip, vrh, pocetak, kraj, stop] = ocekivano[i] ?? []
        expect(t.f).toBe(f)
        expect(t.tip).toBe(tip)
        expect(t.veze).toEqual([`gain${i}`, 'izlaz'])
        expect(t.pocetnaJacina).toBe(0.0001)
        expect(t.vrh).toBe(vrh)
        expect(t.krajJacina).toBe(0.0001)
        expect(t.pocetak).toBeCloseTo(pocetak ?? NaN, 10)
        expect(t.start).toBeCloseTo(pocetak ?? NaN, 10)
        expect(t.vrhVreme).toBeCloseTo((pocetak ?? NaN) + 0.012, 10)
        expect(t.krajVreme).toBeCloseTo(kraj ?? NaN, 10)
        expect(t.stop).toBeCloseTo(stop ?? NaN, 10)
      })
    })
  }

  it('nivo: kašnjenja su tačno [0, 0.09, 0.18, 0.27] (i·0.09)', () => {
    const s = snimac({ currentTime: 0 })
    createAudio(() => ({ AudioContext: s.klasa })).play('nivo')
    expect(tonovi(s.log, 0).map((t) => t.start)).toEqual([0, 0.09, 0.18, 0.27])
    expect(TONOVI.nivo.map((t) => t.kad)).toEqual([0, 0.09, 0.18, 0.27])
  })

  it('redosled operacija jednog tona (tap) je tačno prototipov', () => {
    const s = snimac({ currentTime: 0 })
    createAudio(() => ({ AudioContext: s.klasa })).play('tap')
    expect(s.log).toEqual([
      ['new'],
      ['createOscillator', 'osc0'],
      ['createGain', 'gain0'],
      ['osc0.type', 'triangle'],
      ['osc0.frequency', 660],
      ['osc0.connect', 'gain0'],
      ['gain0.connect', 'izlaz'],
      ['gain0.setValueAtTime', 0.0001, 0],
      ['gain0.exponentialRampToValueAtTime', 0.12, 0.012],
      ['gain0.exponentialRampToValueAtTime', 0.0001, 0.06],
      ['osc0.start', 0],
      ['osc0.stop', 0.08],
    ])
  })
})

describe('WebAudio — životni ciklus konteksta (05 §4.2)', () => {
  it('kontekst se pravi lenjo: ne pri createAudio, već pri PRVOM puštanju; zatim se ponovo koristi', () => {
    const s = snimac()
    const audio = createAudio(() => ({ AudioContext: s.klasa }))
    expect(s.br.konstrukcije).toBe(0)
    for (const id of [...SVI, 'tap' as const]) audio.play(id)
    expect(s.br.konstrukcije).toBe(1)
  })

  it('okruženje se čita tek pri puštanju (AudioContext koji se pojavi kasnije se koristi)', () => {
    const s = snimac()
    let okr: { AudioContext?: AudioKonstruktor } = {}
    const audio = createAudio(() => okr)
    audio.play('tap')
    okr = { AudioContext: s.klasa }
    audio.play('tap')
    expect(s.br.konstrukcije).toBe(1)
    expect(tonovi(s.log, 0)).toHaveLength(1)
  })

  it('suspended: SVAKO puštanje zove resume() i ipak zakazuje tonove (3 → 3 resume, 3 oscilatora)', () => {
    const s = snimac({ state: 'suspended' })
    const audio = createAudio(() => ({ AudioContext: s.klasa }))
    audio.play('tap')
    audio.play('tap')
    audio.play('tap')
    expect(s.br.resume).toBe(3)
    expect(tonovi(s.log, 0)).toHaveLength(3)
    // resume ide pre zakazivanja tonova.
    expect(s.log[1]).toEqual(['resume'])
  })

  it('running: resume() se ne zove', () => {
    const s = snimac()
    const audio = createAudio(() => ({ AudioContext: s.klasa }))
    audio.play('zetva')
    audio.play('nivo')
    expect(s.br.resume).toBe(0)
  })

  it('odbijen resume() (autoplay politika) ne ostavlja „unhandled rejection"', async () => {
    const neobradjeni: unknown[] = []
    const slusalac = (e: unknown) => neobradjeni.push(e)
    process.on('unhandledRejection', slusalac)
    try {
      const s = snimac({ state: 'suspended', resume: () => Promise.reject(new Error('autoplay')) })
      createAudio(() => ({ AudioContext: s.klasa })).play('tap')
      await new Promise((r) => setTimeout(r, 20))
      expect(neobradjeni).toEqual([])
      expect(tonovi(s.log, 0)).toHaveLength(1)
    } finally {
      process.off('unhandledRejection', slusalac)
    }
  })

  it('fallback na webkitAudioContext; standardni ima prednost kad postoje oba', () => {
    const w = snimac()
    createAudio(() => ({ webkitAudioContext: w.klasa })).play('tap')
    expect(w.br.konstrukcije).toBe(1)
    const a = snimac()
    const b = snimac()
    createAudio(() => ({ AudioContext: a.klasa, webkitAudioContext: b.klasa })).play('tap')
    expect([a.br.konstrukcije, b.br.konstrukcije]).toEqual([1, 0])
  })

  it('bez ikakvog AudioContext-a: tiho, bez bacanja', () => {
    const audio = createAudio(() => ({}))
    expect(() => {
      audio.play('tap')
      audio.play('nivo')
    }).not.toThrow()
  })

  it('konstruktor baca → tiho; sledeće puštanje pokušava ponovo (kao `AC = AC || new …`)', () => {
    const opcije: OpcijeSnimaca = { bacaUKonstruktoru: true }
    const s = snimac(opcije)
    const audio = createAudio(() => ({ AudioContext: s.klasa }))
    expect(() => audio.play('tap')).not.toThrow()
    opcije.bacaUKonstruktoru = false
    audio.play('tap')
    expect(s.br.konstrukcije).toBe(1)
    expect(tonovi(s.log, 0)).toHaveLength(1)
  })

  it('greška pri pravljenju tona se guta', () => {
    const s = snimac({ bacaNaOscilatoru: true })
    expect(() => createAudio(() => ({ AudioContext: s.klasa })).play('zetva')).not.toThrow()
  })

  it('nepoznat id: bez tonova i bez bacanja, ali kontekst se napravi (kao prototip)', () => {
    const s = snimac()
    expect(() =>
      createAudio(() => ({ AudioContext: s.klasa })).play('nepoznato' as ZvukId),
    ).not.toThrow()
    expect(s.br.konstrukcije).toBe(1)
    expect(tonovi(s.log, 0)).toHaveLength(0)
  })

  it('bez argumenata čita window (u Node-u ga nema) — i dalje ne baca', () => {
    expect(() => createAudio().play('tap')).not.toThrow()
  })
})

describe('WebAudio = prototip (isti lažni AudioContext, bit-identičan log)', () => {
  it.each([
    ['running', 100],
    ['suspended', 100],
    ['running', 0.3],
  ] as const)('stanje %s, currentTime %s: svih 7 zvukova redom', async (state, currentTime) => {
    const p = await ucitajPrototip({ t0: T0 })
    const proto = snimac({ state, currentTime })
    p.ev('AC = null')
    ;(p.w as unknown as { AudioContext: unknown }).AudioContext = proto.klasa
    for (const id of SVI) p.ev(`zvuk('${id}')`)

    const port = snimac({ state, currentTime })
    const audio = createAudio(() => ({ AudioContext: port.klasa }))
    for (const id of SVI) audio.play(id)

    expect(proto.log.length).toBeGreaterThan(100)
    expect(port.log).toEqual(proto.log)
    expect(p.greske).toEqual([])
  })
})
