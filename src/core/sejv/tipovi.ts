/*
 * Oblici sejva koje dekoder mora da prihvati (01 §a). Stanje koje port piše je `Stanje` iz
 * ../types (= v3); ovde su stariji i „prljavi" oblici koje je prototip mogao da ostavi na disku.
 */
import type { KulturaId } from '../../config'
import type { EpochMs, Narudzba, Stanje, Stat } from '../types'

/** Mušterija u v2 narudžbini: ugnežđen objekat, bez poruke. */
export interface MusterijaV2 {
  ime: string
  emoji: string
  boja: string
}

/** v2 narudžbina (jedini dokaz: referenca-sim TEST 4). Nema `ime/emoji/boja/msg` na vrhu. */
export interface NarudzbaV2 {
  id: number
  ko: MusterijaV2
  stavke: Array<{ k: KulturaId | 'ajvar'; kom: number }>
  din: number
  xp: number
}

/** v2 sejv (izveden iz prototipovog `ucitaj`, L566, i TEST 4 fiksture). */
export interface SejvV2 {
  v: 2
  novac: number
  xp: number
  /** Bez `z` — zalivanje nije postojalo. */
  parcele: Array<{ c: KulturaId | null; t: EpochMs }>
  /** Bez brasno/jaje/mleko (mlin i životinje su v3). */
  mag: Record<KulturaId | 'ajvar', number>
  /** Kazan kupljen (na vrhu, ne pod `masine`). */
  kazan: boolean
  /** Početak kuvanja (ms), 0 = miruje; prelazi u `masine.kazan.t`. */
  kazanT: EpochMs
  narudzbe: NarudzbaV2[]
  mute: boolean
  sadio: boolean
  videno?: EpochMs
  stat?: Partial<Stat>
  poklonDan?: string
}

/** v3 kakav prototip ZAISTA ostavlja posle v2 migracije: v2 narudžbine i `kazan/kazanT` na vrhu
 *  preživljavaju i ponovo se čuvaju (06 bug 5 i 13). Port ih pri učitavanju ispravlja (D8, D11). */
export interface SejvV3KakoJeZapisan extends Omit<Stanje, 'narudzbe'> {
  narudzbe: Array<Narudzba | NarudzbaV2>
  kazan?: boolean
  kazanT?: number
}

/** Sirov JSON objekat pre provere oblika. */
export type Obj = Record<string, unknown>

/** Pravi objekat (ne `null`, ne niz). */
export function jeObjekat(x: unknown): x is Obj {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

/** Sopstveni ključ — nikad ne gleda lanac prototipa (`'toString' in {}` je true). */
export function ima(o: Obj, kljuc: string): boolean {
  return Object.hasOwn(o, kljuc)
}

/**
 * Popravka = vrednost koja JESTE bila u sejvu nije preneta nepromenjena. Popunjavanje ključa
 * koji nedostaje podrazumevanom vrednošću (kao i prototip) nije popravka, a nije ni premeštanje
 * v2 podataka (`kazan/kazanT` → `masine.kazan`, `ko` → `ime/emoji/boja`). Svaka popravka znači
 * da bi upis izgubio nešto iz originala, pa kontroler pre prvog upisa pravi rezervu (D10).
 *
 * - `odbaceno`   — nepoznat ključ, neispravan element niza, duplikat, višak parcela
 * - `zamenjeno`  — neispravna vrednost zamenjena podrazumevanom
 * - `ispravljeno` — vrednost svedena na ispravnu (1 → true, 3.7 → 3, '9' → 9, t → 0 / now)
 */
export type VrstaPopravke = 'odbaceno' | 'zamenjeno' | 'ispravljeno'

/** Zapis popravke: `'<putanja>: <vrsta>'`, npr. `'mag.tursija: odbaceno'`. Za dijagnostiku, ne za UI. */
export function popravka(putanja: string, vrsta: VrstaPopravke): string {
  return `${putanja}: ${vrsta}`
}
