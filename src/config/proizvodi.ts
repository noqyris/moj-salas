/** Prerađeni i životinjski proizvodi, redosledom iz prototipa (`PROIZVODI`). */
export const PROIZVODI_REDOSLED = ['brasno', 'ajvar', 'jaje', 'mleko'] as const
export type ProizvodId = (typeof PROIZVODI_REDOSLED)[number]

export interface Proizvod {
  /** Bazna prodajna cena na pijaci. */
  readonly cena: number
}

export const PROIZVODI: Readonly<Record<ProizvodId, Proizvod>> = {
  brasno: { cena: 120 },
  ajvar: { cena: 780 },
  jaje: { cena: 45 },
  mleko: { cena: 260 },
}
