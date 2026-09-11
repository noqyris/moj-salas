/*
 * Pragovi prikaza i povratne informacije koje core nosi u događajima (02 §1.8–1.9). Nisu balans —
 * ne menjaju ekonomiju — ali ih dele core i ui, pa žive na jednom mestu umesto kao literali po
 * modulima. Vrednosti su 1:1 sa prototipom (tests/parity/config.test.ts ih traži u njegovom kodu).
 * Čisto vizuelne FX konstante (pozicije, trajanja animacija) su u src/ui/fx.ts.
 */

/** Najviše novčića koji lete ka novčaniku po akciji: prodaja min(kom, 6), isporuka uvek 6. */
export const NOVCICA_MAX = 6

/** Dugme „Uberi sve (N)" se pojavljuje tek kad je zrelo bar ovoliko parcela. */
export const UBERI_SVE_MIN = 2

/** Obrasci vibracije po akciji (ms; niz = vibracija, pauza, vibracija…), prototipovi `vibro(…)`. */
export const VIBRACIJA = {
  sadnja: 12,
  zalivanje: 10,
  zetva: 18,
  uberiSve: [15, 25, 15],
  isporuka: [15, 30, 15],
  /** Kupovina parcele ili zgrade. */
  kupovina: 20,
  pokupi: 14,
  /** Po pređenom nivou. */
  nivo: [30, 40, 60],
} as const satisfies Readonly<Record<string, number | readonly number[]>>
