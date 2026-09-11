/*
 * Sav balans na jednom mestu. Formule čuvaju TAČAN redosled operacija iz prototipa
 * (moja-farma-v3.html) jer testovi pariteta porede rezultate bit za bit.
 */
import type { KulturaId } from './kulture'

// ── Start ────────────────────────────────────────────────────────────────────
export const POCETNI_NOVAC = 50
export const POCETNE_PARCELE = 2

// ── Parcele ──────────────────────────────────────────────────────────────────
export const MAX_PARCELA = 9
const PARCELA_CENA_BAZA = 150
const PARCELA_CENA_RAST = 2.2
const PARCELA_CENA_ZAOKRUZI = 10

/** Cena sledeće parcele kad igrač trenutno ima `n` parcela: n=2 → 150, 3 → 330 … 8 → 17 010. */
export function cenaParcele(n: number): number {
  return (
    Math.round((PARCELA_CENA_BAZA * Math.pow(PARCELA_CENA_RAST, n - 2)) / PARCELA_CENA_ZAOKRUZI) *
    PARCELA_CENA_ZAOKRUZI
  )
}

// ── Rast i zalivanje ─────────────────────────────────────────────────────────
/** Udeo rasta od kog biljka prelazi u fazu 2, odnosno 3 (faza 1 je klica). */
export const FAZA_2_OD = 0.35
export const FAZA_3_OD = 0.8
/** Zalivanje (jednom po usevu) skraćuje PREOSTALO vreme za ovaj udeo. */
export const ZALIVANJE_UDEO = 0.25

// ── XP i nivoi ───────────────────────────────────────────────────────────────
const XP_BAZA = 30
const XP_RAST = 1.9
export const MAX_NIVO = 20
const NIVO_BONUS_PO_NIVOU = 40
/** Nivo na kome level-up kartica najavljuje aukciju („Aukcija uskoro"). */
export const AUKCIJA_NIVO = 6

/** XP potreban da se sa nivoa `l` pređe na `l + 1`. */
export function xpZaNivo(l: number): number {
  return Math.round(XP_BAZA * Math.pow(XP_RAST, l - 1))
}

/** Novčani bonus za dostizanje nivoa `l`. */
export function nivoBonus(l: number): number {
  return l * NIVO_BONUS_PO_NIVOU
}

// ── Pijaca ───────────────────────────────────────────────────────────────────
export const PIJACA_AMPLITUDA = 0.15
export const PIJACA_PERIOD_MS = 600_000
/** Fazni pomak po indeksu artikla u `SVI_KLJUCEVI`, da sve cene ne rastu istovremeno. */
export const PIJACA_FAZNI_POMAK = 1.7
/** Množilac od kog je cena „▲ dobra", odnosno do kog je „▼ slaba". */
export const PIJACA_PRAG_GORE = 1.02
export const PIJACA_PRAG_DOLE = 0.98
export const PIJACA_MIN_CENA = 1

/** Tržišni množilac u trenutku `now` za artikal sa indeksom `idx`. */
export function pijacaMnozilac(now: number, idx: number): number {
  return (
    1 +
    PIJACA_AMPLITUDA * Math.sin((now / PIJACA_PERIOD_MS) * Math.PI * 2 + idx * PIJACA_FAZNI_POMAK)
  )
}

// ── Narudžbine ───────────────────────────────────────────────────────────────
export const NARUDZBINA_AKTIVNIH = 2
/** U pool ulaze samo kulture koje rastu najviše ovoliko sekundi (grožđe ne ulazi). */
export const NARUDZBINA_MAX_VREME_KULTURE = 1800
/** Verovatnoća da narudžbina traži jednu vrstu robe (inače dve, ako ih pool ima bar dve). */
export const NARUDZBINA_JEDNA_VRSTA = 0.55
export const NARUDZBINA_KOM_MIN = 1
export const NARUDZBINA_KOM_MAX = 12
const NARUDZBINA_BAZA = 55
const NARUDZBINA_EKSPONENT = 1.25
const NARUDZBINA_RASPON_MIN = 0.75
const NARUDZBINA_RASPON = 0.55
const NARUDZBINA_NAGRADA_MNOZILAC = 1.3
const NARUDZBINA_NAGRADA_KORAK = 5
const NARUDZBINA_XP_DELILAC = 10
const NARUDZBINA_XP_MIN = 3

/** Ciljna tržišna vrednost narudžbine; `r` je jedan poziv rng-a iz [0, 1). */
export function ciljNarudzbine(lvl: number, r: number): number {
  return (
    NARUDZBINA_BAZA *
    Math.pow(lvl, NARUDZBINA_EKSPONENT) *
    (NARUDZBINA_RASPON_MIN + r * NARUDZBINA_RASPON)
  )
}

/** Nagrada u dinarima za robu tržišne vrednosti `vrednost` (~30 % iznad pijace, na 5 din). */
export function nagradaDin(vrednost: number): number {
  return (
    Math.ceil((vrednost * NARUDZBINA_NAGRADA_MNOZILAC) / NARUDZBINA_NAGRADA_KORAK) *
    NARUDZBINA_NAGRADA_KORAK
  )
}

/** Nagrada u XP za robu tržišne vrednosti `vrednost`. */
export function nagradaXp(vrednost: number): number {
  return Math.max(NARUDZBINA_XP_MIN, Math.ceil(vrednost / NARUDZBINA_XP_DELILAC))
}

// ── Dnevni poklon ────────────────────────────────────────────────────────────
const POKLON_BAZA = 40
const POKLON_PO_NIVOU = 35

export function dnevniPoklon(lvl: number): number {
  return POKLON_BAZA + lvl * POKLON_PO_NIVOU
}

// ── Anti-softlock ────────────────────────────────────────────────────────────
/** Kupovina se odbija ako bi ostalo manje od cene ovog semena, a ništa ne raste, ne proizvodi
 *  i magacin je prazan („Ostavi bar za seme pšenice"). */
export const SOFTLOCK_REZERVA_KULTURA: KulturaId = 'psenica'

// ── Odsustvo ─────────────────────────────────────────────────────────────────
/** „Dobro došao nazad" se prikazuje tek posle STROGO dužeg odsustva od ovoga (sekunde). */
export const DOBRODOSLICA_PRAG_S = 180
