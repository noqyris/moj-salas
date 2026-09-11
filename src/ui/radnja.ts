/*
 * Radnja (04 §2.7): kartice zgrada, aukcija, statistika i natpis dugmeta za zvuk.
 * Dugme „Kupi" je `disabled` samo kad nema dovoljno novca — anti-softlock se tu NE gleda (1:1); njega
 * proverava core pri kupovini („Ostavi bar za seme pšenice 🙂").
 */
import { ART } from '../art'
import { MASINE, MASINE_REDOSLED, ZIV, ZIV_REDOSLED, jeMasina, type ZgradaId } from '../config'
import { stanjeZgrade, type Stanje } from '../core'
import { fmt, nazivZgrade, t } from '../i18n'
import { $ } from './dom'
import type { UiRef } from './kontekst'

export interface Radnja {
  crtaj(now?: number): void
}

function definicija(id: ZgradaId): { cena: number; nivo: number } {
  return jeMasina(id) ? MASINE[id] : ZIV[id]
}

function opis(id: ZgradaId): string {
  return jeMasina(id) ? t.masine[id].opis : t.zivotinje[id].opis
}

/** Kartica zgrade. Prva kartica dobija `style="margin-top:0"` — i kad je siva (prototipov trik sa
 *  zatvaranjem navodnika u klasi, 04 §2.7). */
function kartica(s: Stanje, id: ZgradaId, prva: boolean): string {
  const D = definicija(id)
  const stil = prva ? '" style="margin-top:0' : ''
  const slika = '<div class="red"><div class="slika">' + ART[id] + '</div>'
  switch (stanjeZgrade(s, id)) {
    case 'kupljeno':
      return (
        '<div class="kartica' +
        stil +
        '">' +
        slika +
        '<div><h3>' +
        nazivZgrade(id) +
        '</h3><p>' +
        t.radnja.kupljeno +
        '</p></div></div></div>'
      )
    case 'dostupno':
      return (
        '<div class="kartica' +
        stil +
        '">' +
        slika +
        '<div><h3>' +
        nazivZgrade(id) +
        '</h3><p>' +
        opis(id) +
        '</p></div></div>' +
        '<button class="dugme" data-kupi="' +
        id +
        '" ' +
        (s.novac < D.cena ? 'disabled' : '') +
        '>' +
        t.radnja.kupi(D.cena) +
        '</button></div>'
      )
    case 'zakljucano':
      return (
        '<div class="kartica siva' +
        stil +
        '">' +
        slika +
        '<div><h3>' +
        t.radnja.zakljucano(id) +
        '</h3><p>' +
        t.radnja.otkljucavaSe(D.nivo) +
        '</p></div></div></div>'
      )
  }
}

export function napraviRadnju(ui: UiRef): Radnja {
  function crtaj(now?: number): void {
    const u = ui()
    const s = u.igra().s
    const w = $(u.doc, '#radnjaKuca')
    const zgrade: ZgradaId[] = [...MASINE_REDOSLED, ...ZIV_REDOSLED]
    let html = ''
    for (const id of zgrade) html += kartica(s, id, html === '')
    html +=
      '<div class="kartica siva"><div class="red"><div class="slika">' +
      ART.katanac +
      '</div>' +
      '<div><h3>' +
      t.radnja.aukcijaNaslov +
      '</h3><p>' +
      t.radnja.aukcijaOpis +
      '</p></div></div></div>'
    w.innerHTML = html
    for (const id of zgrade) {
      const b = w.querySelector<HTMLElement>('[data-kupi="' + id + '"]')
      if (b) b.onclick = () => u.akcije.kupiZgradu(id)
    }
    $(u.doc, '#statKuca').innerHTML =
      '<div class="statRed"><span>' +
      t.statistika.ubrano +
      '</span><b>' +
      fmt(s.stat.ubrano) +
      '</b></div>' +
      '<div class="statRed"><span>' +
      t.statistika.zaradjeno +
      '</span><b>' +
      t.din(s.stat.zaradjeno) +
      '</b></div>' +
      '<div class="statRed"><span>' +
      t.statistika.isporuke +
      '</span><b>' +
      fmt(s.stat.isporuke) +
      '</b></div>'
    $(u.doc, '#zvukDugme').textContent = t.podesavanja.zvuk(s.mute)
    u.crtaj.tacke(now)
  }

  return { crtaj }
}
