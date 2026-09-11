/*
 * PARITET FORMULA (ugovor §8): port === živi prototip, vrednost po vrednost.
 *
 *  - trzisnaCena: ≥ 20 000 trenutaka po artiklu — gusta mreža jednog perioda, nasumični epoch
 *    trenuci i RUBNI trenuci izračunati analitički: gde je baza·m tačno j + 0.5 (zaokruživanje) i
 *    gde je m tačno 1.02 / 0.98 (strelica). Baš tu bi preuređena formula (02 §0: `2π·t/600000`
 *    umesto `t/600000·π·2`) dala drugu cenu; nasumično uzorkovanje to skoro nikad ne pogodi.
 *  - nivoIzXp: svaka XP vrednost 0…20 000, svaki prag nivoa ±3, plafon 20 i vrednosti posle njega.
 *  - vremeTxt / fmt: rubni ulazi (NaN, ±∞, −0, 1e−9, x.5, ogromni) koje mreža u tekst.test.ts nema.
 *
 * Prototip se računa u jsdom realmu jednim `eval`-om po seriji (brzo), pa se porede nizovi.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import {
  MAX_NIVO,
  PIJACA_AMPLITUDA,
  PIJACA_FAZNI_POMAK,
  PIJACA_PERIOD_MS,
  PIJACA_PRAG_DOLE,
  PIJACA_PRAG_GORE,
  SVI_KLJUCEVI,
  baznaCena,
  xpZaNivo,
} from '../../src/config'
import { trzisnaCena } from '../../src/core/pijaca'
import { nivoIzXp } from '../../src/core/xp'
import { fmt, vremeTxt } from '../../src/i18n/format'
import { T0, mulberry32 } from '../helpers'
import { ucitajPrototip, type Prototip } from '../helpers/prototip'

let p: Prototip

beforeAll(async () => {
  p = await ucitajPrototip({ t0: T0 })
  expect(p.greske).toEqual([])
})

/** Literal niza brojeva koji preživi i NaN, ±Infinity i −0 (JSON ih ne prenosi). */
const literal = (x: readonly number[]): string =>
  '[' + x.map((n) => (Object.is(n, -0) ? '-0' : String(n))).join(',') + ']'

/** Prototipov rezultat `izraz(x)` za svaki x, kao JSON niz (izraz dobija promenljivu `x`). */
function uPrototipu<T>(ulazi: readonly number[], izraz: string): T[] {
  return JSON.parse(p.ev<string>(`JSON.stringify(${literal(ulazi)}.map(x => ${izraz}))`)) as T[]
}

// ── trzisnaCena ───────────────────────────────────────────────────────────────────

/** Celi ms trenuci oko rešenja sin(t/P·2π + idx·1.7) = v (oba rešenja, u svakom periodu `n`). */
function trenuciZaSinus(
  v: number,
  idx: number,
  periodi: readonly number[],
  okolina: readonly number[],
): number[] {
  const a = Math.asin(v)
  const out: number[] = []
  for (const x of [a, Math.PI - a]) {
    for (const n of periodi) {
      const t = ((x - idx * PIJACA_FAZNI_POMAK) / (2 * Math.PI) + n) * PIJACA_PERIOD_MS
      const c = Math.floor(t)
      for (const d of okolina) out.push(c + d)
    }
  }
  return out
}

/** 50 uzastopnih perioda oko 2026. (t ≈ 1.79e12): tu je argument sinusa ~1.9e7 rad, pa mu je
 *  greška zaokruživanja ~1e−9 rad — dovoljno da preuređen izraz pomeri cenu preko j + 0.5. */
const EPOHA = Array.from({ length: 50 }, (_, i) => 2_983_000 + i)

/** Rubni trenuci za artikal: sve granice zaokruživanja baza·m = j + 0.5 i oba praga strelice. */
function rubniTrenuci(idx: number, baza: number): number[] {
  const t: number[] = []
  const prag = (m: number) => (m - 1) / PIJACA_AMPLITUDA
  for (const m of [PIJACA_PRAG_GORE, PIJACA_PRAG_DOLE]) {
    t.push(...trenuciZaSinus(prag(m), idx, [0, 3_000_000], [-1, 0, 1, 2]))
    t.push(...trenuciZaSinus(prag(m), idx, EPOHA, [0, 1]))
  }
  const od = Math.ceil(baza * (1 - PIJACA_AMPLITUDA) - 0.5)
  const doj = Math.floor(baza * (1 + PIJACA_AMPLITUDA) - 0.5)
  for (let j = od; j <= doj; j++) {
    const v = prag((j + 0.5) / baza)
    if (Math.abs(v) <= 1) t.push(...trenuciZaSinus(v, idx, EPOHA, [0, 1]))
  }
  return t
}

/** 02 §2.4: najniža i najviša cena svakog artikla preko celog perioda (izmereno na prototipu). */
const RASPON: Record<(typeof SVI_KLJUCEVI)[number], readonly [number, number]> = {
  psenica: [15, 21],
  sargarepa: [53, 71],
  paprika: [157, 213],
  bundeva: [765, 1035],
  grozdje: [1955, 2645],
  brasno: [102, 138],
  ajvar: [663, 897],
  jaje: [38, 52],
  mleko: [221, 299],
}

interface Cena {
  cena: number
  smer: number
}

function prototipCene(k: string, trenuci: readonly number[]): Cena[] {
  p.w.__pomak = 0
  ;(p.w as unknown as { __tacke: readonly number[] }).__tacke = trenuci
  const par = JSON.parse(
    p.ev<string>(
      `(() => { const out = []; const t0 = Date.now();` +
        ` for (const t of window.__tacke) { window.__pomak = t - t0;` +
        ` const r = trzisnaCena('${k}'); out.push(r.cena, r.smer); }` +
        ` window.__pomak = 0; return JSON.stringify(out); })()`,
    ),
  ) as number[]
  const out: Cena[] = []
  for (let i = 0; i < par.length; i += 2) out.push({ cena: par[i] ?? NaN, smer: par[i + 1] ?? NaN })
  return out
}

describe('trzisnaCena === prototip (02 §4)', () => {
  const drv = mulberry32(600_000)
  const MREZA = Array.from({ length: 10_000 }, (_, i) => T0 + i * 60) // ceo period, korak 60 ms
  const NASUMICNO = Array.from({ length: 10_000 }, () => Math.floor(drv() * 4e12))
  const POSEBNI = [
    0,
    150_000,
    300_000,
    450_000,
    1_789_111_418_888,
    1_800_000_000_000,
    T0,
    -1,
    -600_000,
  ]

  it.each(SVI_KLJUCEVI.map((k, idx) => [k, idx] as const))('%s (indeks %i)', (k, idx) => {
    const rubni = rubniTrenuci(idx, baznaCena(k))
    const trenuci = [...MREZA, ...NASUMICNO, ...POSEBNI, ...rubni]
    expect(trenuci.length).toBeGreaterThanOrEqual(20_000)
    const proto = prototipCene(k, trenuci)
    const razlike: string[] = []
    trenuci.forEach((t, i) => {
      const nase = trzisnaCena(k, t)
      const pr = proto[i]
      if (!pr || nase.cena !== pr.cena || nase.smer !== pr.smer) {
        razlike.push(`t=${t}: port ${JSON.stringify(nase)} ≠ prototip ${JSON.stringify(pr)}`)
      }
    })
    expect(razlike.slice(0, 5)).toEqual([])
    // Rubni skup je stvarno rubni: pogađa OBE strane svake granice zaokruživanja, pa daje svaku
    // cenu iz raspona 02 §2.4 (min–max izmeren na prototipu), i sva tri smera.
    const cene = new Set(rubni.map((t) => trzisnaCena(k, t).cena))
    const [min, max] = RASPON[k]
    const niz = [...cene].sort((a, b) => a - b)
    expect([niz[0], niz.at(-1), cene.size]).toEqual([min, max, max - min + 1])
    expect(new Set(rubni.map((t) => trzisnaCena(k, t).smer))).toEqual(new Set([-1, 0, 1]))
  })

  it('rubni skup je osetljiv: preuređen izraz (02 §0) bi se na njemu razlikovao, mreža ne bi', () => {
    // Nezavisno od porta: ista matematika sa dva redosleda operacija.
    const cena = (b: number, i: number, t: number, preuredjeno: boolean) => {
      const x = preuredjeno
        ? (2 * Math.PI * t) / PIJACA_PERIOD_MS + PIJACA_FAZNI_POMAK * i
        : (t / PIJACA_PERIOD_MS) * Math.PI * 2 + i * PIJACA_FAZNI_POMAK
      const m = 1 + PIJACA_AMPLITUDA * Math.sin(x)
      return `${Math.round(b * m)}/${m >= PIJACA_PRAG_GORE ? 1 : m <= PIJACA_PRAG_DOLE ? -1 : 0}`
    }
    let rubnih = 0
    let mreze = 0
    SVI_KLJUCEVI.forEach((k, i) => {
      const b = baznaCena(k)
      for (const t of rubniTrenuci(i, b)) if (cena(b, i, t, false) !== cena(b, i, t, true)) rubnih++
      for (const t of [...MREZA, ...NASUMICNO])
        if (cena(b, i, t, false) !== cena(b, i, t, true)) mreze++
    })
    expect(rubnih).toBeGreaterThanOrEqual(5)
    expect(mreze).toBe(0)
  })

  it('zlatni red iz 02 §4 (t = 0 i t = 1.8e12 su isti trenutak u periodu)', () => {
    const red = (t: number) => SVI_KLJUCEVI.map((k) => trzisnaCena(k, t))
    expect(
      red(0)
        .map((c) => `${c.cena}/${c.smer}`)
        .join(' '),
    ).toBe('18/0 71/1 178/-1 775/-1 2470/1 134/1 698/-1 41/-1 294/1')
    expect(red(1_800_000_000_000)).toEqual(red(0))
  })
})

// ── nivoIzXp ──────────────────────────────────────────────────────────────────────

describe('nivoIzXp === prototip (02 §3), uključujući plafon 20', () => {
  it('svaka vrednost 0…20 000, svaki prag ±3, plafon i dalje, razlomci i negativne', () => {
    const xp: number[] = []
    for (let x = 0; x <= 20_000; x++) xp.push(x)
    let kum = 0
    const pragovi: number[] = []
    for (let l = 1; l <= MAX_NIVO + 1; l++) {
      kum += xpZaNivo(l)
      pragovi.push(kum)
      for (let d = -3; d <= 3; d++) xp.push(kum + d)
    }
    const DO_20 = pragovi[MAX_NIVO - 2] ?? NaN // XP kojim se stiže na nivo 20
    expect(DO_20).toBe(6_594_699)
    xp.push(DO_20 + xpZaNivo(MAX_NIVO), DO_20 + 2 * xpZaNivo(MAX_NIVO), 1e9, 1e12, 1e15, 2 ** 53)
    xp.push(-1, -1000, 29.5, 29.999999, 30.000001, 86.5, 0.1)
    const drv = mulberry32(19)
    for (let i = 0; i < 5000; i++) xp.push(Math.floor(drv() ** 4 * 2e7))

    const proto = uPrototipu<{ lvl: number; u: number; do: number }>(xp, 'nivoIzXp(x)')
    const razlike = xp.filter((x, i) => JSON.stringify(nivoIzXp(x)) !== JSON.stringify(proto[i]))
    expect(razlike).toEqual([])

    // plafon: na 20 se staje, `u` raste bez granice i može da pređe `do`
    expect(nivoIzXp(DO_20 - 1)).toEqual({ lvl: 19, u: 3_123_820, do: 3_123_821 })
    expect(nivoIzXp(DO_20)).toEqual({ lvl: 20, u: 0, do: 5_935_259 })
    expect(nivoIzXp(1e12)).toEqual({ lvl: 20, u: 999_993_405_301, do: 5_935_259 })
    expect(proto.filter((r) => r.lvl === MAX_NIVO).length).toBeGreaterThan(100)
  })
})

// ── Formateri: rubni ulazi ────────────────────────────────────────────────────────

describe('vremeTxt === prototip na rubnim ulazima (05 §2.2)', () => {
  it('NaN, ±∞, −0, sićušni, granice 59/60 i 3599/3600, ogromni', () => {
    const s = [NaN, Infinity, -Infinity, -0, 0, 5e-324, 1e-9, -1e-9, -0.5, 0.5, 0.999999]
    s.push(59, 59.000001, 59.5, 59.999999, 60, 60.000001, 119.5, 599.999, 600)
    s.push(3599, 3599.000001, 3599.5, 3599.999999, 3600, 3600.000001, 3659.5, 3660, 86_399.5)
    s.push(86_400, 359_999.9, 1e7, 1e15, 2 ** 53, Number.MAX_VALUE, -Number.MAX_VALUE)
    const drv = mulberry32(3)
    for (let i = 0; i < 3000; i++) s.push((drv() - 0.05) * 10 ** (drv() * 6))
    const proto = uPrototipu<string>(s, 'vremeTxt(x)')
    expect(s.map(vremeTxt)).toEqual(proto)
    expect(vremeTxt(NaN)).toBe('NaNs') // 1:1, i ovako čudno
    expect(vremeTxt(-0)).toBe('0s')
  })
})

describe('fmt === prototip na rubnim ulazima (05 §2.1)', () => {
  it('x.5 (i negativni), −0, NaN, ±∞, veliki i sićušni', () => {
    const n: number[] = [NaN, Infinity, -Infinity, -0, 0, 1e-7, -1e-7, 1e21, -1e21, 2 ** 53]
    for (let x = -20.5; x <= 20.5; x += 0.5) n.push(x)
    n.push(999.5, 999_999.5, 1_000_000.49, 123_456_789.5, -1234.5, -0.5, -0.4999999)
    const drv = mulberry32(8)
    for (let i = 0; i < 3000; i++) n.push((drv() - 0.3) * 10 ** (drv() * 12))
    const proto = uPrototipu<string>(n, 'fmt(x)')
    expect(n.map(fmt)).toEqual(proto)
    expect(fmt(-0.5)).toBe('-0') // Math.round(−0.5) = −0 → „-0", 1:1
    expect(fmt(1e21)).toBe('1.000.000.000.000.000.000.000')
  })
})
