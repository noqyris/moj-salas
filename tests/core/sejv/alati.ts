/*
 * Alati za testove sejva: nezavisna provera oblika stanja, dozvoljena odstupanja od prototipa
 * (D8, D11) i seedovani generatori sejvova. Namerno NE koriste kod iz src/core/sejv.
 */
import {
  MASINE_REDOSLED,
  MAX_PARCELA,
  MUSTERIJE,
  REDOSLED,
  SVI_KLJUCEVI,
  ZIV_REDOSLED,
} from '../../../src/config'
import type { Narudzba, Parcela, Rng, Stanje } from '../../../src/core/types'
import { DAN_T0, MAG0, T0, narudzba, stanje } from '../../helpers'

export type Json = null | boolean | number | string | readonly Json[] | { [k: string]: Json }
export type JsonObj = { [k: string]: Json }

export const jeJsonObj = (x: unknown): x is JsonObj =>
  typeof x === 'object' && x !== null && !Array.isArray(x)

/** Duboka kopija preko JSON-a (isto što skladište radi sa stanjem). */
export const json = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T

// ── Oblik ────────────────────────────────────────────────────────────────────────

const KLJUCEVI_STANJA = [
  'v',
  'novac',
  'xp',
  'parcele',
  'mag',
  'masine',
  'ziv',
  'narudzbe',
  'mute',
  'sadio',
  'stat',
  'poklonDan',
  'videno',
]

/** Svi prekršaji oblika `Stanje` (prazno = ispravno), uključujući redosled ključeva kao POCETNO(). */
export function prekrsajiOblika(s: unknown): string[] {
  const g: string[] = []
  const kljucevi = (o: unknown, ocekivani: readonly string[], ime: string): o is JsonObj => {
    if (!jeJsonObj(o)) {
      g.push(`${ime}: nije objekat`)
      return false
    }
    if (Object.keys(o).join() !== ocekivani.join())
      g.push(`${ime}: ključevi ${Object.keys(o).join()}`)
    return true
  }
  const konacan = (x: unknown): x is number =>
    typeof x === 'number' && Number.isFinite(x) && !Object.is(x, -0)
  const kolicina = (x: unknown) => konacan(x) && Number.isInteger(x) && x >= 0
  if (!kljucevi(s, KLJUCEVI_STANJA, 'stanje')) return g
  if (s.v !== 3) g.push('v')
  if (!konacan(s.novac)) g.push('novac')
  if (!konacan(s.xp)) g.push('xp')
  if (typeof s.mute !== 'boolean') g.push('mute')
  if (typeof s.sadio !== 'boolean') g.push('sadio')
  if (typeof s.poklonDan !== 'string') g.push('poklonDan')
  if (!konacan(s.videno) || s.videno <= 0) g.push('videno')
  const p = s.parcele
  if (!Array.isArray(p) || p.length < 2 || p.length > MAX_PARCELA) g.push('parcele: broj')
  else {
    p.forEach((x, i) => {
      if (!kljucevi(x, ['c', 't', 'z'], `parcele[${i}]`)) return
      const kultura = x.c === null || (REDOSLED as readonly unknown[]).includes(x.c)
      if (!kultura || !konacan(x.t) || typeof x.z !== 'boolean') g.push(`parcele[${i}]: tipovi`)
      if (x.c === null && (x.t !== 0 || x.z !== false)) g.push(`parcele[${i}]: prazna sa t/z`)
    })
  }
  for (const [ime, ocekivani] of [
    ['mag', SVI_KLJUCEVI],
    ['stat', ['ubrano', 'zaradjeno', 'isporuke']],
  ] as const) {
    const o = s[ime]
    if (kljucevi(o, ocekivani, ime)) {
      for (const k of ocekivani) if (!kolicina(o[k])) g.push(`${ime}.${k}`)
    }
  }
  for (const [ime, ids] of [
    ['masine', MASINE_REDOSLED],
    ['ziv', ZIV_REDOSLED],
  ] as const) {
    const o = s[ime]
    if (!kljucevi(o, ids, ime)) continue
    for (const id of ids) {
      const z = o[id]
      if (!kljucevi(z, ['k', 't'], `${ime}.${id}`)) continue
      if (typeof z.k !== 'boolean' || !konacan(z.t)) g.push(`${ime}.${id}: tipovi`)
      if (!z.k && z.t !== 0) g.push(`${ime}.${id}: nekupljeno sa t`)
      if (ime === 'ziv' && z.k && !(konacan(z.t) && z.t > 0)) g.push(`${ime}.${id}: kupljeno bez t`)
    }
  }
  const n = s.narudzbe
  if (!Array.isArray(n)) g.push('narudzbe')
  else {
    const ids = new Set<unknown>()
    n.forEach((o, i) => {
      const ime = `narudzbe[${i}]`
      if (!kljucevi(o, ['id', 'ime', 'emoji', 'boja', 'msg', 'stavke', 'din', 'xp'], ime)) return
      if (typeof o.id !== 'number' || !Number.isSafeInteger(o.id) || o.id < 1) g.push(`${ime}.id`)
      if (ids.has(o.id)) g.push(`${ime}: dupli id`)
      ids.add(o.id)
      for (const f of ['ime', 'emoji', 'boja', 'msg'] as const) {
        if (typeof o[f] !== 'string') g.push(`${ime}.${f}`)
      }
      if (!konacan(o.din) || !konacan(o.xp)) g.push(`${ime}: din/xp`)
      if (!Array.isArray(o.stavke) || o.stavke.length === 0) g.push(`${ime}.stavke`)
      else {
        o.stavke.forEach((st, j) => {
          if (!kljucevi(st, ['k', 'kom'], `${ime}.stavke[${j}]`)) return
          const artikal = (SVI_KLJUCEVI as readonly unknown[]).includes(st.k)
          if (!artikal || !Number.isInteger(st.kom) || !(konacan(st.kom) && st.kom >= 1)) {
            g.push(`${ime}.stavke[${j}]`)
          }
        })
      }
    })
  }
  return g
}

// ── Dozvoljena odstupanja od prototipa ───────────────────────────────────────────

/** D8: v2 narudžbina nema poruku — prva poruka mušterije istog imena, inače ''. */
export function prvaPorukaMusterije(ime: unknown): string {
  return MUSTERIJE.find((m) => m.ime === ime)?.poruke[0] ?? ''
}

/**
 * Prototipovo `S` posle `ucitaj()` → ono što port MORA da vrati za isti sejv. Primenjuje TAČNO
 * odobrena odstupanja iz ugovora §3 i ništa više:
 */
export function primeniDozvoljenaOdstupanja(S: unknown): JsonObj {
  const kopija = json(S)
  if (!jeJsonObj(kopija)) throw new Error('S nije objekat')
  // D11 (01 D1, 06 bug 13): v2 ključevi `kazan`/`kazanT` se NE zadržavaju na vrhu stanja
  // (prototip ih posle migracije ponovo zapisuje zauvek; stvarno stanje kazana je u masine.kazan).
  delete kopija.kazan
  delete kopija.kazanT
  // D8 (01 D2, 06 bug 5): v2 narudžbina `{id, ko:{ime,emoji,boja}, stavke, din, xp}` postaje v3
  // `{id, ime, emoji, boja, msg, stavke, din, xp}` — boja ostaje SAČUVANA (npr. '#fff'), `msg` je
  // prva poruka mušterije istog imena iz MUSTERIJE (inače ''), a `ko` se uklanja.
  // Prototip ih je čuvao takve i crtao „undefined".
  const n = kopija.narudzbe
  if (Array.isArray(n)) {
    kopija.narudzbe = n.map((o) => {
      if (!jeJsonObj(o) || !jeJsonObj(o.ko)) return o
      const ko = o.ko
      return {
        id: o.id ?? null,
        ime: ko.ime ?? null,
        emoji: ko.emoji ?? null,
        boja: ko.boja ?? null,
        msg: prvaPorukaMusterije(ko.ime),
        stavke: o.stavke ?? null,
        din: o.din ?? null,
        xp: o.xp ?? null,
      }
    })
  }
  return kopija
}

// ── Sejvovi ──────────────────────────────────────────────────────────────────────

/** Bogat, ispravan v3 sejv: nijedno polje nije na podrazumevanoj vrednosti, pa se svako
 *  vraćanje na podrazumevano vidi. */
export function bogatoStanje(): Stanje {
  return stanje({
    novac: 1234,
    xp: 5000,
    parcele: [
      { c: 'psenica', t: T0 - 5000, z: true },
      { c: null, t: 0, z: false },
      { c: 'paprika', t: T0 - 60_000, z: false },
    ],
    mag: { ...MAG0, psenica: 5, sargarepa: 1, brasno: 2, jaje: 3, mleko: 4 },
    masine: { mlin: { k: true, t: T0 - 30_000 }, kazan: { k: true, t: 0 } },
    ziv: { kokosinjac: { k: true, t: T0 - 400_000 }, stala: { k: true, t: T0 - 100 } },
    narudzbe: [
      narudzba(7, 'psenica', 3, 70, 6),
      {
        id: 8,
        ime: 'Piljar Pera',
        emoji: '🧢',
        boja: '#d9f0ff',
        msg: 'Plaćam odmah, kao i uvek.',
        stavke: [
          { k: 'sargarepa', kom: 1 },
          { k: 'psenica', kom: 2 },
        ],
        din: 130,
        xp: 10,
      },
    ],
    mute: true,
    sadio: true,
    stat: { ubrano: 11, zaradjeno: 222, isporuke: 3 },
    poklonDan: DAN_T0,
    videno: T0 - 3_600_000,
  })
}

/** referenca-sim TEST 4 v2 fikstura, T0-relativna (07 R3). */
export function v2Test4(): JsonObj {
  return {
    v: 2,
    novac: 777,
    xp: 150,
    parcele: [
      { c: 'paprika', t: T0 - 60_000 },
      { c: null, t: 0 },
    ],
    mag: { psenica: 3, sargarepa: 0, paprika: 2, bundeva: 0, grozdje: 1, ajvar: 1 },
    kazan: true,
    kazanT: 0,
    narudzbe: [
      {
        id: 5,
        ko: { ime: 'Baka Mira', emoji: '👵', boja: '#fff' },
        stavke: [{ k: 'psenica', kom: 2 }],
        din: 60,
        xp: 5,
      },
      {
        id: 6,
        ko: { ime: 'Piljar Pera', emoji: '🧢', boja: '#fff' },
        stavke: [{ k: 'sargarepa', kom: 1 }],
        din: 80,
        xp: 6,
      },
    ],
    mute: false,
    sadio: true,
    videno: T0,
  }
}

const izaberi = <T>(r: Rng, niz: readonly T[]): T => {
  const x = niz[Math.floor(r() * niz.length)]
  if (x === undefined) throw new Error('prazan niz')
  return x
}
const ceo = (r: Rng, od: number, doN: number): number => od + Math.floor(r() * (doN - od + 1))

function nasumicnaNarudzba(r: Rng, id: number): Narudzba {
  const m = izaberi(r, MUSTERIJE)
  const prvi = izaberi(r, SVI_KLJUCEVI)
  const drugi = izaberi(r, SVI_KLJUCEVI)
  const stavke = [{ k: prvi, kom: ceo(r, 1, 12) }]
  if (drugi !== prvi && r() < 0.5) stavke.push({ k: drugi, kom: ceo(r, 1, 12) })
  return {
    id,
    ime: m.ime,
    emoji: m.emoji,
    boja: m.boja,
    msg: izaberi(r, m.poruke),
    stavke,
    din: 5 * ceo(r, 1, 400),
    xp: ceo(r, 3, 300),
  }
}

/** Nasumično ISPRAVNO v3 stanje — ono što port (ili prototip) može da zapiše. */
export function nasumicnoStanje(r: Rng, now: number): Stanje {
  const parcele: Parcela[] = Array.from({ length: ceo(r, 2, MAX_PARCELA) }, () =>
    r() < 0.4
      ? { c: null, t: 0, z: false }
      : { c: izaberi(r, REDOSLED), t: now - ceo(r, 0, 9_000_000), z: r() < 0.5 },
  )
  const ids = new Set<number>()
  const brojNarudzbina = ceo(r, 0, 3)
  while (ids.size < brojNarudzbina) ids.add(ceo(r, 1, 999))
  const zgrada = (radi: boolean) => {
    const k = r() < 0.5
    return { k, t: k && (radi || r() < 0.5) ? now - ceo(r, 1, 9_000_000) : 0 }
  }
  return {
    v: 3,
    novac: ceo(r, 0, 1_000_000),
    xp: ceo(r, 0, 7_000_000),
    parcele,
    mag: Object.fromEntries(SVI_KLJUCEVI.map((k) => [k, ceo(r, 0, 60)])) as Stanje['mag'],
    masine: { mlin: zgrada(false), kazan: zgrada(false) },
    ziv: { kokosinjac: zgrada(true), stala: zgrada(true) },
    narudzbe: [...ids].map((id) => nasumicnaNarudzba(r, id)),
    mute: r() < 0.5,
    sadio: r() < 0.5,
    stat: { ubrano: ceo(r, 0, 999), zaradjeno: ceo(r, 0, 99_999), isporuke: ceo(r, 0, 99) },
    poklonDan: r() < 0.3 ? '' : `2026-01-${String(ceo(r, 1, 28)).padStart(2, '0')}`,
    videno: now - ceo(r, 0, 90_000_000),
  }
}

/** v2 narudžbina (sa `ko`) iz ispravne v3 narudžbine. */
export function uV2Narudzbu(o: Narudzba): JsonObj {
  return {
    id: o.id,
    ko: { ime: o.ime, emoji: o.emoji, boja: '#fff' },
    stavke: o.stavke.map((s) => ({ k: s.k, kom: s.kom })),
    din: o.din,
    xp: o.xp,
  }
}

/** Nasumičan v2 sejv kakav je stari build mogao da zapiše (01 §a.2). */
export function nasumicanV2(r: Rng, now: number): JsonObj {
  const s = nasumicnoStanje(r, now)
  const kazan = r() < 0.5
  const o: JsonObj = {
    v: 2,
    novac: s.novac,
    xp: s.xp,
    parcele: s.parcele.map((p) => (p.c ? { c: p.c, t: p.t } : { c: null, t: 0 })),
    mag: Object.fromEntries(
      (['psenica', 'sargarepa', 'paprika', 'bundeva', 'grozdje', 'ajvar'] as const).map((k) => [
        k,
        s.mag[k],
      ]),
    ),
    kazan,
    kazanT: kazan && r() < 0.5 ? now - ceo(r, 1, 900_000) : 0,
    narudzbe: s.narudzbe.map(uV2Narudzbu),
    mute: s.mute,
    sadio: s.sadio,
  }
  if (r() < 0.7) o.videno = s.videno
  if (r() < 0.3) o.stat = { ubrano: s.stat.ubrano, zaradjeno: s.stat.zaradjeno }
  if (r() < 0.3) o.poklonDan = s.poklonDan
  return o
}

/** v3 sejv kakav prototip zapiše posle v2 migracije: `kazan/kazanT` na vrhu + v2 narudžbine. */
export function v3PosleMigracije(r: Rng, now: number): JsonObj {
  const s = json(nasumicnoStanje(r, now)) as unknown as JsonObj
  const v2 = nasumicanV2(r, now)
  return { ...s, kazan: v2.kazan ?? false, kazanT: v2.kazanT ?? 0, narudzbe: v2.narudzbe ?? [] }
}
