/*
 * Vizuelni efekti (prototip L621–659, 04 §5): leteći novčići, „+N XP", kapi vode, konfete.
 * Nasumičnost dolazi iz `fxRandom` (odvojen tok od rng-a igre) i troši se TAČNO kao u prototipu:
 * novčić 2 (x pa y), kap 2 (left pa top), konfeta 3 (left, trajanje, kašnjenje). Pozicije u jsdom-u
 * su besmislene (pravougaonici su nule) — testabilni su broj, klase, stilovi i vremena.
 */
import { ART } from '../art'
import { NOVAC_ZVUK_ODLAGANJE_MS, NOVCICA_MAX } from '../config'
import type { ZvukId } from '../core/dogadjaji'
import { t } from '../i18n'
import type { Timers } from '../platform/tipovi'
import { $ } from './dom'

/** Novčić i nestaje posle NOVCIC_TRAJE_MS + i · NOVCIC_RAZMAK_MS. */
export const NOVCIC_TRAJE_MS = 700
export const NOVCIC_RAZMAK_MS = 40
export const PLUSXP_TRAJE_MS = 900
export const KAPI_BROJ = 3
export const KAP_TRAJE_MS = 800
/** Kašnjenje animacije kapi i (u sekundama) = i · KAP_KASNJENJE_S. */
export const KAP_KASNJENJE_S = 0.09
export const KONFETE_BROJ = 26
export const KONFETE_TRAJE_MS = 3200
export const KONFETE_BOJE = ['#ffc53d', '#e8542f', '#7cbf4a', '#8a63d2', '#4aa8d8'] as const

export interface FxZavisnosti {
  doc: Document
  tajmeri: Pick<Timers, 'setTimeout' | 'raf'>
  fxRandom: () => number
  /** UI-jev zvuk; odloženi 'novac' ga zove u trenutku puštanja, pa `mute` važi i tada. */
  zvuk: (id: ZvukId) => void
}

export interface Fx {
  /** min(broj, 6) novčića leti od `izEl` (ili body-ja) ka `#novacPilula`; zvuk 'novac' posle 480 ms. */
  letiNovcic(izEl: Element | null, broj: number): void
  /** „+N XP" (i18n, N sirovo) iznad `izEl` (ili body-ja), nestaje posle 900 ms. */
  plusXp(izEl: Element | null, xp: number): void
  /** 3 kapi UNUTAR parcele `el`, nestaju posle 800 ms. */
  kapFx(el: Element): void
  /** 26 konfeta preko ekrana, nestaju posle 3200 ms (jednom po pređenom nivou). */
  konfete(): void
}

export function napraviFx({ doc, tajmeri, fxRandom, zvuk }: FxZavisnosti): Fx {
  return {
    letiNovcic(izEl, broj) {
      const cilj = $(doc, '#novacPilula').getBoundingClientRect()
      const iz = (izEl ?? doc.body).getBoundingClientRect()
      // Kao prototip (L624): i pozivalac (core) i sam let klešte broj na NOVCICA_MAX.
      for (let i = 0; i < Math.min(broj, NOVCICA_MAX); i++) {
        const c = doc.createElement('div')
        c.className = 'letac'
        c.innerHTML = ART.novcic
        const x0 = iz.left + iz.width / 2 - 10 + (fxRandom() * 36 - 18)
        const y0 = iz.top + iz.height / 2 - 10 + (fxRandom() * 20 - 10)
        c.style.left = x0 + 'px'
        c.style.top = y0 + 'px'
        doc.body.appendChild(c)
        // Dupli rAF: početna pozicija mora da se iscrta pre cilja tranzicije.
        tajmeri.raf(() => {
          tajmeri.raf(() => {
            c.style.transform =
              'translate(' +
              (cilj.left + cilj.width / 2 - 10 - x0) +
              'px,' +
              (cilj.top + cilj.height / 2 - 10 - y0) +
              'px) scale(.55)'
            c.style.opacity = '.15'
          })
        })
        tajmeri.setTimeout(() => c.remove(), NOVCIC_TRAJE_MS + i * NOVCIC_RAZMAK_MS)
      }
      tajmeri.setTimeout(() => zvuk('novac'), NOVAC_ZVUK_ODLAGANJE_MS)
    },

    plusXp(izEl, xp) {
      const iz = (izEl ?? doc.body).getBoundingClientRect()
      const p = doc.createElement('div')
      p.className = 'plusxp'
      p.textContent = t.fx.plusXp(xp)
      p.style.left = iz.left + iz.width / 2 - 20 + 'px'
      p.style.top = iz.top - 6 + 'px'
      doc.body.appendChild(p)
      tajmeri.setTimeout(() => p.remove(), PLUSXP_TRAJE_MS)
    },

    kapFx(el) {
      for (let i = 0; i < KAPI_BROJ; i++) {
        const k = doc.createElement('span')
        k.className = 'kapFx'
        k.innerHTML = ART.kap
        k.style.left = 22 + fxRandom() * 46 + '%'
        k.style.top = 14 + fxRandom() * 20 + '%'
        k.style.animationDelay = i * KAP_KASNJENJE_S + 's'
        el.appendChild(k)
        tajmeri.setTimeout(() => k.remove(), KAP_TRAJE_MS)
      }
    },

    konfete() {
      for (let i = 0; i < KONFETE_BROJ; i++) {
        const k = doc.createElement('div')
        k.className = 'konfeta'
        k.style.left = fxRandom() * 100 + 'vw'
        k.style.background = KONFETE_BOJE[i % KONFETE_BOJE.length] ?? ''
        k.style.animationDuration = 1.4 + fxRandom() * 1.2 + 's'
        k.style.animationDelay = fxRandom() * 0.4 + 's'
        doc.body.appendChild(k)
        tajmeri.setTimeout(() => k.remove(), KONFETE_TRAJE_MS)
      }
    },
  }
}
