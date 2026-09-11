/*
 * CLAUDE.md regresija 5 — fuzz (07 §c): 20 seedova × 2000 koraka nasumičnih akcija nad core API-jem,
 * sa argumentima iz CELOG domena (i nedozvoljenim), i invarijante I1–I14 posle svakog koraka.
 *
 * Dva seedovana toka po seedu: `drv` bira akcije, `rng` je rng igre (narudžbine).
 * Ponovi jedan seed:  FUZZ_SEED=17 npx vitest run tests/core/fuzz.test.ts   (FUZZ_STEPS=… za dužinu)
 *
 * Režim „unazad" (D4 je ispravljen): 2 % koraka vraća sat do 10 min; vremenske invarijante `t ≤ now`
 * se tada ne proveravaju, a sve ostale (magacin ≥ 0, XP ne opada, n ∈ [0, kap]…) moraju da važe.
 *
 * I13: `sacuvajIUcitaj`/`noviDan` idu kroz pravi sejv — `dekodirajSejv(kodirajSejv(s), now)` mora da
 * vrati `ok`, BEZ popravki (inače bi svaki start pisao rezervu, D10), sa stanjem ≡ s i istom sesijom.
 */
import { describe, expect, it } from 'vitest'
import {
  MASINE_REDOSLED,
  MAX_NIVO,
  MAX_PARCELA,
  MUSTERIJE,
  NARUDZBINA_AKTIVNIH,
  NARUDZBINA_KOM_MAX,
  NARUDZBINA_KOM_MIN,
  REDOSLED,
  SVI_KLJUCEVI,
  ZIV,
  ZIV_REDOSLED,
  type ZgradaId,
} from '../../src/config'
import type { Igra, Rezultat } from '../../src/core/dogadjaji'
import { igraIzStanja, novaIgra, prebaciZvuk } from '../../src/core/igra'
import { pogledMasine, pokreniMasinu, tikMasina } from '../../src/core/masine'
import { isporuci, narPool, odbij, osigurajNarudzbe } from '../../src/core/narudzbine'
import { prikaziDobrodoslicu, rezimeOdsustva, uzmiDnevniPoklon } from '../../src/core/odsustvo'
import { prodaj } from '../../src/core/pijaca'
import { navTacke, opcijeSemena } from '../../src/core/pogledi'
import {
  kupiParcelu,
  pogledParcele,
  posadi,
  potpisNjiva,
  uberi,
  uberiSve,
  zalij,
  zrelihUseva,
} from '../../src/core/polja'
import { kupiZgradu } from '../../src/core/radnja'
import { dekodirajSejv, kodirajSejv } from '../../src/core/sejv/dekoder'
import type { Rng } from '../../src/core/types'
import { nivoIzXp } from '../../src/core/xp'
import { pogledZivotinje, pokupi } from '../../src/core/zivotinje'
import { MAG0, T0, danKljuc, mulberry32, stanje } from '../helpers'

type Rezim = 'monoton' | 'unazad'
type Akcija =
  | { k: 'cekaj' | 'unazad'; ms: number }
  | { k: 'posadi'; i: number; kultura: (typeof REDOSLED)[number] }
  | { k: 'zalij' | 'uberi'; i: number }
  | { k: 'uberiSve' | 'kupiParcelu' | 'sacuvajIUcitaj' | 'prebaciZvuk' | 'noviDan' }
  | { k: 'prodaj'; artikal: (typeof SVI_KLJUCEVI)[number] }
  | { k: 'isporuci' | 'odbij'; id: number }
  | { k: 'kupiZgradu'; id: ZgradaId }
  | { k: 'pokreniMasinu'; id: (typeof MASINE_REDOSLED)[number] }
  | { k: 'pokupi'; id: (typeof ZIV_REDOSLED)[number] }

const KORACI = Number(process.env.FUZZ_STEPS ?? 2000)
const SAMO_SEED = process.env.FUZZ_SEED === undefined ? null : Number(process.env.FUZZ_SEED)
const SEEDOVI = SAMO_SEED === null ? Array.from({ length: 20 }, (_, i) => i + 1) : [SAMO_SEED]
const ZGRADE: ZgradaId[] = ['mlin', 'kazan', 'kokosinjac', 'stala']
const DAN_MS = 24 * 3_600_000

/** Brojač uspelih/odbijenih akcija po vrsti, preko svih seedova — dokaz da fuzz nije prazan. */
const pokriveno = new Map<string, { ok: number; ne: number }>()
function zabelezi(k: string, ok: boolean) {
  const x = pokriveno.get(k) ?? { ok: 0, ne: 0 }
  if (ok) x.ok++
  else x.ne++
  pokriveno.set(k, x)
}

/** Boot-put: sirovi sejv → dekoder → sesija → dopuna narudžbina → dnevni poklon → čuvanje
 *  (videno = now). */
function ucitaj(raw: string, now: number, rng: Rng): Igra {
  const d = dekodirajSejv(raw, now)
  if (d.vrsta !== 'ok' || d.popravke.length > 0) {
    throw new Error(`I13: sejv nije čist: ${JSON.stringify(d.vrsta === 'ok' ? d.popravke : d)}`)
  }
  const g = igraIzStanja(d.stanje)
  osigurajNarudzbe(g, rng)
  const videnoPre = g.s.videno || now
  const pre = structuredClone(g.s)
  const r = rezimeOdsustva(g.s, videnoPre, now)
  prikaziDobrodoslicu(r)
  if (JSON.stringify(g.s) !== JSON.stringify(pre)) throw new Error('rezimeOdsustva menja stanje')
  uzmiDnevniPoklon(g, danKljuc(now))
  g.s.videno = now
  return g
}

function izaberi(drv: Rng, g: Igra, rezim: Rezim): Akcija {
  const s = g.s
  const jedan = <T>(niz: readonly T[]): T => {
    const x = niz[Math.floor(drv() * niz.length)]
    if (x === undefined) throw new Error('prazan izbor')
    return x
  }
  // indeks iz [−1, dužina] — i nevažeći, da se probaju zaštite
  const indeks = () => Math.floor(drv() * (s.parcele.length + 2)) - 1
  const r = drv()
  if (r < 0.18) {
    const v = drv()
    const ms =
      v < 0.5
        ? 1000
        : v < 0.8
          ? 5000 + Math.floor(drv() * 60_000)
          : 60_000 + Math.floor(drv() * 3 * 3_600_000)
    return { k: 'cekaj', ms }
  }
  if (r < 0.2 && rezim === 'unazad') return { k: 'unazad', ms: 1000 + Math.floor(drv() * 600_000) }
  if (r < 0.34) return { k: 'posadi', i: indeks(), kultura: jedan(REDOSLED) }
  if (r < 0.44) return { k: 'zalij', i: indeks() }
  if (r < 0.54) return { k: 'uberi', i: indeks() }
  if (r < 0.58) return { k: 'uberiSve' }
  if (r < 0.64) return { k: 'prodaj', artikal: jedan(SVI_KLJUCEVI) }
  if (r < 0.7) return { k: 'isporuci', id: drv() < 0.9 ? jedan(s.narudzbe).id : 999_999 }
  if (r < 0.75) return { k: 'odbij', id: drv() < 0.95 ? jedan(s.narudzbe).id : 999_999 }
  if (r < 0.79) return { k: 'kupiParcelu' }
  if (r < 0.84) return { k: 'kupiZgradu', id: jedan(ZGRADE) }
  if (r < 0.89) return { k: 'pokreniMasinu', id: jedan(MASINE_REDOSLED) }
  if (r < 0.94) return { k: 'pokupi', id: jedan(ZIV_REDOSLED) }
  if (r < 0.97) return { k: 'sacuvajIUcitaj' }
  if (r < 0.98) return { k: 'prebaciZvuk' }
  return { k: 'noviDan' }
}

interface Kraj {
  lvl: number
  parcele: number
  zgrade: number
  isporuke: number
}

function pokreni(seed: number, koraci: number, rezim: Rezim, pocetak: string | null): Kraj {
  const drv = mulberry32(seed ^ 0xa5a5a5a5)
  const rng = mulberry32(seed)
  let now = T0
  let g = pocetak === null ? novaIgra(now, rng) : ucitaj(pocetak, now, rng)
  g.s.videno = now
  let preXp = g.s.xp
  let preStat = { ...g.s.stat }
  const dnevnik: Akcija[] = []

  const pad = (korak: number, inv: string, detalj: string): never => {
    throw new Error(
      `FUZZ seed ${seed} (${rezim}) korak ${korak} — ${inv}: ${detalj}\n` +
        `poslednje akcije: ${JSON.stringify(dnevnik.slice(-12))}\n` +
        `now: ${now}\nstanje: ${JSON.stringify({ s: g.s, prosliNivo: g.prosliNivo, brojacN: g.brojacN })}`,
    )
  }
  const uslov = (korak: number, c: boolean, inv: string, detalj = '') => {
    if (!c) pad(korak, inv, detalj)
  }
  const svezNow = rezim === 'monoton'

  for (let korak = 0; korak < koraci; korak++) {
    const a = izaberi(drv, g, rezim)
    dnevnik.push(a)
    const pre = structuredClone(g)
    let r: Rezultat | null = null
    try {
      switch (a.k) {
        case 'cekaj':
        case 'unazad': {
          now += a.k === 'cekaj' ? a.ms : -a.ms
          const t = tikMasina(g, now)
          uslov(
            korak,
            t.strukturno === (t.cuvaj === 'odlozeno'),
            'I11',
            'tik: strukturno ⇔ čuvanje',
          )
          if (!t.strukturno) {
            uslov(korak, t.dogadjaji.length === 0, 'I11', 'tik bez završetka ima događaje')
            expect(g).toEqual(pre)
          } else g.s.videno = now
          zabelezi('tikMasina', t.strukturno)
          break
        }
        case 'sacuvajIUcitaj':
        case 'noviDan': {
          if (a.k === 'noviDan') now += DAN_MS
          const raw = kodirajSejv(g.s)
          // I13: sejv je čist JSON (bez NaN/undefined/Infinity), dekoder ga vraća kao `ok` bez
          // popravki, sa istim stanjem (i redosledom ključeva) i istom sesijom
          const d = dekodirajSejv(raw, now)
          uslov(korak, d.vrsta === 'ok' && d.popravke.length === 0, 'I13', JSON.stringify(d))
          const krug = igraIzStanja(d.stanje)
          expect(krug.s).toEqual(g.s)
          uslov(korak, kodirajSejv(krug.s) === raw, 'I13', 'kodirajSejv(dekodirano) ≠ raw')
          uslov(korak, krug.brojacN === g.brojacN, 'I13', `brojacN ${krug.brojacN} ≠ ${g.brojacN}`)
          uslov(korak, krug.prosliNivo === g.prosliNivo, 'I13', 'prosliNivo posle učitavanja')
          g = ucitaj(raw, now, rng)
          zabelezi(a.k, true)
          break
        }
        case 'posadi':
          r = posadi(g, a.i, a.kultura, now)
          break
        case 'zalij':
          r = zalij(g, a.i, now)
          break
        case 'uberi':
          r = uberi(g, a.i, now)
          break
        case 'uberiSve':
          r = uberiSve(g, now)
          break
        case 'prodaj':
          r = prodaj(g, a.artikal, now)
          break
        case 'isporuci':
          r = isporuci(g, a.id, now, rng)
          break
        case 'odbij':
          r = odbij(g, a.id, rng)
          break
        case 'kupiParcelu':
          r = kupiParcelu(g, now)
          break
        case 'kupiZgradu':
          r = kupiZgradu(g, a.id, now)
          break
        case 'pokreniMasinu':
          r = pokreniMasinu(g, a.id, now)
          break
        case 'pokupi':
          r = pokupi(g, a.id, now)
          break
        case 'prebaciZvuk':
          r = prebaciZvuk(g)
          break
      }
      if (r) {
        zabelezi(a.k, r.ok)
        if (r.ok) {
          uslov(korak, r.cuvaj === 'odlozeno', 'I11', 'uspeh bez čuvanja')
        } else {
          // I11: odbijena akcija ne menja NIŠTA (ni videno, brojacN, prosliNivo) i ne traži čuvanje
          uslov(korak, r.cuvaj === 'ne', 'I11', 'odbijeno a traži čuvanje')
          expect(g).toEqual(pre)
        }
        if (r.cuvaj !== 'ne') g.s.videno = now // kao SaveController
      }
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('FUZZ')) throw e
      pad(korak, 'I11/I12/I13', e instanceof Error ? (e.stack ?? e.message) : String(e))
    }

    // ── invarijante ──────────────────────────────────────────────────────────
    const s = g.s
    const u = (c: boolean, inv: string, d = '') => uslov(korak, c, inv, d)
    u(Number.isInteger(s.novac) && s.novac >= 0, 'I1', `novac ${s.novac}`)
    u(
      JSON.stringify(Object.keys(s.mag)) === JSON.stringify(SVI_KLJUCEVI),
      'I2',
      'ključevi magacina',
    )
    for (const k of SVI_KLJUCEVI) u(Number.isInteger(s.mag[k]) && s.mag[k] >= 0, 'I2', `mag.${k}`)
    u(s.parcele.length >= 2 && s.parcele.length <= MAX_PARCELA, 'I3', `${s.parcele.length} parcela`)
    for (const p of s.parcele) {
      if (p.c === null) u(p.t === 0 && p.z === false, 'I3', 'prazna parcela prljava')
      else {
        u(REDOSLED.includes(p.c), 'I3', `kultura ${String(p.c)}`)
        u(Number.isInteger(p.t) && p.t > 0 && (!svezNow || p.t <= now), 'I3', `t ${p.t}`)
        u(typeof p.z === 'boolean', 'I3', 'z')
      }
    }
    u(s.narudzbe.length === NARUDZBINA_AKTIVNIH, 'I4', `${s.narudzbe.length} narudžbina`)
    const ids = s.narudzbe.map((o) => o.id)
    u(new Set(ids).size === ids.length, 'I4', `duplikat ${ids}`)
    u(
      ids.every((id) => Number.isInteger(id) && id > 0 && id < g.brojacN),
      'I4',
      `${ids} / ${g.brojacN}`,
    )
    u(Math.max(...ids) === g.brojacN - 1, 'I4', 'najnovija narudžbina ima id brojacN − 1')
    const pool = narPool(s)
    for (const o of s.narudzbe) {
      const kljucevi = o.stavke.map((st) => st.k)
      u(o.stavke.length >= 1 && o.stavke.length <= 2, 'I4', 'broj stavki')
      u(new Set(kljucevi).size === kljucevi.length, 'I4', 'iste stavke')
      for (const st of o.stavke) {
        u(pool.includes(st.k), 'I4', `${st.k} nije u pool-u`)
        u(
          Number.isInteger(st.kom) && st.kom >= NARUDZBINA_KOM_MIN && st.kom <= NARUDZBINA_KOM_MAX,
          'I4',
          `kom ${st.kom}`,
        )
      }
      u(o.din > 0 && o.din % 5 === 0, 'I4', `din ${o.din}`)
      u(Number.isInteger(o.xp) && o.xp >= 3, 'I4', `xp ${o.xp}`)
      const m = MUSTERIJE.find((x) => x.ime === o.ime)
      u(
        !!m && m.emoji === o.emoji && m.boja === o.boja && m.poruke.includes(o.msg),
        'I4',
        'mušterija',
      )
    }
    u(Number.isInteger(s.xp) && s.xp >= preXp, 'I5', `xp ${preXp} → ${s.xp}`)
    preXp = s.xp
    const lvl = nivoIzXp(s.xp).lvl
    u(
      lvl >= 1 && lvl <= MAX_NIVO && g.prosliNivo === lvl,
      'I6',
      `nivo ${lvl}, prosli ${g.prosliNivo}`,
    )
    for (const id of MASINE_REDOSLED) {
      const m = s.masine[id]
      u(
        m.t === 0 || (m.k && Number.isInteger(m.t) && m.t > 0 && (!svezNow || m.t <= now)),
        'I7',
        `${id} ${JSON.stringify(m)}`,
      )
      pogledMasine(s, id, now)
    }
    for (const id of ZIV_REDOSLED) {
      const z = s.ziv[id]
      u(z.k ? z.t > 0 && (!svezNow || z.t <= now) : z.t === 0, 'I8', `${id} ${JSON.stringify(z)}`)
      const { n } = pogledZivotinje(s, id, now)
      u(Number.isInteger(n) && n >= 0 && n <= ZIV[id].kap, 'I8', `${id} n = ${n}`)
    }
    u(s.videno > 0 && (!svezNow || s.videno <= now), 'I9', `videno ${s.videno}`)
    for (const k of ['ubrano', 'zaradjeno', 'isporuke'] as const) {
      u(Number.isInteger(s.stat[k]) && s.stat[k] >= preStat[k], 'I10', `stat.${k}`)
    }
    preStat = { ...s.stat }
    const potpis = potpisNjiva(s, now)
    const tokeni = potpis.match(/x|z|f[123]/g) ?? []
    u(tokeni.join('') === potpis && tokeni.length === s.parcele.length, 'I14', potpis)
    const zrelih = zrelihUseva(s, now)
    u(
      zrelih === tokeni.filter((t) => t === 'z').length && zrelih <= s.parcele.length,
      'I14',
      'zrele',
    )
    s.parcele.forEach((p, i) => {
      const v = pogledParcele(p, now).vrsta
      const t = tokeni[i]
      u((v === 'zrela') === (t === 'z') && (v === 'prazna') === (t === 'x'), 'I14', `parcela ${i}`)
    })
    navTacke(s, now)
    u(opcijeSemena(s).length === REDOSLED.length, 'I14', 'list semena')
  }
  return {
    lvl: nivoIzXp(g.s.xp).lvl,
    parcele: g.s.parcele.length,
    zgrade: ZGRADE.filter((id) =>
      id === 'mlin' || id === 'kazan' ? g.s.masine[id].k : g.s.ziv[id].k,
    ).length,
    isporuke: g.s.stat.isporuke,
  }
}

/** referenca-sim TEST 3: bogat v3 sejv (novac 100 000, xp 5 000, poklonDan ''). */
const BOGAT = JSON.stringify(
  stanje({
    novac: 100_000,
    xp: 5000,
    mag: { ...MAG0, psenica: 20, sargarepa: 10, paprika: 9, bundeva: 2 },
    poklonDan: '',
  }),
)
/** 07 R7: sat odsustva sa zrelim usevima, gotovim mlinom i životinjama. */
const VID = T0 - 3_600_000
const ODSUSTVO = JSON.stringify(
  stanje({
    xp: 5000,
    videno: VID,
    parcele: [
      { c: 'psenica', t: VID - 10_000, z: false },
      { c: 'psenica', t: VID - 7_200_000, z: false },
      { c: 'sargarepa', t: T0 - 10_000, z: false },
      { c: 'grozdje', t: VID - 3_600_000, z: false },
    ],
    masine: { mlin: { k: true, t: VID - 60_000 }, kazan: { k: true, t: 0 } },
    ziv: { kokosinjac: { k: true, t: VID - 360_000 }, stala: { k: true, t: VID } },
  }),
)

describe('R5: fuzz invarijante', () => {
  const krajevi: Kraj[] = []

  it.each(SEEDOVI)('monoton, nova igra, seed %i', (seed) => {
    krajevi.push(pokreni(seed, KORACI, 'monoton', null))
  })

  it('monoton, bogat sejv (TEST 3) i sejv posle odsustva (R7)', () => {
    krajevi.push(pokreni(101, KORACI, 'monoton', BOGAT))
    krajevi.push(pokreni(102, KORACI, 'monoton', ODSUSTVO))
  })

  it.each(SEEDOVI)('sat ide i unazad (D4), seed %i', (seed) => {
    pokreni(seed, KORACI, 'unazad', seed % 2 ? null : BOGAT)
  })

  it.skipIf(SAMO_SEED !== null || KORACI < 2000)(
    'fuzz nije prazan: svaka akcija je i uspela i bila odbijena; igre stižu daleko',
    () => {
      for (const k of [
        'posadi',
        'zalij',
        'uberi',
        'uberiSve',
        'prodaj',
        'isporuci',
        'odbij',
        'kupiParcelu',
        'kupiZgradu',
        'pokreniMasinu',
        'pokupi',
        'tikMasina',
      ]) {
        const x = pokriveno.get(k)
        expect(x?.ok ?? 0, `${k} uspešno`).toBeGreaterThan(0)
        expect(x?.ne ?? 0, `${k} odbijeno`).toBeGreaterThan(0)
      }
      expect(pokriveno.get('prebaciZvuk')?.ok ?? 0).toBeGreaterThan(0)
      expect(pokriveno.get('noviDan')?.ok ?? 0).toBeGreaterThan(0)
      expect(Math.max(...krajevi.map((k) => k.lvl))).toBeGreaterThanOrEqual(8)
      expect(krajevi.some((k) => k.parcele === MAX_PARCELA)).toBe(true)
      expect(krajevi.some((k) => k.zgrade === 4)).toBe(true)
      expect(krajevi.every((k) => k.isporuke > 0)).toBe(true)
    },
  )
})
