/*
 * Kartice mašina i životinja na farmi (04 §2.4) i njihovi in-place delovi ticka (04 §2.12 koraci 3–4).
 * Na kraju crtanja: životinje u sceni. `crtajZgrade` NE osvežava tačkice (1:1 sa prototipom).
 */
import { ART } from '../art'
import { MASINE, MASINE_REDOSLED, ZIV_REDOSLED } from '../config'
import { pogledMasine, pogledZivotinje } from '../core'
import { t } from '../i18n'
import { $ } from './dom'
import type { UiRef } from './kontekst'
import { crtajZivotinjeUSceni } from './scena'

export interface Zgrade {
  crtaj(now?: number): void
  /** Odbrojavanje i traka mašina koje i dalje rade (posle `tikMasina`). */
  tikMasine(now: number): void
  /** Broj spremnih, traka i `disabled` dugmeta „Pokupi" (D4: disabled kad n ≤ 0). */
  tikZivotinje(now: number): void
}

export function napraviZgrade(ui: UiRef): Zgrade {
  function crtaj(now = ui().p.clock.now()): void {
    const u = ui()
    const s = u.igra().s
    const w = $(u.doc, '#zgradeKuca')
    let html = ''
    for (const id of MASINE_REDOSLED) {
      if (!s.masine[id].k) continue
      const M = MASINE[id]
      const v = pogledMasine(s, id, now)
      const unutra = v.radi
        ? '<div class="traka2"><i data-mbar="' +
          id +
          '" style="width:' +
          v.udeo * 100 +
          '%"></i></div>' +
          '<p style="margin-top:5px" data-mcd="' +
          id +
          '">' +
          t.zgrade.gotovoZa(v.preostaloS) +
          '</p>'
        : '<button class="dugme toplo" data-kuvaj="' +
          id +
          '" ' +
          (s.mag[M.ulazK] < M.ulazN ? 'disabled' : '') +
          '>' +
          t.masine[id].akcija +
          '</button>'
      html +=
        '<div class="kartica" data-masina="' +
        id +
        '"><div class="red"><div class="slika">' +
        ART[id] +
        '</div>' +
        '<div><h3>' +
        t.masine[id].naziv +
        '</h3><p>' +
        t.zgrade.masinaInfo(id, s.mag[M.ulazK]) +
        '</p></div></div>' +
        unutra +
        '</div>'
    }
    for (const id of ZIV_REDOSLED) {
      if (!s.ziv[id].k) continue
      const v = pogledZivotinje(s, id, now)
      html +=
        '<div class="kartica" data-zgz="' +
        id +
        '"><div class="red"><div class="slika">' +
        ART[id] +
        '</div>' +
        '<div><h3>' +
        t.zivotinje[id].naziv +
        '</h3><p><span data-zn="' +
        id +
        '">' +
        v.n +
        '</span>' +
        t.zgrade.zivotinjaInfo(id) +
        '</p></div></div>' +
        '<div class="traka2 plava"><i data-zbar="' +
        id +
        '" style="width:' +
        v.udeo * 100 +
        '%"></i></div>' +
        '<button class="dugme" data-pokupi="' +
        id +
        '" ' +
        (v.n > 0 ? '' : 'disabled') +
        '>' +
        t.zgrade.pokupi +
        '</button></div>'
    }
    w.innerHTML = html
    // Handleri po elementu; ID je uhvaćen iz petlje (isti kao `data-*` na dugmetu).
    for (const id of MASINE_REDOSLED) {
      const b = w.querySelector<HTMLElement>('[data-kuvaj="' + id + '"]')
      if (b) b.onclick = () => u.akcije.pokreniMasinu(id)
    }
    for (const id of ZIV_REDOSLED) {
      const b = w.querySelector<HTMLElement>('[data-pokupi="' + id + '"]')
      if (b) b.onclick = () => u.akcije.pokupi(id, b)
    }
    crtajZivotinjeUSceni(u.doc, s)
  }

  function tikMasine(now: number): void {
    const u = ui()
    const s = u.igra().s
    for (const id of MASINE_REDOSLED) {
      const m = s.masine[id]
      if (!m.k || !m.t) continue
      const v = pogledMasine(s, id, now)
      if (!v.radi) continue
      const cd = u.doc.querySelector('[data-mcd="' + id + '"]')
      const tr = u.doc.querySelector<HTMLElement>('[data-mbar="' + id + '"]')
      if (cd) cd.textContent = t.zgrade.gotovoZa(v.preostaloS)
      if (tr) tr.style.width = Math.min(100, v.udeo * 100) + '%'
    }
  }

  function tikZivotinje(now: number): void {
    const u = ui()
    const s = u.igra().s
    for (const id of ZIV_REDOSLED) {
      if (!s.ziv[id].k) continue
      const v = pogledZivotinje(s, id, now)
      const nEl = u.doc.querySelector('[data-zn="' + id + '"]')
      const bEl = u.doc.querySelector<HTMLElement>('[data-zbar="' + id + '"]')
      const pEl = u.doc.querySelector<HTMLButtonElement>('[data-pokupi="' + id + '"]')
      if (nEl) nEl.textContent = String(v.n)
      if (bEl) bEl.style.width = v.udeo * 100 + '%'
      if (pEl) pEl.disabled = v.n <= 0
    }
  }

  return { crtaj, tikMasine, tikZivotinje }
}
