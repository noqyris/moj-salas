/*
 * Stanje igre. Oblik je IDENTIČAN v3 sejvu prototipa (JSON.stringify(S)) — ista imena polja,
 * iste jedinice — jer se sejv čuva pod istim ključem i mora da ostane čitljiv u oba smera.
 *
 * Jedinice: svi timestampovi su epoch milisekunde (`Date.now()`), sva trajanja u config-u su sekunde.
 */
import type { ArtikalId, KulturaId, MasinaId, ZivotinjaId } from '../config'

export type EpochMs = number

export interface Parcela {
  /** Kultura na parceli, ili null za praznu parcelu. */
  c: KulturaId | null
  /** „Efektivno vreme sadnje" (ms). Zrela kad je (now − t)/1000 ≥ KULTURE[c].vreme. Zalivanje
   *  pomera t unazad za 25 % preostalog vremena. 0 kad je c === null. */
  t: EpochMs
  /** Zalivena — najviše jednom po usevu. */
  z: boolean
}

export interface Masina {
  /** Kupljena. */
  k: boolean
  /** Početak ture koja traje (ms); 0 = miruje. Tura se završava samo u ticku. */
  t: EpochMs
}

export interface Zivotinja {
  /** Kupljena. */
  k: boolean
  /** Sidro proizvodnje (ms): spremno = min(kap, floor((now − t) / interval)). 0 dok nije kupljena. */
  t: EpochMs
}

export interface Stavka {
  k: ArtikalId
  /** Ceo broj 1..12. */
  kom: number
}

export interface Narudzba {
  /** Pozitivan ceo broj, jedinstven među aktivnim narudžbinama. */
  id: number
  /** Podaci mušterije se KOPIRAJU iz MUSTERIJE kad narudžbina nastane (tako ih čuva i sejv). */
  ime: string
  emoji: string
  boja: string
  msg: string
  /** 1 ili 2 stavke sa različitim artiklima. */
  stavke: Stavka[]
  /** Nagrada u dinarima (deljiva sa 5). */
  din: number
  /** Nagrada u XP (≥ 3). */
  xp: number
}

export interface Stat {
  /** Ubrani usevi + pokupljeni životinjski proizvodi (izlaz mašina se NE broji). */
  ubrano: number
  /** Dinari od prodaje i narudžbina (bonusi i pokloni se NE broje). */
  zaradjeno: number
  isporuke: number
}

export interface Stanje {
  v: 3
  novac: number
  xp: number
  /** 2..9 parcela. */
  parcele: Parcela[]
  /** Svih 9 ključeva uvek postoji; celi brojevi ≥ 0. */
  mag: Record<ArtikalId, number>
  masine: Record<MasinaId, Masina>
  ziv: Record<ZivotinjaId, Zivotinja>
  /** Tačno 2 posle starta i posle svake akcije. */
  narudzbe: Narudzba[]
  mute: boolean
  /** Igrač je bar jednom posadio (hint, dnevni poklon, prvi toast). */
  sadio: boolean
  stat: Stat
  /** '' ili lokalni dan poslednjeg dnevnog poklona, 'YYYY-MM-DD'. */
  poklonDan: string
  /** Vreme poslednjeg ZAHTEVA za čuvanje (ms) — „poslednji put viđen" za ekran povratka. */
  videno: EpochMs
}

/** Nasumičnost koju core koristi (samo za narudžbine): vrednosti iz [0, 1). */
export type Rng = () => number
