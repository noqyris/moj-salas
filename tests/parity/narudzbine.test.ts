/*
 * PARITET NARUDŽBINA (ugovor §8, 02 §5): prototipova `novaNarudzba` je živo proročište.
 * Prototip je instrumentovan (`instrumentujNarudzbine`): svih 5 `Math.random()` u `novaNarudzba`
 * ide na `window.__rngN`, pa isti tok ulazi u obe strane. Nijedno odobreno odstupanje ne dira
 * narudžbine, zato je orakl ORIGINALNI prototip (bez ZAKRPA).
 *
 * Porede se CELA narudžbina (id, mušterija, poruka, stavke, din, xp) i TAČAN broj izvlačenja —
 * uključujući poređenja u sort-shuffle-u `[...pool].sort(() => rng() - 0.5)`, čiji broj zavisi od
 * V8-ovog algoritma sortiranja (02 §5.4). Fisher–Yates ili drugi redosled izvlačenja ovde pada.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import type { ZgradaId } from '../../src/config'
import type { Igra } from '../../src/core/dogadjaji'
import { igraIzStanja, novaIgra } from '../../src/core/igra'
import { narPool, novaNarudzba, osigurajNarudzbe } from '../../src/core/narudzbine'
import type { Narudzba, Rng } from '../../src/core/types'
import { T0, mulberry32, niz, stanje } from '../helpers'
import {
  PROTOTIP_HTML,
  instrumentujNarudzbine,
  ucitajPrototip,
  type Prototip,
} from '../helpers/prototip'

const SVE_ZGRADE: readonly ZgradaId[] = ['mlin', 'kazan', 'kokosinjac', 'stala']

/** Svih 16 podskupova zgrada. */
const PODSKUPOVI: ZgradaId[][] = Array.from({ length: 16 }, (_, m) =>
  SVE_ZGRADE.filter((_, i) => (m >> i) & 1),
)

/** rng koji broji izvlačenja. */
function brojac(rng: Rng): Rng & { pozivi(): number } {
  let n = 0
  return Object.assign(
    () => {
      n++
      return rng()
    },
    { pozivi: () => n },
  )
}

const json = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T

function igraZa(xp: number, zgrade: readonly ZgradaId[], brojacN: number): Igra {
  const g = igraIzStanja(stanje({ xp }))
  for (const id of zgrade) {
    if (id === 'mlin' || id === 'kazan') g.s.masine[id] = { k: true, t: 0 }
    else g.s.ziv[id] = { k: true, t: T0 }
  }
  g.brojacN = brojacN
  return g
}

let p: Prototip

/** Postavlja prototipovo S (xp, zgrade, prazna tabla) i brojacN — isto što i `igraZa`. */
function postaviPrototip(xp: number, zgrade: readonly ZgradaId[], brojacN: number): void {
  const k = (id: ZgradaId) => zgrade.includes(id)
  p.ev(
    `S.xp = ${xp}; S.narudzbe = [];` +
      ` S.masine.mlin.k = ${k('mlin')}; S.masine.kazan.k = ${k('kazan')};` +
      ` S.ziv.kokosinjac.k = ${k('kokosinjac')}; S.ziv.stala.k = ${k('stala')};` +
      ` brojacN = ${brojacN};`,
  )
}

/** Jedna prototipova narudžbina iz toka `rng`. */
function prototipNarudzba(rng: Rng): Narudzba {
  p.w.__rngN = rng
  return json(p.ev<Narudzba>('novaNarudzba()'))
}

beforeAll(async () => {
  p = await ucitajPrototip({
    t0: T0,
    html: instrumentujNarudzbine(PROTOTIP_HTML),
    rngNarudzbina: mulberry32(0),
  })
  expect(p.greske).toEqual([])
})

/** 02 §5.7 — izlaz prototipa za `rng = mulberry32(seed)`, sa brojem izvlačenja. */
const ZLATNI: [number, ZgradaId[], number, number, number, Narudzba][] = [
  [0, [], 1, 1, 5, {
    id: 1, ime: 'Resto „Šumadija“', emoji: '🍽️', boja: '#e4f5d8', msg: 'Samo sveže, molim.',
    stavke: [{ k: 'sargarepa', kom: 1 }, { k: 'psenica', kom: 2 }], din: 130, xp: 10 }],
  [0, [], 2, 2, 5, {
    id: 2, ime: 'Kafana „Kod Žike“', emoji: '🍺', boja: '#fff3c4', msg: 'Gosti traže domaće!',
    stavke: [{ k: 'sargarepa', kom: 1 }, { k: 'psenica', kom: 1 }], din: 105, xp: 8 }],
  [30, [], 10, 3, 6, {
    id: 10, ime: 'Piljar Pera', emoji: '🧢', boja: '#d9f0ff', msg: 'Tezga mi je poluprazna…',
    stavke: [{ k: 'paprika', kom: 1 }, { k: 'sargarepa', kom: 1 }], din: 325, xp: 25 }],
  [30, ['mlin'], 11, 4, 7, {
    id: 11, ime: 'Kafana „Kod Žike“', emoji: '🍺', boja: '#fff3c4', msg: 'Večeras je puna kafana.',
    stavke: [{ k: 'brasno', kom: 1 }, { k: 'paprika', kom: 1 }], din: 400, xp: 31 }],
  [87, ['mlin', 'kazan', 'kokosinjac'], 12, 5, 16, {
    id: 12, ime: 'Kafana „Kod Žike“', emoji: '🍺', boja: '#fff3c4', msg: 'Večeras je puna kafana.',
    stavke: [{ k: 'psenica', kom: 5 }, { k: 'bundeva', kom: 1 }], din: 1290, xp: 99 }],
  [401, ['mlin', 'kazan', 'kokosinjac', 'stala'], 13, 6, 20, {
    id: 13, ime: 'Kafana „Kod Žike“', emoji: '🍺', boja: '#fff3c4', msg: 'Večeras je puna kafana.',
    stavke: [{ k: 'jaje', kom: 9 }], din: 530, xp: 41 }],
  [5628, ['kokosinjac'], 14, 7, 12, {
    id: 14, ime: 'Pekara „Zrno“', emoji: '🥖', boja: '#ffeccc', msg: 'Peć je već vruća!',
    stavke: [{ k: 'sargarepa', kom: 12 }], din: 970, xp: 75 }],
  [6_594_699, ['mlin', 'kazan', 'kokosinjac', 'stala'], 99, 8, 20, {
    id: 99, ime: 'Baka Mira', emoji: '👵', boja: '#ffe0e6', msg: 'Za unučiće spremam ručak…',
    stavke: [{ k: 'psenica', kom: 12 }], din: 285, xp: 22 }],
] // prettier-ignore

describe('02 §5.7 zlatni vektori: prototip I port daju tačno zapisani izlaz', () => {
  it.each(ZLATNI)(
    'xp %i, zgrade %j, brojacN %i, mulberry32(%i) → %i izvlačenja',
    (xp, zgrade, brojacN, seed, izvlacenja, ocekivano) => {
      postaviPrototip(xp, zgrade, brojacN)
      const rp = brojac(mulberry32(seed))
      expect(prototipNarudzba(rp)).toEqual(ocekivano)
      expect(rp.pozivi()).toBe(izvlacenja)
      expect(p.ev('brojacN')).toBe(brojacN + 1)

      const g = igraZa(xp, zgrade, brojacN)
      const rc = brojac(mulberry32(seed))
      expect(novaNarudzba(g, rc)).toEqual(ocekivano)
      expect(rc.pozivi()).toBe(izvlacenja)
      expect(g.brojacN).toBe(brojacN + 1)
    },
  )

  it('nova igra, mulberry32(2024): osigurajNarudzbe daje isti par (10 izvlačenja) u oba', () => {
    postaviPrototip(0, [], 1)
    const rp = brojac(mulberry32(2024))
    p.w.__rngN = rp
    p.ev('osigurajNarudzbe()')
    const proto = json(p.ev<Narudzba[]>('S.narudzbe'))
    expect(rp.pozivi()).toBe(10)
    expect(proto.map((o) => [o.id, o.ime, o.din, o.xp])).toEqual([
      [1, 'Piljar Pera', 130, 10],
      [2, 'Kafana „Kod Žike“', 105, 8],
    ])
    const rc = brojac(mulberry32(2024))
    const g = novaIgra(T0, rc)
    expect(g.s.narudzbe).toEqual(proto)
    expect(rc.pozivi()).toBe(10)
    expect(g.brojacN).toBe(p.ev('brojacN'))
  })
})

describe('živo proročište: isti tok → iste narudžbine i isti broj izvlačenja', () => {
  // Nivoi 1, 2, 3, 4, 5, 8, 20 (i granice pre/posle praga): pool od 2 do 8 artikala.
  const XP = [0, 29, 30, 86, 87, 194, 195, 400, 401, 5000, 6_594_699, 1e9]

  it.each(XP)('xp %i × svih 16 skupova zgrada × 3 seeda × 6 uzastopnih narudžbina', (xp) => {
    let slucajeva = 0
    const velicine = new Set<number>()
    for (const zgrade of PODSKUPOVI) {
      for (const seed of [1, 77, 4242]) {
        postaviPrototip(xp, zgrade, 50)
        const g = igraZa(xp, zgrade, 50)
        velicine.add(narPool(g.s).length)
        const rp = brojac(mulberry32(seed * 1000 + xp))
        const rc = brojac(mulberry32(seed * 1000 + xp))
        for (let i = 0; i < 6; i++) {
          const proto = prototipNarudzba(rp)
          const nase = novaNarudzba(g, rc)
          expect(nase, `xp ${xp} ${zgrade.join('+')} seed ${seed} #${i}`).toEqual(proto)
          expect(rc.pozivi(), 'broj izvlačenja').toBe(rp.pozivi())
          slucajeva++
        }
        expect(g.brojacN).toBe(p.ev('brojacN'))
      }
    }
    expect(slucajeva).toBe(16 * 3 * 6)
    // pool raste sa nivoom i zgradama: bar dve različite veličine po nivou
    expect(velicine.size).toBeGreaterThanOrEqual(2)
  })

  it('osigurajNarudzbe: dopuna jedne narudžbine posle učitavanja (id nastavlja od brojacN)', () => {
    const postojeca: Narudzba = {
      id: 41,
      ime: 'Baka Mira',
      emoji: '👵',
      boja: '#ffe0e6',
      msg: 'Za unučiće spremam ručak…',
      stavke: [{ k: 'psenica', kom: 3 }],
      din: 70,
      xp: 6,
    }
    postaviPrototip(2000, ['mlin', 'stala'], 42)
    p.ev(`S.narudzbe = [${JSON.stringify(postojeca)}]`)
    const rp = brojac(mulberry32(5))
    p.w.__rngN = rp
    p.ev('osigurajNarudzbe()')
    const g = igraZa(2000, ['mlin', 'stala'], 42)
    g.s.narudzbe = [structuredClone(postojeca)]
    const rc = brojac(mulberry32(5))
    osigurajNarudzbe(g, rc)
    expect(g.s.narudzbe).toEqual(json(p.ev('S.narudzbe')))
    expect(g.s.narudzbe.map((o) => o.id)).toEqual([41, 42])
    expect(rc.pozivi()).toBe(rp.pozivi())
  })
})

describe('skriptovani rng (niz): tačan redosled i broj izvlačenja, iscrpljen tok baca u oba', () => {
  const SKRIPTE: [string, number, ZgradaId[], number[]][] = [
    ['07 §e: nivo 1, 2 vrste, Baka Mira', 0, [], [0.9, 0.2, 0, 0, 0.99]],
    ['07 §e: nivo 1, 1 vrsta (ceo pool se ipak meša)', 0, [], [0.1, 0.8, 0.5, 0.99, 0]],
    ['07 §e: xp 1e9, pool 4', 1e9, [], [0.1, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4]],
    ['02 §5.4: nivo 3 + mlin, C = 7', 87, ['mlin'], [0.6, 0.9, 0.1, 0.8, 0.2, 0.7, 0.3, 0.6, 0.4, 0.5, 0.45]],
    ['r₁ = 0.55 tačno → 2 vrste', 30, ['mlin', 'kazan'], [0.55, 0.3, 0.7, 0.2, 0.8, 0.1, 0.9, 0.5, 0.5, 0.5, 0.5, 0.5]],
    ['poređenje vraća 0 (0.5) — stabilno sortiranje', 401, [...SVE_ZGRADE], Array<number>(40).fill(0.5)],
    ['krajevi [0, 1): 0 i 0.9999999', 5000, [...SVE_ZGRADE], [0.9999999, 0, 0.9999999, 0, 0.9999999, 0, 0.9999999, 0, 0.9999999, 0, 0.9999999, 0, 0.9999999, 0, 0.9999999, 0, 0.9999999, 0, 0.9999999, 0, 0.9999999, 0]],
  ] // prettier-ignore

  it.each(SKRIPTE)('%s', (_opis, xp, zgrade, vrednosti) => {
    postaviPrototip(xp, zgrade, 7)
    const rp = niz(...vrednosti)
    const proto = prototipNarudzba(rp)
    const rc = niz(...vrednosti)
    expect(novaNarudzba(igraZa(xp, zgrade, 7), rc)).toEqual(proto)
    expect(rc.pozivi()).toBe(rp.pozivi())
  })

  it('iscrpljen tok: obe strane bacaju posle ISTOG broja izvlačenja', () => {
    for (let n = 0; n < 5; n++) {
      postaviPrototip(0, [], 1)
      const vr = [0.9, 0.2, 0, 0, 0.99].slice(0, n)
      const rp = niz(...vr)
      expect(() => prototipNarudzba(rp)).toThrow(`rng iscrpljen posle ${n} izvlačenja`)
      const rc = niz(...vr)
      expect(() => novaNarudzba(igraZa(0, [], 1), rc)).toThrow(
        `rng iscrpljen posle ${n} izvlačenja`,
      )
    }
  })

  it('3000 nasumičnih tokova (mulberry32 + rubne vrednosti) nad nasumičnim nivoom i zgradama', () => {
    const drv = mulberry32(20260911)
    const RUBNE = [0, 0.5, 0.55, 0.9999999, 0.25, 0.75]
    const histogram = new Map<number, number>()
    for (let i = 0; i < 3000; i++) {
      const xp = Math.floor(drv() ** 3 * 7_000_000)
      const zgrade = PODSKUPOVI[Math.floor(drv() * 16)] ?? []
      const vrednosti = Array.from({ length: 30 }, () =>
        drv() < 0.15 ? (RUBNE[Math.floor(drv() * RUBNE.length)] ?? 0) : drv(),
      )
      postaviPrototip(xp, zgrade, i + 1)
      const rp = niz(...vrednosti)
      const proto = prototipNarudzba(rp)
      const rc = niz(...vrednosti)
      const nase = novaNarudzba(igraZa(xp, zgrade, i + 1), rc)
      expect(nase, `slučaj ${i}: xp ${xp}, ${zgrade.join('+')}`).toEqual(proto)
      expect(rc.pozivi()).toBe(rp.pozivi())
      histogram.set(rc.pozivi(), (histogram.get(rc.pozivi()) ?? 0) + 1)
    }
    // Broj izvlačenja = 4 + C: od 5 (pool 2) do 22 (pool 8) — tokovi pokrivaju širok raspon.
    const broj = [...histogram.keys()]
    expect(Math.min(...broj)).toBe(5)
    expect(Math.max(...broj)).toBeGreaterThanOrEqual(18)
  })
})
