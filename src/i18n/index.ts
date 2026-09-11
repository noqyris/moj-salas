/*
 * Ulaz u i18n: aktivni katalog `t` (za sada samo srpski), prevod core poruka u tekst i nazivi po ID-ju.
 * Core ne zna za tekst — događaji nose ID-jeve (`Poruka`, `Otkljucavanje`), a tekst bira ovaj modul.
 */
import { ZIV } from '../config'
import type { Otkljucavanje, Poruka } from '../core/dogadjaji'
import { sr, type Poruke } from './sr'

export { fmt, trajanjeTxt, vremeTxt } from './format'
export { sr, type MasinaTekst, type NazivTekst, type Poruke, type ZivotinjaTekst } from './sr'

/** Aktivni katalog stringova. */
export const t: Poruke = sr

/** Naziv robe po ID-ju (prototip `SVE_CENE[k].naziv`, velikim slovom). */
export const nazivArtikla = t.nazivArtikla
/** Naziv mašine ili životinje po ID-ju. */
export const nazivZgrade = t.nazivZgrade

/** Tekst toasta za poruku iz core-a (prototipovi pozivi `toast(…)`). */
export function porukaTekst(p: Poruka): string {
  switch (p.id) {
    case 'savetZalivanje':
      return t.toast.savetZalivanje
    case 'vecZaliveno':
      return t.toast.vecZaliveno
    case 'zaliveno':
      return t.toast.zaliveno
    case 'ubranoSve':
      return t.toast.ubranoSve(p.br)
    case 'prodato':
      return t.toast.prodato(p.kom, p.artikal, p.zarada)
    case 'zahvaljuje':
      return t.toast.zahvaljuje(p.ime, p.din)
    case 'nemasNovca':
      return t.toast.nemasNovca
    case 'ostaviZaSeme':
      return t.toast.ostaviZaSeme
    case 'novaParcela':
      return t.toast.novaParcela
    case 'zgradaNaFarmi':
      return t.toast.zgradaNaFarmi(p.zgrada)
    case 'pokupljeno':
      return t.toast.pokupljeno(p.n, ZIV[p.zivotinja].proizvod)
    case 'masinaGotova':
      return t.masine[p.masina].gotovo
  }
}

/** Natpis pločice „Otključano" u level-up kartici (prikaziNivo L715–721). Ikonicu bira
 *  `ikonicaOtkljucavanja` iz art/. */
export function nazivOtkljucavanja(o: Otkljucavanje): string {
  switch (o.vrsta) {
    case 'kultura':
      return t.kulture[o.id].naziv
    case 'masina':
      return t.masine[o.id].naziv
    case 'zivotinja':
      return t.zivotinje[o.id].naziv
    case 'aukcija':
      return t.noviNivo.aukcija
  }
}
