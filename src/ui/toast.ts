/*
 * Toast (prototip L596–598): jedan `#toast`, nema reda — poslednji poziv pobeđuje i ponovo
 * pokreće tajmer od TOAST_MS. Sakriva se SAMO uklanjanjem klase `vidljiv`; tekst ostaje
 * (referenca-sim čita `#toast.textContent` pošto je tajmer sakrivanja već istekao).
 */
import { TOAST_MS } from '../config'
import type { Timers } from '../platform/tipovi'
import { $ } from './dom'

export interface ToastZavisnosti {
  koren: ParentNode
  tajmeri: Pick<Timers, 'setTimeout' | 'clearTimeout'>
}

export type Toast = (tekst: string) => void

export function napraviToast({ koren, tajmeri }: ToastZavisnosti): Toast {
  let tajmer: number | null = null
  return (tekst) => {
    const e = $(koren, '#toast')
    e.textContent = tekst
    e.classList.add('vidljiv')
    if (tajmer !== null) tajmeri.clearTimeout(tajmer)
    tajmer = tajmeri.setTimeout(() => e.classList.remove('vidljiv'), TOAST_MS)
  }
}
