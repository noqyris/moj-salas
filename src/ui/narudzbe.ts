/*
 * Tabla za narudžbine (04 §2.5). Kao prototip (L866), crtanje počinje dopunom table do 2 narudžbine —
 * u svim dostižnim putanjama to je no-op (svaka putanja koja uklanja narudžbinu već dopuni tablu), ali
 * ostaje radi istog trošenja rng-a.
 */
import { ART, ikonica } from '../art'
import { mozeIsporuka, osigurajNarudzbe } from '../core'
import { t } from '../i18n'
import { $, $$ } from './dom'
import type { UiRef } from './kontekst'

export interface Narudzbe {
  crtaj(now?: number): void
}

export function napraviNarudzbe(ui: UiRef): Narudzbe {
  function crtaj(now?: number): void {
    const u = ui()
    const g = u.igra()
    osigurajNarudzbe(g, u.p.random)
    const s = g.s
    const w = $(u.doc, '#narudzbeKuca')
    w.innerHTML = s.narudzbe
      .map((o) => {
        const stavke = o.stavke
          .map(
            (st) =>
              '<div class="stavka' +
              (s.mag[st.k] < st.kom ? ' fali' : '') +
              '"><span class="slicica">' +
              ikonica(st.k) +
              '</span>' +
              t.narudzbe.stavka(s.mag[st.k], st.kom) +
              '</div>',
          )
          .join('')
        return (
          '<div class="kartica" style="margin-top:10px">' +
          '<div class="musterija"><div class="avatar" style="background:' +
          o.boja +
          '">' +
          o.emoji +
          '</div>' +
          '<div><b>' +
          o.ime +
          '</b><span>' +
          t.narudzbe.poruka(o.msg) +
          '</span></div></div>' +
          '<div class="stavke">' +
          stavke +
          '</div>' +
          '<div class="nagrada"><span>' +
          ART.novcic +
          t.narudzbe.nagradaDin(o.din) +
          '</span><span class="xpp">' +
          t.narudzbe.nagradaXp(o.xp) +
          '</span></div>' +
          '<button class="dugme zlatno" data-isporuci="' +
          o.id +
          '" ' +
          (mozeIsporuka(s, o) ? '' : 'disabled') +
          '>' +
          t.narudzbe.isporuci +
          '</button>' +
          '<button class="odbij" data-odbij="' +
          o.id +
          '">' +
          t.narudzbe.odbij +
          '</button></div>'
        )
      })
      .join('')
    // ID se čita iz `data-*` u trenutku klika, kao brojčani (prototip `+b.dataset.isporuci`).
    // D15: tapovi na tabli se ignorišu kratko posle isporuke/odbijanja (red se pomerio).
    for (const b of $$(w, '[data-isporuci]')) {
      b.onclick = u.zak.cuvaj('#narudzbeKuca', () =>
        u.akcije.isporuci(Number(b.dataset.isporuci), b),
      )
    }
    for (const b of $$(w, '[data-odbij]')) {
      b.onclick = u.zak.cuvaj('#narudzbeKuca', () => u.akcije.odbij(Number(b.dataset.odbij)))
    }
    u.crtaj.tacke(now)
  }

  return { crtaj }
}
