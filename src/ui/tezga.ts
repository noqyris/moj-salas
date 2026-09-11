/*
 * Tezga na pijaci (04 §2.6) i osvežavanje cena u ticku (04 §2.12 korak 6).
 * D14: tick osvežava i oznaku trenda (▲/▼/—), ne samo cenu — prototip je ostavljao oznaku iz
 * trenutka crtanja, pa je posle nekoliko minuta protivrečila ceni (04 B7).
 */
import { ikonica } from '../art'
import { jeArtikal } from '../config'
import { robaNaTezgi, trzisnaCena, type Smer } from '../core'
import { nazivArtikla, t } from '../i18n'
import { $, $$ } from './dom'
import type { UiRef } from './kontekst'

export interface Tezga {
  crtaj(now?: number): void
  /** Svaka `[data-cena]` dobija cenu u `now` i (D14) svežu oznaku trenda. */
  tikCene(now: number): void
}

/** Oznaka trenda posle cene — isti markap u crtanju i u ticku. */
export function smerHtml(smer: Smer): string {
  if (smer > 0) return '<span class="smer gore">' + t.pijaca.smer.gore + '</span>'
  if (smer < 0) return '<span class="smer dole">' + t.pijaca.smer.dole + '</span>'
  return '<span class="smer" style="color:var(--mastilo-b)">' + t.pijaca.smer.prosek + '</span>'
}

export function napraviTezgu(ui: UiRef): Tezga {
  function crtaj(now = ui().p.clock.now()): void {
    const u = ui()
    const s = u.igra().s
    const w = $(u.doc, '#tezga')
    const roba = robaNaTezgi(s)
    if (!roba.length) {
      w.innerHTML =
        '<p style="font-weight:700;color:var(--mastilo-b);font-size:13px;padding:4px 2px">' +
        t.pijaca.prazna +
        '</p>'
    } else {
      w.innerHTML = roba
        .map((k) => {
          const { cena, smer } = trzisnaCena(k, now)
          return (
            '<div class="roba"><div class="slicica">' +
            ikonica(k) +
            '</div>' +
            '<div class="info"><b>' +
            nazivArtikla(k) +
            '</b><span>' +
            t.pijaca.kolicina(s.mag[k]) +
            '</span></div>' +
            '<div class="cena"><b data-cena="' +
            k +
            '">' +
            t.din(cena) +
            '</b>' +
            smerHtml(smer) +
            '</div>' +
            '<button class="prodaj" data-prodaj="' +
            k +
            '">' +
            t.pijaca.prodajSve +
            '</button></div>'
          )
        })
        .join('')
      // D15: posle prodaje redovi se pomeraju — tapovi na tezgi se kratko ignorišu.
      for (const k of roba) {
        const b = w.querySelector<HTMLElement>('[data-prodaj="' + k + '"]')
        if (b) b.onclick = u.zak.cuvaj('#tezga', () => u.akcije.prodaj(k, b))
      }
    }
    u.crtaj.tacke(now)
  }

  function tikCene(now: number): void {
    for (const el of $$(ui().doc, '[data-cena]')) {
      const k = el.dataset.cena
      if (!jeArtikal(k)) continue
      const { cena, smer } = trzisnaCena(k, now)
      el.textContent = t.din(cena)
      const oznaka = el.nextElementSibling
      const nova = smerHtml(smer)
      if (oznaka && oznaka.outerHTML !== nova) oznaka.outerHTML = nova
    }
  }

  return { crtaj, tikCene }
}
