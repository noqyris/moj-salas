/*
 * Sprajtovi iz prototipa (moja-farma-v3.html L341–483), preneti 1:1: svaki string je bajt-identičan
 * prototipovom (tests/parity/art.test.ts poredi sa živim prototipom, tests/art/art.test.ts sa sha256).
 * Sastav (SV + SEN + …, klas(), grozd(), KOKA_G, KRAVA_G) je isti kao u prototipu, da se razlike
 * lako prate. CSS kuke u markapu (.krila u mlinu, .krL/.krD u leptiru) se NE preimenuju.
 */
import type { KulturaId, MasinaId, ProizvodId, ZivotinjaId } from '../config'

/** Ključ sprajta faze rasta: `<kultura>2` (faza 2) i `<kultura>3` (faza 3 i zrela biljka). */
export type FazaKljuc = `${KulturaId}${2 | 3}`

/** Svih 25 ključeva prototipovog `ART` objekta. */
export type ArtKljuc =
  | FazaKljuc
  | ProizvodId
  | MasinaId
  | ZivotinjaId
  | 'kap'
  | 'novcic'
  | 'katanac'
  | 'poklon'
  | 'leptir'
  | 'koka'
  | 'krava'

/** Zajednički otvarajući tag 64×64 (L341); koriste ga KLICA i sve faze kultura. */
export const SV = '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">'
/** Senka na zemlji (L342). */
export const SEN = '<ellipse cx="32" cy="57" rx="17" ry="4.5" fill="rgba(0,0,0,.15)"/>'
/** Klica — faza 1 za SVAKU kulturu (L343–346). */
export const KLICA =
  SV +
  SEN +
  '<path d="M32 57V41" stroke="#4e8f2f" stroke-width="4" stroke-linecap="round" fill="none"/>' +
  '<path d="M32 45 C 25 46 20 42 19 35 C 26 34 31 38 32 45 Z" fill="#6dbb43"/>' +
  '<path d="M32 41 C 39 42 44 38 45 31 C 38 30 33 34 32 41 Z" fill="#8ed063"/></svg>'

/** Pomak zrna/bobice u odnosu na (x, y). */
type Pomak = readonly [number, number]

const KLAS_ZRNA: readonly Pomak[] = [
  [0, 8],
  [-4, 4],
  [4, 4],
  [-4, -2],
  [4, -2],
  [0, -6],
]

/** Klas pšenice: 6 elipsi BEZ fill-a — boju nasleđuju od omotača `<g>` u psenica3 (L348–352). */
export function klas(x: number, y: number): string {
  let s = ''
  for (const [dx, dy] of KLAS_ZRNA) {
    s += `<ellipse cx="${x + dx}" cy="${y + dy}" rx="3.1" ry="4.8"/>`
  }
  return s
}

const GROZD_BOBICE: readonly Pomak[] = [
  [0, 0],
  [-4, 5],
  [4, 5],
  [-2, 10],
  [2, 10],
  [0, 15],
]

/** Grozd: 6 bobica; indeksi 1 i 4 su svetliji (L353–357). */
export function grozd(x: number, y: number): string {
  let s = ''
  GROZD_BOBICE.forEach(([dx, dy], i) => {
    const fill = i === 1 || i === 4 ? '#9b6fc4' : '#7e4fa8'
    s += `<circle cx="${x + dx}" cy="${y + dy}" r="3.4" fill="${fill}" stroke="#5e3a80" stroke-width=".8"/>`
  })
  return s
}

/** Koka bez <svg> omotača (L358–365); deli je ART.koka i ART.kokosinjac. */
export const KOKA_G =
  '<path d="M33 23 q8 -5 6 4 l-6 1z" fill="#f7f2e6" stroke="#d8cbb4" stroke-width="1.4"/>' +
  '<ellipse cx="24" cy="28" rx="12" ry="9.5" fill="#fdfaf0" stroke="#d8cbb4" stroke-width="1.5"/>' +
  '<circle cx="13" cy="19" r="6" fill="#fdfaf0" stroke="#d8cbb4" stroke-width="1.5"/>' +
  '<path d="M10 13 q2 -4 4 -0.5 q2 -3.5 4 0.5 l-8 1z" fill="#e8402a"/>' +
  '<path d="M7.5 18 l-5 2 5 2z" fill="#f0921e"/>' +
  '<circle cx="13.5" cy="17.6" r="1.2" fill="#3a3a3a"/>' +
  '<path d="M20 37v5m2 0h-4M28 37v5m2 0h-4" stroke="#f0921e" stroke-width="2" stroke-linecap="round" fill="none"/>'

/** Krava bez <svg> omotača (L366–378); deli je ART.krava i ART.stala. */
export const KRAVA_G =
  '<path d="M12 30 q-5 1 -4 7 l3-1" fill="none" stroke="#d8cbb4" stroke-width="2.4" stroke-linecap="round"/>' +
  '<rect x="12" y="22" width="38" height="20" rx="10" fill="#fdfaf4" stroke="#cfc4b0" stroke-width="1.6"/>' +
  '<path d="M22 24 q6 -2 8 3 q-1 6 -8 5 q-4 -4 0 -8z" fill="#4a4a4a"/>' +
  '<path d="M38 34 q5 -1 6 4 q-3 4 -7 2 q-2 -4 1 -6z" fill="#4a4a4a"/>' +
  '<rect x="46" y="14" width="15" height="14" rx="6" fill="#fdfaf4" stroke="#cfc4b0" stroke-width="1.6"/>' +
  '<ellipse cx="45" cy="16" rx="3.4" ry="2.2" fill="#e8d9c2" stroke="#cfc4b0"/>' +
  '<ellipse cx="62" cy="16" rx="3.4" ry="2.2" fill="#e8d9c2" stroke="#cfc4b0"/>' +
  '<rect x="48" y="22" width="12" height="7.5" rx="3.7" fill="#f2b8c6" stroke="#d493a6" stroke-width="1.2"/>' +
  '<circle cx="51.5" cy="25.8" r="1" fill="#a56"/><circle cx="56.5" cy="25.8" r="1" fill="#a56"/>' +
  '<circle cx="51" cy="19" r="1.3" fill="#3a3a3a"/>' +
  '<path d="M18 42v9M27 42v9M39 42v9M47 42v9" stroke="#e8e0d0" stroke-width="4" stroke-linecap="round"/>' +
  '<path d="M18 50v2M27 50v2M39 50v2M47 50v2" stroke="#8a7a5e" stroke-width="4" stroke-linecap="round"/>'

/** Prototipov `ART` (L379–483), isti redosled ključeva. */
export const ART: Readonly<Record<ArtKljuc, string>> = {
  psenica2:
    SV +
    SEN +
    '<g stroke="#5aa633" stroke-width="3" stroke-linecap="round" fill="none">' +
    '<path d="M22 57V36"/><path d="M32 57V30"/><path d="M42 57V36"/>' +
    '<path d="M22 46C17 44 15 40 15 36"/><path d="M32 42C27 40 25 36 25 32"/><path d="M42 46C47 44 49 40 49 36"/></g></svg>',
  psenica3:
    SV +
    SEN +
    '<g stroke="#d9a93c" stroke-width="3" stroke-linecap="round" fill="none">' +
    '<path d="M20 57V32"/><path d="M32 57V24"/><path d="M44 57V32"/></g>' +
    '<g fill="#f2c94c" stroke="#c9952e" stroke-width="1">' +
    klas(20, 22) +
    klas(32, 14) +
    klas(44, 22) +
    '</g></svg>',
  sargarepa2:
    SV +
    SEN +
    '<g stroke="#4e8f2f" stroke-width="3" stroke-linecap="round" fill="none">' +
    '<path d="M32 57C32 48 29 43 25 38"/><path d="M32 57C32 46 35 41 39 36"/><path d="M32 57C32 46 32 40 32 34"/>' +
    '<path d="M25 44l-4-2"/><path d="M39 42l4-2"/><path d="M32 40l-3-3"/></g></svg>',
  sargarepa3:
    SV +
    SEN +
    '<g stroke="#4e8f2f" stroke-width="3.4" stroke-linecap="round" fill="none">' +
    '<path d="M32 46C31 38 27 32 22 27"/><path d="M32 46C33 36 37 31 42 26"/><path d="M32 46C32 35 32 29 32 22"/>' +
    '<path d="M24 34l-5-2"/><path d="M40 32l5-3"/><path d="M32 30l-4-3"/><path d="M32 26l4-3"/></g>' +
    '<path d="M25 46 C25 42 39 42 39 46 L36 59 C35 62.5 29 62.5 28 59 Z" fill="#f5820d" stroke="#d96c08" stroke-width="1.6"/>' +
    '<path d="M27 50h10M28 54h8" stroke="#d96c08" stroke-width="1.4" stroke-linecap="round"/></svg>',
  paprika2:
    SV +
    SEN +
    '<path d="M32 52V42" stroke="#3e7a25" stroke-width="3.4" stroke-linecap="round"/>' +
    '<ellipse cx="32" cy="43" rx="13" ry="9" fill="#4e8f2f"/>' +
    '<ellipse cx="25" cy="40" rx="8.5" ry="7" fill="#6dbb43"/><ellipse cx="39" cy="40" rx="8.5" ry="7" fill="#6dbb43"/></svg>',
  paprika3:
    SV +
    SEN +
    '<path d="M32 56V44" stroke="#3e7a25" stroke-width="3.6" stroke-linecap="round"/>' +
    '<ellipse cx="32" cy="36" rx="17" ry="12" fill="#4e8f2f"/>' +
    '<ellipse cx="23" cy="32" rx="10" ry="8" fill="#6dbb43"/><ellipse cx="41" cy="32" rx="10" ry="8" fill="#6dbb43"/>' +
    '<g><path d="M22 40v-4M32 44v-4M42 40v-4" stroke="#3e7a25" stroke-width="2.4" stroke-linecap="round"/>' +
    '<rect x="18" y="40" width="8" height="13" rx="4" fill="#e8402a" stroke="#c22b18" stroke-width="1.4"/>' +
    '<rect x="28" y="44" width="8" height="13" rx="4" fill="#e8402a" stroke="#c22b18" stroke-width="1.4"/>' +
    '<rect x="38" y="40" width="8" height="13" rx="4" fill="#e8402a" stroke="#c22b18" stroke-width="1.4"/></g></svg>',
  bundeva2:
    SV +
    SEN +
    '<path d="M14 56C24 49 40 49 50 55" stroke="#4e8f2f" stroke-width="3" stroke-linecap="round" fill="none"/>' +
    '<path d="M22 52 C 16 52 13 48 12 44 C 18 43 22 47 22 52 Z" fill="#6dbb43"/>' +
    '<circle cx="40" cy="50" r="6.5" fill="#7fbf4d" stroke="#4e8f2f" stroke-width="1.6"/></svg>',
  bundeva3:
    SV +
    SEN +
    '<path d="M32 32c0-5 3-7 8-8" stroke="#5e8f2f" stroke-width="4" stroke-linecap="round" fill="none"/>' +
    '<path d="M40 26 C 46 24 51 26 53 31 C 47 33 42 31 40 26 Z" fill="#6dbb43"/>' +
    '<ellipse cx="32" cy="45" rx="18" ry="13.5" fill="#f08c1b" stroke="#c56a0c" stroke-width="1.6"/>' +
    '<ellipse cx="32" cy="45" rx="7" ry="13.5" fill="#ffa53c" stroke="#c56a0c" stroke-width="1.2"/>' +
    '<path d="M22 34.5c-3 6-3 15 0 21M42 34.5c3 6 3 15 0 21" stroke="#c56a0c" stroke-width="1.4" fill="none"/></svg>',
  grozdje2:
    SV +
    SEN +
    '<rect x="15" y="24" width="4.5" height="33" rx="2" fill="#8b5e34"/>' +
    '<rect x="44.5" y="24" width="4.5" height="33" rx="2" fill="#8b5e34"/>' +
    '<path d="M17 30H47" stroke="#6e4a28" stroke-width="2.2"/>' +
    '<path d="M18 56C26 46 38 44 46 32" stroke="#4e8f2f" stroke-width="3" stroke-linecap="round" fill="none"/>' +
    '<path d="M28 47 C 23 46 21 42 21 38 C 26 39 28 43 28 47 Z" fill="#6dbb43"/></svg>',
  grozdje3:
    SV +
    SEN +
    '<rect x="15" y="24" width="4.5" height="33" rx="2" fill="#8b5e34"/>' +
    '<rect x="44.5" y="24" width="4.5" height="33" rx="2" fill="#8b5e34"/>' +
    '<path d="M17 30H47" stroke="#6e4a28" stroke-width="2.2"/>' +
    '<path d="M18 56C26 46 38 44 46 30" stroke="#4e8f2f" stroke-width="3.2" stroke-linecap="round" fill="none"/>' +
    '<path d="M26 42 C 21 41 19 37 19 33 C 24 34 26 38 26 42 Z" fill="#6dbb43"/>' +
    '<path d="M40 36 C 45 35 47 31 47 27 C 42 28 40 32 40 36 Z" fill="#6dbb43"/>' +
    grozd(25, 42) +
    grozd(41, 36) +
    '</svg>',
  ajvar:
    '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">' +
    '<rect x="13" y="17" width="22" height="26" rx="6" fill="#c93a22" stroke="#a32a16" stroke-width="1.6"/>' +
    '<path d="M18 22v14" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".35"/>' +
    '<rect x="11" y="10" width="26" height="9" rx="3.5" fill="#e0a32e" stroke="#b27f1d" stroke-width="1.6"/></svg>',
  brasno:
    '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M15 17 C15 11 33 11 33 17 L36 35 C37 42 11 42 12 35 Z" fill="#efdcb4" stroke="#c8a86e" stroke-width="1.6"/>' +
    '<circle cx="24" cy="12.5" r="3" fill="#d9bd8a" stroke="#c8a86e" stroke-width="1.2"/>' +
    '<path d="M15.5 23h17M15 29h18" stroke="#c8a86e" stroke-width="1.4" stroke-dasharray="2 3"/>' +
    '<ellipse cx="21" cy="33" rx="2.2" ry="3.4" fill="#d9a93c" opacity=".8"/>' +
    '<ellipse cx="27" cy="33" rx="2.2" ry="3.4" fill="#d9a93c" opacity=".8"/></svg>',
  jaje:
    '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M24 8 C31 15 36 22 36 29 a12 12 0 0 1-24 0 C12 22 17 15 24 8z" fill="#fff6e4" stroke="#e0c9a0" stroke-width="1.6"/>' +
    '<ellipse cx="20" cy="20" rx="3" ry="5" fill="#fff" opacity=".85"/></svg>',
  mleko:
    '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M14 18 C14 15 34 15 34 18 V38 C34 43 14 43 14 38 Z" fill="#d7dee4" stroke="#9aa6b0" stroke-width="1.6"/>' +
    '<ellipse cx="24" cy="18" rx="10" ry="3.2" fill="#eef2f5" stroke="#9aa6b0" stroke-width="1.4"/>' +
    '<path d="M19 13.5 q5 -6 10 0" stroke="#9aa6b0" stroke-width="2.2" fill="none" stroke-linecap="round"/>' +
    '<path d="M14 27 C14 30 34 30 34 27" stroke="#9aa6b0" stroke-width="1.4" fill="none"/>' +
    '<path d="M18 22v12" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".7"/></svg>',
  kazan:
    '<svg viewBox="0 0 72 64" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M28 58l-8 4M44 58l8 4M36 58v5" stroke="#7c4e26" stroke-width="3.4" stroke-linecap="round"/>' +
    '<path d="M26 61q5-9 10-1q5-9 10 1" fill="#f59b1e"/><path d="M30 61q4-6 6 0q3-6 6 0" fill="#ffce54"/>' +
    '<path d="M14 26h44c0 18-9 28-22 28S14 44 14 26z" fill="#3a3f46" stroke="#23272c" stroke-width="1.6"/>' +
    '<rect x="10" y="21" width="52" height="9" rx="4.5" fill="#4a505a" stroke="#23272c" stroke-width="1.6"/>' +
    '<ellipse cx="36" cy="25.5" rx="21" ry="3.6" fill="#d64b27"/>' +
    '<path d="M28 14q3-4 0-8M40 16q3-4 0-8" stroke="#b9c2cc" stroke-width="2.6" stroke-linecap="round" fill="none" opacity=".8"/></svg>',
  mlin:
    '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M24 27 L40 27 L44 58 L20 58 Z" fill="#e3cfa8" stroke="#b99e6f" stroke-width="1.6"/>' +
    '<path d="M19 27 L32 15 L45 27 Z" fill="#c94f35" stroke="#8f3b26" stroke-width="1.4"/>' +
    '<rect x="28" y="46" width="8" height="12" rx="3" fill="#7a4f28"/>' +
    '<circle cx="32" cy="36" r="2.6" fill="#7c4e26"/>' +
    '<g class="krila"><g stroke="#e9dcc0" stroke-width="6" stroke-linecap="round">' +
    '<path d="M32 31 L49 15"/><path d="M32 31 L15 15"/><path d="M32 31 L15 47"/><path d="M32 31 L49 47"/></g>' +
    '<g stroke="#8b5e34" stroke-width="2.4" stroke-linecap="round">' +
    '<path d="M32 31 L50 14"/><path d="M32 31 L14 14"/><path d="M32 31 L14 48"/><path d="M32 31 L50 48"/></g>' +
    '<circle cx="32" cy="31" r="3.2" fill="#5c3a1c"/></g></svg>',
  kokosinjac:
    '<svg viewBox="0 0 72 64" xmlns="http://www.w3.org/2000/svg">' +
    '<rect x="12" y="26" width="38" height="26" rx="3" fill="#c98246" stroke="#8a5a2b" stroke-width="1.6"/>' +
    '<polygon points="8,28 31,11 54,28" fill="#8f3b26" stroke="#6e2c1c" stroke-width="1.4"/>' +
    '<rect x="25" y="36" width="12" height="16" rx="6" fill="#5e3a1c"/>' +
    '<polygon points="25,52 37,52 45,62 17,62" fill="#a9713f" stroke="#7c4e26" stroke-width="1.4"/>' +
    '<circle cx="31" cy="30" r="3" fill="#f7ecd9" stroke="#6e2c1c" stroke-width="1.4"/>' +
    '<g transform="translate(46,16) scale(.56)">' +
    KOKA_G +
    '</g></svg>',
  stala:
    '<svg viewBox="0 0 72 64" xmlns="http://www.w3.org/2000/svg"><g transform="translate(4,6)">' +
    KRAVA_G +
    '</g></svg>',
  kap:
    '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M12 3 C7.5 10 5 13 5 16 a7 7 0 0 0 14 0 c0-3-2.5-6-7-13z" fill="#4aa8d8" stroke="#2f83b0" stroke-width="1.4"/>' +
    '<circle cx="9.5" cy="15.5" r="1.7" fill="#bfe5f7"/></svg>',
  novcic:
    '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" fill="#ffc53d" stroke="#d89a17" stroke-width="2"/><circle cx="12" cy="12" r="5.5" fill="none" stroke="#d89a17" stroke-width="1.6" opacity=".7"/></svg>',
  katanac:
    '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="20" width="28" height="22" rx="6" fill="#e0a32e" stroke="#b27f1d" stroke-width="2"/><path d="M16 20v-4a8 8 0 0 1 16 0v4" fill="none" stroke="#8a6a45" stroke-width="4" stroke-linecap="round"/><circle cx="24" cy="30" r="3.4" fill="#8a5b12"/></svg>',
  poklon:
    '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="18" width="32" height="24" rx="4" fill="#e8542f" stroke="#c23a1a" stroke-width="1.8"/><rect x="6" y="12" width="36" height="9" rx="3" fill="#f0854e" stroke="#c23a1a" stroke-width="1.8"/><path d="M24 12v30" stroke="#ffd76a" stroke-width="5"/><path d="M24 12 C18 4 8 8 16 12 M24 12 C30 4 40 8 32 12" fill="none" stroke="#ffd76a" stroke-width="4" stroke-linecap="round"/></svg>',
  leptir:
    '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">' +
    '<g class="krL"><path d="M15 15 C5 4 0 13 8 20 C2 25 9 30 15 22 Z" fill="#f2a03c" stroke="#c97b1e" stroke-width="1.2"/>' +
    '<circle cx="8" cy="14" r="1.6" fill="#fff" opacity=".7"/></g>' +
    '<g class="krD"><path d="M17 15 C27 4 32 13 24 20 C30 25 23 30 17 22 Z" fill="#f2a03c" stroke="#c97b1e" stroke-width="1.2"/>' +
    '<circle cx="24" cy="14" r="1.6" fill="#fff" opacity=".7"/></g>' +
    '<ellipse cx="16" cy="19" rx="2" ry="6.5" fill="#5a4632"/>' +
    '<path d="M15 13 q-2 -4 -4 -5 M17 13 q2 -4 4 -5" stroke="#5a4632" stroke-width="1.2" fill="none" stroke-linecap="round"/></svg>',
  koka: '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">' + KOKA_G + '</svg>',
  krava: '<svg viewBox="0 0 66 56" xmlns="http://www.w3.org/2000/svg">' + KRAVA_G + '</svg>',
}
