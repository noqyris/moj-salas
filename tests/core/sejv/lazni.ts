/*
 * Lažnjaci za testove sejva. Tajmeri rade po MONOTONOM vremenu (kao pravi `setTimeout`), a `now()`
 * je zidni sat = t0 + monotono + pomak. Tajmer se izvršava tačno u svom roku i tada `now()` vraća
 * baš taj trenutak. `pomeriSat` menja samo zidni sat (igrač je promenio vreme na uređaju), a
 * `skok` pomera vreme bez izvršavanja tajmera (uređaj je spavao / tajmeri su prigušeni).
 * Skladište beleži svaki `set` sa oba vremena.
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
  private mono = 0
  private pomak = 0
  private sledeciId = 0
  private red: Tajmer[] = []

  constructor(private readonly t0: number) {}

  /** Zidni sat (epoch ms) — ono što kontroler dobija kao `now`. */
  readonly now = (): number => this.t0 + this.mono + this.pomak

  /** Monotono vreme od početka testa — po njemu se mere stvarni razmaci između upisa. */
  readonly monotono = (): number => this.mono

  setTimeout(cb: () => void, ms: number): number {
    const id = ++this.sledeciId
    this.red.push({ id, rok: this.mono + ms, cb })
    return id
  }

  clearTimeout(id: number): void {
    this.red = this.red.filter((x) => x.id !== id)
  }

  /** Pomera vreme za `ms` i usput izvršava dospele tajmere (po roku, pa po redu zakazivanja). */
  napreduj(ms: number): void {
    const kraj = this.mono + ms
    for (;;) {
      const x = this.red
        .filter((y) => y.rok <= kraj)
        .sort((a, b) => a.rok - b.rok || a.id - b.id)[0]
      if (!x) break
      this.red = this.red.filter((y) => y !== x)
      this.mono = x.rok
      x.cb()
    }
    this.mono = kraj
  }

  /** Vreme ide dalje BEZ izvršavanja tajmera (uređaj je spavao, pozadinski tab je prigušen);
   *  zakasneli tajmeri padaju pri sledećem `napreduj`. */
  skok(ms: number): void {
    this.mono += ms
  }

  /** Samo zidni sat se pomera (i unazad); tajmeri ostaju gde su bili. */
  pomeriSat(ms: number): void {
    this.pomak += ms
  }

  /** Broj zakazanih (neotkazanih) tajmera. */
  aktivni(): number {
    return this.red.length
  }
}

export interface Upis {
  kljuc: string
  vrednost: string
  /** Zidni sat u trenutku upisa. */
  vreme: number
  /** Monotono vreme u trenutku upisa. */
  mono: number
}

export class MemorijskoSkladiste implements SkladisteSejva {
  readonly mapa: Map<string, string>
  readonly upisi: Upis[] = []
  getOdbija = false
  /** Koliko narednih `set` poziva vraća odbijen promise. */
  setOdbija = 0
  /** Svaki `set` baca sinhrono (pre nego što vrati promise). */
  setBaca = false
  /** `get` čeka `pustiGet()`; vrednost se čita u trenutku puštanja (sporo skladište). */
  zadrziGet = false
  getPozivi = 0
  private zadrzani: (() => void)[] = []

  constructor(
    private readonly sat: Pick<LaznoVreme, 'now' | 'monotono'>,
    pocetno: Record<string, string> = {},
  ) {
    this.mapa = new Map(Object.entries(pocetno))
  }

  get(kljuc: string): Promise<string | null> {
    this.getPozivi++
    const procitaj = (): Promise<string | null> =>
      this.getOdbija
        ? Promise.reject(new Error('skladište nedostupno'))
        : Promise.resolve(this.mapa.get(kljuc) ?? null)
    if (!this.zadrziGet) return procitaj()
    return new Promise((resolve, reject) => {
      this.zadrzani.push(() => {
        procitaj().then(resolve, reject)
      })
    })
  }

  set(kljuc: string, vrednost: string): Promise<void> {
    if (this.setBaca) throw new Error('set baca sinhrono')
    this.upisi.push({ kljuc, vrednost, vreme: this.sat.now(), mono: this.sat.monotono() })
    if (this.setOdbija > 0) {
      this.setOdbija--
      return Promise.reject(new Error('skladište puno'))
    }
    this.mapa.set(kljuc, vrednost)
    return Promise.resolve()
  }

  /** Pušta sve zadržane `get` pozive. */
  pustiGet(): void {
    const z = this.zadrzani
    this.zadrzani = []
    for (const f of z) f()
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
