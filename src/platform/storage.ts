/*
 * Skladište sejva (01 §e). Redosled izbora u createStorage():
 *   1. host `window.storage` (API iz okruženja u kome je prototip živeo) — kontinuitet sa prototipom;
 *   2. localStorage, ako proba upisa prođe (privatni režimi bacaju SecurityError);
 *   3. null — sesija bez čuvanja, isto kao prototip bez `window.storage`.
 * MemoryStorage je za testove i ima režime kvara.
 */
import type { StorageAdapter } from './tipovi'

/** Oblik host API-ja iz prototipa (L546–574): `get` odbija kad ključ NE POSTOJI (referenca-sim L44). */
export interface HostSkladiste {
  get(key: string): Promise<unknown>
  set(key: string, value: string): Promise<unknown>
}

/** Deo `window`-a koji createStorage čita (ubrizgava se u testovima). */
export interface StorageOkruzenje {
  readonly storage?: unknown
  readonly localStorage?: Storage | null
}

/** Ključ probe; odmah se briše, nikad ne dira ključ sejva. */
export const PROBA_KLJUC = 'moj-salas.proba'

/** Isti uslov kao prototip (L546): dovoljno je da `get` bude funkcija. */
export function jeHostSkladiste(x: unknown): x is HostSkladiste {
  return typeof x === 'object' && x !== null && typeof (x as { get?: unknown }).get === 'function'
}

/**
 * Adapter nad host API-jem. Host odbija `get` i kad ključ ne postoji, pa se odbijanje ne može
 * razlikovati od kvara: mapira se u `null` (01 §e.3), kao što je radio i prototip. Da je
 * odbijanje prijavljeno kao kvar, novi igrač (ključ još ne postoji) nikad ne bi bio sačuvan.
 */
export function hostStorage(host: HostSkladiste): StorageAdapter {
  return {
    async get(key) {
      let r: unknown
      try {
        r = await host.get(key)
      } catch {
        return null
      }
      const v = typeof r === 'object' && r !== null ? (r as { value?: unknown }).value : undefined
      return v === undefined || v === null ? null : String(v)
    },
    async set(key, value) {
      // Poziv host.set se izvršava sinhrono, pre prvog await-a.
      await host.set(key, value)
    },
  }
}

/** Adapter nad Web Storage-om. `set` upisuje SINHRONO unutar poziva (async telo se izvršava do
 *  prvog await-a), pa zapis iz pagehide/visibilitychange stiže pre zamrzavanja stranice. Svaki
 *  izuzetak (SecurityError, QuotaExceededError) postaje odbijeno obećanje. */
export function localStorageAdapter(ls: Storage): StorageAdapter {
  return {
    async get(key) {
      return ls.getItem(key)
    },
    async set(key, value) {
      ls.setItem(key, value)
    },
  }
}

/** localStorage ako proba upisa i brisanja prođe; i sam pristup svojstvu može da baci. */
export function probajLocalStorage(okr: StorageOkruzenje): Storage | null {
  try {
    const ls = okr.localStorage
    if (!ls) return null
    ls.setItem(PROBA_KLJUC, PROBA_KLJUC)
    ls.removeItem(PROBA_KLJUC)
    return ls
  } catch {
    return null
  }
}

export function createStorage(
  okr: StorageOkruzenje = globalThis as unknown as StorageOkruzenje,
): StorageAdapter | null {
  let host: unknown
  try {
    host = okr.storage
  } catch {
    host = undefined
  }
  if (jeHostSkladiste(host)) return hostStorage(host)
  const ls = probajLocalStorage(okr)
  return ls ? localStorageAdapter(ls) : null
}

/**
 * Skladište u memoriji za testove. `get` vraća null za nepostojeći ključ (ugovor StorageAdapter-a),
 * a kvar se zadaje eksplicitno:
 * - `odbijGet` — get odbija (kvar skladišta, NE „nema ključa");
 * - `odbijSet` — set odbija i ništa ne upisuje (npr. kvota);
 * - `zadrziGet` — get čeka `pustiGet()` (sporo skladište; vrednost se čita u trenutku puštanja).
 */
export class MemoryStorage implements StorageAdapter {
  readonly podaci: Map<string, string>
  odbijGet = false
  odbijSet = false
  zadrziGet = false
  getPozivi = 0
  setPozivi = 0
  /** Uspešni upisi, redom. */
  readonly upisi: { kljuc: string; vrednost: string }[] = []
  private zadrzani: (() => void)[] = []

  constructor(pocetno: Readonly<Record<string, string>> = {}) {
    this.podaci = new Map(Object.entries(pocetno))
  }

  get(key: string): Promise<string | null> {
    this.getPozivi++
    const procitaj = (): Promise<string | null> =>
      this.odbijGet
        ? Promise.reject(new Error('MemoryStorage: get odbijen'))
        : Promise.resolve(this.podaci.get(key) ?? null)
    if (!this.zadrziGet) return procitaj()
    return new Promise((resolve, reject) => {
      this.zadrzani.push(() => {
        procitaj().then(resolve, reject)
      })
    })
  }

  set(key: string, value: string): Promise<void> {
    this.setPozivi++
    if (this.odbijSet) return Promise.reject(new Error('MemoryStorage: set odbijen'))
    this.podaci.set(key, value)
    this.upisi.push({ kljuc: key, vrednost: value })
    return Promise.resolve()
  }

  /** Pušta sve zadržane `get` pozive. */
  pustiGet(): void {
    const z = this.zadrzani
    this.zadrzani = []
    for (const f of z) f()
  }
}
