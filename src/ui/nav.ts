/*
 * Donja navigacija (04 §4.6) i crvene tačkice (04 §2.8). Tab se ne pamti — start je uvek „Farma".
 * Promena taba ponovo crta taj tab (farma ništa: nju drže ažurnom akcije i tick).
 */
import { navTacke } from '../core'
import { $, $$ } from './dom'
import type { UiRef } from './kontekst'
import { TABOVI, TACKA_ID, type TabId } from './skelet'

function jeTab(x: string | undefined): x is TabId {
  return (TABOVI as readonly (string | undefined)[]).includes(x)
}

/** Vezuje `nav [data-tab]` dugmad (posle boot-a). */
export function veziNav(ui: UiRef): void {
  const u = ui()
  const dugmad = $$(u.doc, 'nav [data-tab]')
  for (const b of dugmad) {
    b.onclick = () => {
      const tab = b.dataset.tab
      if (!jeTab(tab)) return
      u.zvuk('tap')
      for (const x of dugmad) x.classList.remove('aktivan')
      for (const x of $$(u.doc, '.tab')) x.classList.remove('aktivan')
      b.classList.add('aktivan')
      $(u.doc, '#tab-' + tab).classList.add('aktivan')
      if (tab === 'narudzbe') u.crtaj.narudzbe()
      else if (tab === 'pijaca') u.crtaj.tezga()
      else if (tab === 'radnja') u.crtaj.radnja()
    }
  }
}

/** Tačkice (i na aktivnom tabu): predikati su u core `navTacke`, 1:1 sa prototipom. */
export function osveziTacke(ui: UiRef, now: number): void {
  const u = ui()
  const d = navTacke(u.igra().s, now)
  const ima: Readonly<Record<TabId, boolean>> = {
    farma: d.farma,
    narudzbe: d.narudzbine,
    pijaca: d.pijaca,
    radnja: d.radnja,
  }
  for (const tab of TABOVI) $(u.doc, '#' + TACKA_ID[tab]).classList.toggle('ima', ima[tab])
}
