/*
 * normalizujV3 (01 §h.3 + D8, D10, D11): od bilo kakvog objekta sa v:3 gradi NOVO, ispravno
 * `Stanje` — ništa iz ulaza se ne deli sa rezultatom i ništa se ne dodeljuje „do pola" (01 B3).
 *
 * Pravilo pariteta: za svaki sejv koji prototip može da proizvede, rezultat je duboko jednak
 * prototipovom `S` posle `ucitaj()` (L548–569), osim odobrenih odstupanja D8 (spljoštene v2
 * narudžbine) i D11 (bez `kazan/kazanT` na vrhu). To dokazuje zlatni fajl
 * (tests/core/sejv/zlatni.test.ts). Sve ostalo je ispravka ručno izmenjenog ili oštećenog
 * sejva (01 B3, B8–B11) i beleži se u `popravke`; tada kontroler čuva rezervu originala (D10).
 */
import {
  MASINE_REDOSLED,
  MAX_PARCELA,
  MUSTERIJE,
  SVI_KLJUCEVI,
  ZIV_REDOSLED,
  jeArtikal,
  jeKultura,
} from '../../config'
import { pocetnoStanje, praznaParcela } from '../stanje'
import type { Masina, Narudzba, Parcela, Stanje, Stat, Stavka, Zivotinja } from '../types'
import { ima, jeObjekat, popravka, type Obj, type VrstaPopravke } from './tipovi'

export interface Normalizovano {
  stanje: Stanje
  /** Šta je ispravljeno (vidi `VrstaPopravke`). Prazno ⇔ ništa iz originala nije izgubljeno. */
  popravke: string[]
}

const KLJUCEVI_STANJA: readonly string[] = Object.keys(pocetnoStanje(0))
const KLJUCEVI_STAT = ['ubrano', 'zaradjeno', 'isporuke'] as const satisfies readonly (keyof Stat)[]
const POLJA_PARCELE = ['c', 't', 'z'] as const
const POLJA_ZGRADE = ['k', 't'] as const
const POLJA_STAVKE = ['k', 'kom'] as const
const POLJA_MUSTERIJE = ['ime', 'emoji', 'boja'] as const
/** Polja narudžbine; `ko` je v2 oblik mušterije (D8) i spljošti se. */
const POLJA_NARUDZBE = ['id', 'ime', 'emoji', 'boja', 'msg', 'stavke', 'din', 'xp', 'ko'] as const

const konacan = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
/** JSON dozvoljava `-0`; stanje ga nikad ne sadrži (JSON.stringify ga ionako piše kao 0). */
const bezNule = (x: number): number => (x === 0 ? 0 : x)
const tekst = (x: unknown): string | undefined => (typeof x === 'string' ? x : undefined)

/** Beleži popravke; narudžbina koja se na kraju odbaci ne sme da ostavi svoje sitne popravke. */
class Zapisnik {
  readonly popravke: string[] = []
  dodaj(putanja: string, vrsta: VrstaPopravke): void {
    this.popravke.push(popravka(putanja, vrsta))
  }
  /** Svaki ključ van `poznati` se odbacuje; `prefiks` je putanja roditelja sa tačkom (ili ''). */
  odbaciNepoznate(o: Obj, poznati: readonly string[], prefiks: string): void {
    for (const k of Object.keys(o)) if (!poznati.includes(k)) this.dodaj(prefiks + k, 'odbaceno')
  }
}

export function normalizujV3(o: Obj, now: number): Normalizovano {
  const z = new Zapisnik()
  const s = pocetnoStanje(now)

  // Nepoznati ključevi na vrhu — uključujući v2 ostatke `kazan/kazanT` koje prototip ostavlja
  // u v3 sejvu posle migracije. ODSTUPANJE D11: prototip ih čuva zauvek (01 G1, 06 bug 13).
  z.odbaciNepoznate(o, KLJUCEVI_STANJA, '')

  // Skalari: prototip bi zadržao bilo šta (01 G3); ovde samo ispravan tip, inače podrazumevano.
  if (ima(o, 'novac')) s.novac = broj(o.novac, s.novac, 'novac', z)
  if (ima(o, 'xp')) s.xp = broj(o.xp, s.xp, 'xp', z)
  if (ima(o, 'mute')) s.mute = logicka(o.mute, 'mute', z)
  if (ima(o, 'sadio')) s.sadio = logicka(o.sadio, 'sadio', z)
  if (ima(o, 'poklonDan')) {
    if (typeof o.poklonDan === 'string') s.poklonDan = o.poklonDan
    else z.dodaj('poklonDan', 'zamenjeno')
  }
  // Bez `videno` ostaje `now` (= startni `pre`), kao prototipov `d.videno`: nema „dobro došao nazad".
  if (ima(o, 'videno')) {
    if (konacan(o.videno) && o.videno > 0) s.videno = o.videno
    else z.dodaj('videno', 'zamenjeno')
  }

  // Magacin i statistika: samo poznati ključevi, celi brojevi ≥ 0 (01 G2, B8; 06 bug 1 `"null"`).
  if (ima(o, 'mag')) podobjekat(o.mag, s.mag, SVI_KLJUCEVI, 'mag', z, kolicina)
  if (ima(o, 'stat')) podobjekat(o.stat, s.stat, KLJUCEVI_STAT, 'stat', z, kolicina)

  // Zgrade: prototip spaja PO DETETU (L559–562) — `masine` bez `mlin` vraća mlin na početno.
  if (ima(o, 'masine')) podobjekat(o.masine, s.masine, MASINE_REDOSLED, 'masine', z, masina)
  if (ima(o, 'ziv')) {
    podobjekat(o.ziv, s.ziv, ZIV_REDOSLED, 'ziv', z, (x, putanja, zz) =>
      zivotinja(x, putanja, zz, now),
    )
  }

  // Parcele: nepostojeće, [] ili ne-niz → 2 početne (L563). Najviše MAX_PARCELA (01 B10).
  if (ima(o, 'parcele')) {
    const x = o.parcele
    if (Array.isArray(x) && x.length > 0) {
      for (let i = MAX_PARCELA; i < x.length; i++) z.dodaj(`parcele[${i}]`, 'odbaceno')
      s.parcele = x
        .slice(0, MAX_PARCELA)
        .map((e: unknown, i: number) => parcela(e, `parcele[${i}]`, z))
    } else if (!Array.isArray(x)) {
      z.dodaj('parcele', 'zamenjeno')
    }
  }

  // Narudžbine: ne-niz → [] (L565). Neispravne i kasniji duplikati id-ja se odbacuju (01 B9);
  // sve ispravne ostaju, i kad ih je više od 2 (paritet — broj se sam svede na 2).
  if (ima(o, 'narudzbe')) {
    const x = o.narudzbe
    if (Array.isArray(x)) {
      const ids = new Set<number>()
      x.forEach((e: unknown, i: number) => {
        const putanja = `narudzbe[${i}]`
        const lokalno = new Zapisnik()
        const n = narudzba(e, putanja, lokalno)
        if (n === null || ids.has(n.id)) {
          z.dodaj(putanja, 'odbaceno')
          return
        }
        ids.add(n.id)
        s.narudzbe.push(n)
        z.popravke.push(...lokalno.popravke)
      })
    } else {
      z.dodaj('narudzbe', 'zamenjeno')
    }
  }

  return { stanje: s, popravke: z.popravke }
}

// ── Polja ────────────────────────────────────────────────────────────────────────

/** Normalizuje poznate ključeve podobjekta (mag, stat, masine, ziv) u već popunjen `cilj`. */
function podobjekat<K extends string, T>(
  izvor: unknown,
  cilj: Record<K, T>,
  kljucevi: readonly K[],
  putanja: string,
  z: Zapisnik,
  polje: (x: unknown, putanja: string, z: Zapisnik) => T,
): void {
  if (!jeObjekat(izvor)) {
    z.dodaj(putanja, 'zamenjeno')
    return
  }
  z.odbaciNepoznate(izvor, kljucevi, `${putanja}.`)
  for (const k of kljucevi) if (ima(izvor, k)) cilj[k] = polje(izvor[k], `${putanja}.${k}`, z)
}

function broj(x: unknown, podrazumevano: number, putanja: string, z: Zapisnik): number {
  if (konacan(x)) return bezNule(x)
  z.dodaj(putanja, 'zamenjeno')
  return podrazumevano
}

/** `!!x` kao prototip (istinita vrednost se tamo i ponašala kao `true`). */
function logicka(x: unknown, putanja: string, z: Zapisnik): boolean {
  if (typeof x !== 'boolean') z.dodaj(putanja, 'ispravljeno')
  return !!x
}

/** Količina u magacinu / statistici: ceo broj ≥ 0 (`"3"` bi u prototipu dao `"3"+2 = "32"`). */
function kolicina(x: unknown, putanja: string, z: Zapisnik): number {
  if (!konacan(x) || x < 0) {
    z.dodaj(putanja, 'zamenjeno')
    return 0
  }
  const ceo = Math.floor(x)
  if (ceo !== x) z.dodaj(putanja, 'ispravljeno')
  return bezNule(ceo)
}

/** Vremenska oznaka zgrade: konačan broj, inače 0. */
function sidroZgrade(x: Obj, putanja: string, z: Zapisnik): number {
  if (!ima(x, 't')) return 0
  if (konacan(x.t)) return bezNule(x.t)
  z.dodaj(`${putanja}.t`, 'zamenjeno')
  return 0
}

function zgrada(x: unknown, putanja: string, z: Zapisnik): Masina | null {
  if (!jeObjekat(x)) {
    z.dodaj(putanja, 'zamenjeno')
    return null
  }
  z.odbaciNepoznate(x, POLJA_ZGRADE, `${putanja}.`)
  const k = ima(x, 'k') ? logicka(x.k, `${putanja}.k`, z) : false
  let t = sidroZgrade(x, putanja, z)
  if (!k && t !== 0) {
    // Nekupljena zgrada ne radi: `kazan {k:false, t>0}` bi zauvek držao `nestoRaste()` (01 G7).
    t = 0
    z.dodaj(`${putanja}.t`, 'ispravljeno')
  }
  return { k, t }
}

function masina(x: unknown, putanja: string, z: Zapisnik): Masina {
  return zgrada(x, putanja, z) ?? { k: false, t: 0 }
}

function zivotinja(x: unknown, putanja: string, z: Zapisnik, now: number): Zivotinja {
  const zg = zgrada(x, putanja, z)
  if (!zg) return { k: false, t: 0 }
  if (zg.k && zg.t <= 0) {
    // Kupljena životinja bez sidra bi davala pun kapacitet pri svakom „Pokupi" (01 G8).
    z.dodaj(`${putanja}.t`, 'ispravljeno')
    return { k: true, t: now }
  }
  return zg
}

function parcela(e: unknown, putanja: string, z: Zapisnik): Parcela {
  // `null` parcela (retki niz posle bajatog `izabrana`) je u prototipu rušila učitavanje (01 B3).
  if (!jeObjekat(e)) {
    z.dodaj(putanja, 'zamenjeno')
    return praznaParcela()
  }
  z.odbaciNepoznate(e, POLJA_PARCELE, `${putanja}.`)
  if (!jeKultura(e.c)) {
    // Prazna parcela. Nepoznata kultura (npr. iz novijeg builda) bi u prototipu srušila start
    // (KULTURE[p.c].vreme, 01 G6) — ovde parcela postaje prazna, a original ide u rezervu.
    if (ima(e, 'c') && e.c !== null) z.dodaj(`${putanja}.c`, 'zamenjeno')
    if (ima(e, 't') && e.t !== 0) z.dodaj(`${putanja}.t`, 'zamenjeno')
    if (ima(e, 'z') && e.z !== false) z.dodaj(`${putanja}.z`, 'zamenjeno')
    return praznaParcela()
  }
  let t = 0
  if (ima(e, 't')) {
    if (konacan(e.t)) t = bezNule(e.t)
    else z.dodaj(`${putanja}.t`, 'zamenjeno')
  }
  const zalivena = ima(e, 'z') ? logicka(e.z, `${putanja}.z`, z) : false
  return { c: e.c, t, z: zalivena }
}

// ── Narudžbine ───────────────────────────────────────────────────────────────────

/** Pozitivan ceo id; string samih cifara se prevodi (`'9'` → 9). Bezbedan ceo broj, da
 *  `brojacN++` posle učitavanja uvek daje nov id. */
function idNarudzbe(x: unknown): number | null {
  const n = typeof x === 'string' && /^\d+$/.test(x) ? Number(x) : x
  return typeof n === 'number' && Number.isSafeInteger(n) && n >= 1 ? n : null
}

/** D8: poruka v2 narudžbine = prva poruka mušterije istog imena iz MUSTERIJE, inače ''. */
function prvaPoruka(ime: string): string {
  return MUSTERIJE.find((m) => m.ime === ime)?.poruke[0] ?? ''
}

function narudzba(e: unknown, putanja: string, z: Zapisnik): Narudzba | null {
  if (!jeObjekat(e)) return null
  const id = idNarudzbe(e.id)
  if (id === null) return null
  // Bez stavki prototip pada u crtajNarudzbe (o.stavke.every) i start se ne sačuva (01 B9).
  if (!Array.isArray(e.stavke) || e.stavke.length === 0) return null
  const ulaz: unknown[] = e.stavke
  const stavke: Stavka[] = []
  for (const [j, st] of ulaz.entries()) {
    if (!jeObjekat(st) || !jeArtikal(st.k)) return null
    if (typeof st.kom !== 'number' || !Number.isInteger(st.kom) || st.kom < 1) return null
    z.odbaciNepoznate(st, POLJA_STAVKE, `${putanja}.stavke[${j}].`)
    stavke.push({ k: st.k, kom: st.kom })
  }
  if (!konacan(e.din) || !konacan(e.xp)) return null

  if (typeof e.id !== 'number') z.dodaj(`${putanja}.id`, 'ispravljeno')
  z.odbaciNepoznate(e, POLJA_NARUDZBE, `${putanja}.`)

  // D8: v2 narudžbina nosi mušteriju kao `ko:{ime,emoji,boja}` — polja se spljošte na vrh
  // (sačuvana boja, npr. '#fff', ostaje; NE uzima se boja iz MUSTERIJE), a `ko` se uklanja.
  // Prototip ih je čuvao takve i crtao „undefined" (06 bug 5).
  const ko = jeObjekat(e.ko) ? e.ko : {}
  if (ima(e, 'ko') && !jeObjekat(e.ko)) z.dodaj(`${putanja}.ko`, 'odbaceno')
  z.odbaciNepoznate(ko, POLJA_MUSTERIJE, `${putanja}.ko.`)
  const musterija = (f: (typeof POLJA_MUSTERIJE)[number]): string => {
    const gore = tekst(e[f])
    if (ima(e, f) && gore === undefined) z.dodaj(`${putanja}.${f}`, 'zamenjeno')
    const vrednost = gore ?? tekst(ko[f]) ?? ''
    if (ima(ko, f) && ko[f] !== vrednost) z.dodaj(`${putanja}.ko.${f}`, 'odbaceno')
    return vrednost
  }
  const ime = musterija('ime')
  const emoji = musterija('emoji')
  const boja = musterija('boja')

  const msg = tekst(e.msg) ?? prvaPoruka(ime)
  if (ima(e, 'msg') && typeof e.msg !== 'string') z.dodaj(`${putanja}.msg`, 'zamenjeno')

  return { id, ime, emoji, boja, msg, stavke, din: bezNule(e.din), xp: bezNule(e.xp) }
}
