/** Redosled kultura: list semena, otključavanja i fazni pomak na pijaci (prototip `REDOSLED`). */
export const REDOSLED = ['psenica', 'sargarepa', 'paprika', 'bundeva', 'grozdje'] as const
export type KulturaId = (typeof REDOSLED)[number]

export interface Kultura {
  /** Cena semena u dinarima. */
  readonly seme: number
  /** Vreme rasta u sekundama. */
  readonly vreme: number
  /** Bazna prodajna cena na pijaci. */
  readonly cena: number
  /** XP po žetvi. */
  readonly xp: number
  /** Nivo na kome se otključava. */
  readonly nivo: number
}

// Vremena su skraćena za prototip — rebalans pre produkcije je zadatak Faze 2.
export const KULTURE: Readonly<Record<KulturaId, Kultura>> = {
  psenica: { seme: 10, vreme: 20, cena: 18, xp: 2, nivo: 1 },
  sargarepa: { seme: 30, vreme: 90, cena: 62, xp: 5, nivo: 1 },
  paprika: { seme: 80, vreme: 300, cena: 185, xp: 12, nivo: 2 },
  bundeva: { seme: 200, vreme: 1800, cena: 900, xp: 40, nivo: 3 },
  grozdje: { seme: 450, vreme: 7200, cena: 2300, xp: 110, nivo: 4 },
}

export function jeKultura(k: unknown): k is KulturaId {
  return typeof k === 'string' && (REDOSLED as readonly string[]).includes(k)
}
