/*
 * Lažnjaci za testove sejva. Sat i raspoređivač dele JEDNO virtuelno vreme: tajmer se izvršava
 * tačno u svom roku i tada `now()` vraća baš taj rok. Skladište beleži svaki `set` sa vremenom.
 */
import { KLJUC_REZERVE, KLJUC_SEJVA } from '../../../src/config'
import type { Rasporedjivac, SkladisteSejva } from '../../../src/core/sejv'
import type { Stanje } from '../../../src/core/types'

interface Tajmer {
  id: number
  rok: number
  cb: () => void
}

export class LaznoVreme implements Rasporedjivac {
  private t: number
  private sledeciId = 0
  private red: Tajmer[] = []

  constructor(t0: number) {
    this.t = t0
  }

  readonly now = (): number => this.t

  setTimeout(cb: () => void, ms: number): number {
    const id = ++this.sledeciId
    this.red.push({ id, rok: this.t + ms, cb })
    return id
  }

  clearTimeout(id: number): void {
    this.red = this.red.filter((x) => x.id !== id)
  }

  /** Pomera vreme za `ms` i usput izvršava dospele tajmere (po roku, pa po redu zakazivanja). */
  napreduj(ms: number): void {
    const kraj = this.t + ms
    for (;;) {
      const x = this.red
        .filter((y) => y.rok <= kraj)
        .sort((a, b) => a.rok - b.rok || a.id - b.id)[0]
      if (!x) break
      this.red = this.red.filter((y) => y !== x)
      this.t = x.rok
      x.cb()
    }
    this.t = kraj
  }

  /** Skok sata BEZ izvršavanja tajmera (npr. uređaj je spavao). */
  skok(ms: number): void {
    this.t += ms
  }

  /** Broj zakazanih (neotkazanih) tajmera. */
  aktivni(): number {
    return this.red.length
  }
}

export interface Upis {
  kljuc: string
  vrednost: string
  vreme: number
}

export class MemorijskoSkladiste implements SkladisteSejva {
  readonly mapa: Map<string, string>
  readonly upisi: Upis[] = []
  getOdbija = false
  /** Koliko narednih `set` poziva vraća odbijen promise. */
  setOdbija = 0
  /** Svaki `set` baca sinhrono (pre nego što vrati promise). */
  setBaca = false
  getPozivi = 0

  constructor(
    private readonly vreme: () => number,
    pocetno: Record<string, string> = {},
  ) {
    this.mapa = new Map(Object.entries(pocetno))
  }

  async get(kljuc: string): Promise<string | null> {
    this.getPozivi++
    if (this.getOdbija) throw new Error('skladište nedostupno')
    return this.mapa.get(kljuc) ?? null
  }

  set(kljuc: string, vrednost: string): Promise<void> {
    if (this.setBaca) throw new Error('set baca sinhrono')
    this.upisi.push({ kljuc, vrednost, vreme: this.vreme() })
    if (this.setOdbija > 0) {
      this.setOdbija--
      return Promise.reject(new Error('skladište puno'))
    }
    this.mapa.set(kljuc, vrednost)
    return Promise.resolve()
  }

  upisiSejva(): Upis[] {
    return this.upisi.filter((u) => u.kljuc === KLJUC_SEJVA)
  }

  upisiRezerve(): Upis[] {
    return this.upisi.filter((u) => u.kljuc === KLJUC_REZERVE)
  }

  /** Parsiran sadržaj glavnog ključa. */
  sacuvano(): Stanje | null {
    const v = this.mapa.get(KLJUC_SEJVA)
    return v === undefined ? null : (JSON.parse(v) as Stanje)
  }
}

/** Pusti sve mikrotaskove (odbijeni upisi, await-ovi u `ucitaj`). */
export async function isprazniMikrotaskove(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}
