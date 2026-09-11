/*
 * SaveController — jedini put od stanja do skladišta (zamenjuje prototipove `ucitaj`/`sacuvaj`,
 * L548–576). Bez DOM-a i bez importa iz `platform`: portove prima strukturno, a platformin
 * `StorageAdapter` i `Timers` ih zadovoljavaju.
 *
 * Odstupanja od prototipa:
 * - D9: ništa se ne piše pre `spreman()`; odbijen `get` ⇒ readOnly do kraja sesije; `buduci`
 *   ⇒ readOnly; `neispravan` ili normalizacija sa popravkama ⇒ sirovi original u KLJUC_REZERVE
 *   PRE bilo kakvog upisa (prototip je u svim ovim slučajevima pregazio sejv novom igrom).
 * - D13: debounce SEJV_ODLAGANJE_MS, ali tokom neprekidnog niza zahteva upis najkasnije
 *   SEJV_MAX_CEKANJE_MS posle prethodnog (prototip u neprekidnoj igri nije pisao nikad, 06 bug 18).
 */
import { KLJUC_REZERVE, KLJUC_SEJVA, SEJV_MAX_CEKANJE_MS, SEJV_ODLAGANJE_MS } from '../../config'
import type { Stanje } from '../types'
import { dekodirajSejv, kodirajSejv, type DekodiranSejv } from './dekoder'

export interface SkladisteSejva {
  /** Sačuvani string, ili `null` kad ključ ne postoji. ODBIJA samo kad skladište zakaže. */
  get(kljuc: string): Promise<string | null>
  set(kljuc: string, vrednost: string): Promise<void>
}

export interface Rasporedjivac {
  setTimeout(cb: () => void, ms: number): number
  clearTimeout(id: number): void
}

export interface OpcijeKontrolera {
  /** `null` = nema trajnog skladišta: igra živi samo u memoriji (prototip bez window.storage). */
  skladiste: SkladisteSejva | null
  /** Epoch ms. */
  now: () => number
  rasporedjivac: Rasporedjivac
  /** Uvek TEKUĆE stanje — posle učitavanja i reseta to je nov objekat, pa se nikad ne kešira. */
  stanje: () => Stanje
}

export interface RezultatUcitavanja {
  dekodirano: DekodiranSejv
  /** Skladište je zakazalo (odbijen `get`, ili rezerva nije mogla da se upiše) ⇒ readOnly sesija. */
  greskaSkladista: boolean
}

/** Rezerva originala je potrebna kad bi prvi upis izgubio nešto što je bilo u skladištu (D10). */
function trebaRezerva(d: DekodiranSejv): boolean {
  return d.vrsta === 'neispravan' || (d.vrsta === 'ok' && d.popravke.length > 0)
}

export class SaveController {
  private readonly skladiste: SkladisteSejva | null
  private readonly sat: () => number
  private readonly rasporedjivac: Rasporedjivac
  private readonly stanje: () => Stanje
  private jeSpreman = false
  private samoCitanje = false
  private tajmer: number | null = null
  /** Od kog trenutka se meri max-wait: početak niza zahteva, ili poslednji upis dok niz traje. */
  private sidro = 0
  private poslednjiZahtev: number | null = null

  constructor(o: OpcijeKontrolera) {
    this.skladiste = o.skladiste
    this.sat = o.now
    this.rasporedjivac = o.rasporedjivac
    this.stanje = o.stanje
  }

  /**
   * Čita i dekodira sejv. `now` za dekoder je trenutak PRE čitanja (startni `pre`, prototip L1166).
   * Posle ovoga i dalje se ništa ne piše dok UI ne pozove `spreman()`.
   */
  async ucitaj(): Promise<RezultatUcitavanja> {
    const pre = this.sat()
    if (!this.skladiste) return { dekodirano: dekodirajSejv(null, pre), greskaSkladista: false }
    let raw: string | null
    try {
      raw = (await this.skladiste.get(KLJUC_SEJVA)) ?? null
    } catch {
      // D9: greška skladišta NIJE „nema sejva" — ono što nije pročitano ne sme da se pregazi.
      this.samoCitanje = true
      return { dekodirano: dekodirajSejv(null, pre), greskaSkladista: true }
    }
    const dekodirano = dekodirajSejv(raw, pre)
    if (dekodirano.vrsta === 'buduci') {
      // Sejv iz novijeg builda: igra se samo u memoriji, original ostaje netaknut (D9).
      this.samoCitanje = true
    } else if (typeof raw === 'string' && trebaRezerva(dekodirano)) {
      try {
        await this.skladiste.set(KLJUC_REZERVE, raw)
      } catch {
        // Bez rezerve bi prvi upis uništio original — radije ne piši ništa ove sesije.
        this.samoCitanje = true
        return { dekodirano, greskaSkladista: true }
      }
    }
    return { dekodirano, greskaSkladista: false }
  }

  /** Učitavanje (i sve što boot radi pre prvog čuvanja) je gotovo: od sada `sacuvaj` piše. */
  spreman(): void {
    this.jeSpreman = true
  }

  /**
   * Zahtev za čuvanje. `videno` se pečatira UVEK i u trenutku ZAHTEVA (prototip L571), a stanje se
   * serijalizuje tek u trenutku upisa, pa upis sadrži i promene nastale posle zahteva.
   * `odmah` = upiši sad i otkaži odloženi upis (sakrivanje stranice, reset, dnevni poklon).
   */
  sacuvaj(odmah = false): void {
    const t = this.sat()
    this.stanje().videno = t
    const skladiste = this.skladiste
    if (!skladiste || !this.jeSpreman || this.samoCitanje) return
    // Niz zahteva traje dok između dva zahteva ne prođe ceo debounce (tada je upis već pao).
    const nastavakNiza =
      this.poslednjiZahtev !== null && t - this.poslednjiZahtev < SEJV_ODLAGANJE_MS
    this.poslednjiZahtev = t
    if (odmah) {
      this.upisi(skladiste)
      return
    }
    if (!nastavakNiza) this.sidro = t
    const rok = Math.min(t + SEJV_ODLAGANJE_MS, this.sidro + SEJV_MAX_CEKANJE_MS)
    this.otkaziTajmer()
    if (rok <= t) {
      this.upisi(skladiste)
      return
    }
    this.tajmer = this.rasporedjivac.setTimeout(() => {
      this.tajmer = null
      this.upisi(skladiste)
    }, rok - t)
  }

  /** true ⇒ ova sesija ne piše ništa (greška skladišta ili sejv iz budućnosti). */
  readOnly(): boolean {
    return this.samoCitanje
  }

  /** Otkazuje odloženi upis (gašenje aplikacije / testovi). */
  ocisti(): void {
    this.otkaziTajmer()
  }

  private otkaziTajmer(): void {
    if (this.tajmer === null) return
    this.rasporedjivac.clearTimeout(this.tajmer)
    this.tajmer = null
  }

  private upisi(skladiste: SkladisteSejva): void {
    this.otkaziTajmer()
    this.sidro = this.sat()
    try {
      // Odbijen upis se guta (kao L574); sledeći `sacuvaj` pokušava ponovo. Sinhroni `set`
      // (localStorage) upisuje unutar poziva, pa zapis iz `pagehide` stiže pre zamrzavanja.
      Promise.resolve(skladiste.set(KLJUC_SEJVA, kodirajSejv(this.stanje()))).catch(ignorisi)
    } catch {
      // Adapter koji baca sinhrono tretira se isto kao odbijen upis.
    }
  }
}

function ignorisi(): void {
  // Namerno prazno: neuspeo upis nije greška igre (vidi `upisi`).
}
