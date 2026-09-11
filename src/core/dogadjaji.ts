/*
 * Akcije u core-u menjaju stanje i vraćaju UREĐENU listu događaja. UI ih izvršava redom
 * (zvuk, vibracija, toast, FX, level-up kartice), pa crta i čuva prema `cuvaj`.
 * Core ne zna za tekst: poruke nose ID, a srpski tekst bira i18n.
 */
import type { ArtikalId, KulturaId, MasinaId, ZgradaId, ZivotinjaId } from '../config'
import type { Stanje } from './types'

export type ZvukId = 'tap' | 'sadnja' | 'voda' | 'zetva' | 'novac' | 'nivo' | 'greska'

/** Element od kog polaze FX (leteći novčići, „+XP"). */
export type Sidro =
  | { vrsta: 'parcela'; i: number }
  | { vrsta: 'uberiSve' }
  | { vrsta: 'prodaja'; artikal: ArtikalId }
  | { vrsta: 'narudzba'; id: number }
  | { vrsta: 'masina'; id: MasinaId }
  | { vrsta: 'zivotinja'; id: ZivotinjaId }

export type Poruka =
  | { id: 'savetZalivanje' }
  | { id: 'vecZaliveno' }
  | { id: 'zaliveno' }
  | { id: 'ubranoSve'; br: number }
  | { id: 'prodato'; kom: number; artikal: ArtikalId; zarada: number }
  | { id: 'zahvaljuje'; ime: string; din: number }
  | { id: 'nemasNovca' }
  | { id: 'ostaviZaSeme' }
  | { id: 'novaParcela' }
  | { id: 'zgradaNaFarmi'; zgrada: ZgradaId }
  | { id: 'pokupljeno'; n: number; zivotinja: ZivotinjaId }
  | { id: 'masinaGotova'; masina: MasinaId }

export type Otkljucavanje =
  | { vrsta: 'kultura'; id: KulturaId }
  | { vrsta: 'masina'; id: MasinaId }
  | { vrsta: 'zivotinja'; id: ZivotinjaId }
  | { vrsta: 'aukcija' }

export type Dogadjaj =
  | { tip: 'zvuk'; id: ZvukId }
  | { tip: 'vibracija'; obrazac: number | readonly number[] }
  /** `odlozenoMs` samo za savet posle prve sadnje (config SAVET_ZALIVANJE_ODLAGANJE_MS). */
  | { tip: 'poruka'; poruka: Poruka; odlozenoMs?: number }
  /** UI: leti min(broj, 6) novčića ka novčaniku, pa zvuk 'novac' posle NOVAC_ZVUK_ODLAGANJE_MS. */
  | { tip: 'novcici'; sidro: Sidro; broj: number }
  /** UI: lebdeći „+N XP" iznad sidra, pa osvežen prikaz nivoa. */
  | { tip: 'xp'; iznos: number; sidro: Sidro }
  /** Bonus je već dodat u stanje. UI: kartica u red → zvuk 'nivo' → vibracija → konfete → novac. */
  | { tip: 'nivo'; nivo: number; bonus: number; otkljucano: Otkljucavanje[] }
  /** UI: kapi vode na parceli i, i uklanjanje ikonice kapljice. */
  | { tip: 'kapi'; i: number }

/** 'ne' = ništa se nije promenilo; 'odlozeno' = debounce; 'odmah' = odmah upiši. */
export type Cuvanje = 'ne' | 'odlozeno' | 'odmah'

export interface Rezultat {
  /** false = akcija odbijena; tada se stanje NIJE promenilo i `cuvaj` je 'ne'. */
  ok: boolean
  dogadjaji: Dogadjaj[]
  cuvaj: Cuvanje
}

/** Sesija: stanje + izvedene vrednosti koje se NE čuvaju, već se računaju pri učitavanju. */
export interface Igra {
  s: Stanje
  /** Poslednji nivo za koji je prikazan level-up (= nivo iz XP posle učitavanja). */
  prosliNivo: number
  /** Sledeći ID narudžbine (= max(id) + 1 posle učitavanja). */
  brojacN: number
}

export const ODBIJENO: Rezultat = Object.freeze({ ok: false, dogadjaji: [], cuvaj: 'ne' as const })
