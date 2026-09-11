/*
 * Scena iznad njiva (04 §4.8): leptiri (jednom, na početku boot-a — prototip L1164–1165) i životinje
 * koje se pojavljuju kad su kupljene (kraj `crtajZgrade`, L859–862).
 */
import { ART } from '../art'
import type { Stanje } from '../core'
import { $ } from './dom'

/** Oba leptira dobijaju `ART.leptir` (uvek vidljivi; krila maše CSS). */
export function montirajLeptire(doc: Document): void {
  $(doc, '#leptir1').innerHTML = ART.leptir
  $(doc, '#leptir2').innerHTML = ART.leptir
}

/** Koka i krava u sceni: sprajt + `display: block` kad je zgrada kupljena, inače prazno + `none`. */
export function crtajZivotinjeUSceni(doc: Document, s: Stanje): void {
  const koka = $(doc, '#scenaKoka')
  koka.innerHTML = s.ziv.kokosinjac.k ? ART.koka : ''
  koka.style.display = s.ziv.kokosinjac.k ? 'block' : 'none'
  const krava = $(doc, '#scenaKrava')
  krava.innerHTML = s.ziv.stala.k ? ART.krava : ''
  krava.style.display = s.ziv.stala.k ? 'block' : 'none'
}
