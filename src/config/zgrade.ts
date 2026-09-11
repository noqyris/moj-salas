import type { KulturaId } from './kulture'
import type { ProizvodId } from './proizvodi'

/** Mašine, redosledom kojim ih tick završava i radnja prikazuje (prototip `MASINE`). */
export const MASINE_REDOSLED = ['mlin', 'kazan'] as const
export type MasinaId = (typeof MASINE_REDOSLED)[number]

export interface MasinaDef {
  readonly cena: number
  readonly nivo: number
  /** Ulazna kultura i koliko komada troši po turi. */
  readonly ulazK: KulturaId
  readonly ulazN: number
  /** Proizvod koji daje (1 komad po turi). */
  readonly izlaz: ProizvodId
  /** Trajanje ture u sekundama. */
  readonly vreme: number
  /** XP po završenoj turi. */
  readonly xp: number
}

export const MASINE: Readonly<Record<MasinaId, MasinaDef>> = {
  mlin: { cena: 350, nivo: 2, ulazK: 'psenica', ulazN: 4, izlaz: 'brasno', vreme: 90, xp: 8 },
  kazan: { cena: 600, nivo: 3, ulazK: 'paprika', ulazN: 3, izlaz: 'ajvar', vreme: 240, xp: 25 },
}

/** Životinje sa pasivnom proizvodnjom (prototip `ZIV`). */
export const ZIV_REDOSLED = ['kokosinjac', 'stala'] as const
export type ZivotinjaId = (typeof ZIV_REDOSLED)[number]

export interface ZivotinjaDef {
  readonly cena: number
  readonly nivo: number
  readonly proizvod: ProizvodId
  /** Sekundi po jednom komadu. */
  readonly interval: number
  /** Kapacitet: najviše ovoliko komada čeka na kupljenje; kad je puno, proizvodnja staje. */
  readonly kap: number
  /** XP po pokupljenom komadu. */
  readonly xpPo: number
}

export const ZIV: Readonly<Record<ZivotinjaId, ZivotinjaDef>> = {
  kokosinjac: { cena: 900, nivo: 3, proizvod: 'jaje', interval: 180, kap: 4, xpPo: 1 },
  stala: { cena: 2600, nivo: 5, proizvod: 'mleko', interval: 600, kap: 3, xpPo: 6 },
}

export type ZgradaId = MasinaId | ZivotinjaId

export function jeMasina(id: ZgradaId): id is MasinaId {
  return (MASINE_REDOSLED as readonly string[]).includes(id)
}
