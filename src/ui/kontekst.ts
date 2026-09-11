/*
 * Zajednički kontekst UI aplikacije: servisi (platforma, toast, FX, HUD, red kartica, zaključavanje
 * tapova, čuvanje) i međusobne reference renderera i akcija. Svaki `createApp` pravi svoj kontekst,
 * pa nema globalnog stanja modula i testovi su izolovani.
 *
 * Moduli ga dobijaju kao `UiRef` (funkciju), jer rendereri vezuju handlere koji zovu akcije, a akcije
 * pozivaju renderere — referenca se razrešava tek u trenutku klika/crtanja.
 */
import type { ArtikalId, KulturaId, MasinaId, ZgradaId, ZivotinjaId } from '../config'
import type { Cuvanje, Dogadjaj, Igra, ZvukId } from '../core'
import type { Platforma } from '../platform/tipovi'
import type { Fx } from './fx'
import type { Hud } from './hud'
import type { OverlayRed } from './overlay'
import type { Toast } from './toast'
import type { Zakljucavanje } from './zakljucavanje'

/** Rendereri (prototip `crtaj*`). `now` je opcioni: bez njega renderer čita sat JEDNOM. */
export interface Crtanje {
  novac(): void
  nivo(): void
  njive(now?: number): void
  zgrade(now?: number): void
  narudzbe(now?: number): void
  tezga(now?: number): void
  radnja(now?: number): void
  /** Tačkice u navigaciji (prototip `osveziTacke`). */
  tacke(now?: number): void
  /** Prototip `crtajSve` (+ D14: otvoren list semena se ponovo gradi). */
  sve(): void
}

/** Donji list „Šta sadiš?" (prototip `otvoriList`/`zatvoriList`, `izabrana`). */
export interface ListSemena {
  otvori(i: number): void
  zatvori(): void
  /** Ponovo gradi `#semena` iz tekućeg stanja (D14), bez otvaranja i zaključavanja. */
  crtaj(): void
  otvoren(): boolean
  /** Parcela za koju je list otvoren; -1 = nijedna. */
  izabrana(): number
  /** `izabrana = -1` (reset). */
  ponisti(): void
}

/** Akcije igrača (prototipovi handleri, 04 §4.1). `el` je kliknuti element — sidro za FX. */
export interface Akcije {
  posadi(k: KulturaId): void
  zalij(i: number, el: HTMLElement): void
  uberi(i: number, el: HTMLElement): void
  uberiSve(): void
  prodaj(k: ArtikalId, el: HTMLElement): void
  isporuci(id: number, el: HTMLElement): void
  odbij(id: number): void
  kupiParcelu(): void
  kupiZgradu(id: ZgradaId): void
  pokreniMasinu(id: MasinaId): void
  pokupi(id: ZivotinjaId, el: HTMLElement): void
  /** Izvršava događaje iz core-a REDOM (zvuk, vibracija, toast, FX, level-up kartice). */
  izvrsi(dogadjaji: readonly Dogadjaj[], el?: HTMLElement | null): void
  /** Čuvanje po `Rezultat.cuvaj`. */
  sacuvajPo(c: Cuvanje): void
}

export interface Ui {
  readonly doc: Document
  readonly p: Platforma
  /** TEKUĆA igra (posle učitavanja i reseta to je nov objekat — nikad je ne keširati). */
  igra(): Igra
  /** Zvuk; `mute` se proverava u trenutku puštanja (i za odloženi 'novac'). */
  zvuk(id: ZvukId): void
  vibro(obrazac: number | readonly number[]): void
  readonly toast: Toast
  readonly fx: Fx
  readonly hud: Hud
  readonly red: OverlayRed
  readonly zak: Zakljucavanje
  /** Zahtev za čuvanje (SaveController; pre boot-a samo pečatira `videno`). */
  sacuvaj(odmah?: boolean): void
  readonly crtaj: Crtanje
  readonly list: ListSemena
  readonly akcije: Akcije
}

export type UiRef = () => Ui
