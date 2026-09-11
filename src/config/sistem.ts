/*
 * Tehničke konstante: sejv, ritam igre i vremena UI povratnih informacija.
 */

// ── Sejv ─────────────────────────────────────────────────────────────────────
/** Ključ skladišta — NE MENJATI: čuva napredak postojećih test-igrača (CLAUDE.md pravilo 2). */
export const KLJUC_SEJVA = 'moja-farma-v2'
/** Kopija sirovog sejva koji nije mogao da se pročita, pre nego što ga nova igra pregazi. */
export const KLJUC_REZERVE = 'moja-farma-v2.rezerva'
export const VERZIJA_SEJVA = 3
/** Najstarija verzija koju lanac migracija ume da učita. */
export const NAJSTARIJA_VERZIJA_SEJVA = 2
/** Zapis se odlaže dok igrač ne stane na ovoliko (debounce)… */
export const SEJV_ODLAGANJE_MS = 1200
/** …ali ne duže od ovoga tokom neprekidne igre. */
export const SEJV_MAX_CEKANJE_MS = 5000

// ── Ritam ────────────────────────────────────────────────────────────────────
export const TIK_MS = 1000

// ── UI povratne informacije ──────────────────────────────────────────────────
export const TOAST_MS = 2300
/** Posle žetve jedne parcele njiva se crta sa zadrškom, da se vidi animacija. */
export const UBERI_CRTANJE_ODLAGANJE_MS = 180
/** Savet o zalivanju posle prve sadnje. */
export const SAVET_ZALIVANJE_ODLAGANJE_MS = 700
/** Zvuk novca kasni za letećim novčićima. */
export const NOVAC_ZVUK_ODLAGANJE_MS = 480
export const NOVAC_BROJANJE_MS = 350
/** Posle akcije koja pomera redove, ta oblast ignoriše tapove ovoliko dugo (zaštita od duplog tapa). */
export const ZAKLJUCAVANJE_TAPA_MS = 300
