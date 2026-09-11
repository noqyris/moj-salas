/*
 * Njive (04 §2.3, tick 04 §2.12 koraci 1–2): parcele + „Uberi sve (N)".
 *
 * Keš potpisa (prototip `potpisPre`, CLAUDE.md pravilo 5 / regresija 1): upisuje se SAMO na kraju
 * `crtaj` — jedine funkcije koja gradi DOM njiva — pa uvek opisuje DOM koji je na ekranu. Tick ga
 * samo ČITA i crta ponovo kad se potpis promeni.
 *
 * D12: jedan `now` po crtanju — DOM parcela, broj u „Uberi sve (N)", potpis i tačkice računaju se iz
 * istog trenutka (prototip je čitao sat više puta, pa je parcela koja sazri između dva čitanja ostajala
 * zaglavljena kao „raste", 04 B3).
 */
import { ART, biljka } from '../art'
import { UBERI_SVE_MIN } from '../config'
import { pogledParcele, potpisNjiva, sledecaCenaParcele, zrelihUseva } from '../core'
import { t } from '../i18n'
import { $ } from './dom'
import type { UiRef } from './kontekst'

export interface Njive {
  crtaj(now?: number): void
  /** In-place traka i odbrojavanje parcela koje rastu, pa ponovno crtanje ako se potpis promenio. */
  tik(now: number): void
  /** Keširan potpis (samo za čitanje; piše ga isključivo `crtaj`). */
  potpisPre(): string
}

export function napraviNjive(ui: UiRef): Njive {
  let potpisPre = ''

  function crtaj(now = ui().p.clock.now()): void {
    const u = ui()
    const s = u.igra().s
    const doc = u.doc
    const naNjivi = <A extends unknown[]>(fn: (...a: A) => void) => u.zak.cuvaj('#njive', fn)
    const w = $(doc, '#njive')
    w.innerHTML = ''
    s.parcele.forEach((p, i) => {
      const el = doc.createElement('div')
      el.className = 'parcela'
      el.dataset.i = String(i)
      const v = pogledParcele(p, now)
      if (v.vrsta === 'prazna') {
        el.classList.add('prazna')
        el.innerHTML =
          '<div class="plus">' +
          t.njive.plus +
          '</div>' +
          (!s.sadio && i === 0 ? '<div class="hint">' + t.njive.hint + '</div>' : '')
        el.onclick = naNjivi(() => {
          u.zvuk('tap')
          u.list.otvori(i)
        })
      } else if (v.vrsta === 'zrela') {
        el.classList.add('zrelo')
        el.innerHTML =
          '<div class="uberi">' +
          t.njive.uberi +
          '</div><div class="senkica"></div>' +
          '<div class="biljka">' +
          biljka(v.c, 3) +
          '</div>'
        el.onclick = naNjivi(() => u.akcije.uberi(i, el))
      } else {
        el.innerHTML =
          '<div class="senkica"></div>' +
          '<div class="biljka">' +
          biljka(v.c, v.faza) +
          '</div>' +
          (v.zalivena ? '' : '<span class="zalij">' + ART.kap + '</span>') +
          '<div class="info"><div class="cd">' +
          t.njive.odbrojavanje(v.preostaloS) +
          '</div>' +
          '<div class="traka"><i style="width:' +
          v.udeo * 100 +
          '%"></i></div></div>'
        // Inline transform mora da ponovi translateX(-50%) jer gazi CSS centriranje (04 §6).
        if (v.faza === 3) $(el, '.biljka').style.transform = 'translateX(-50%) scale(.9)'
        el.onclick = naNjivi(() => u.akcije.zalij(i, el))
      }
      w.appendChild(el)
    })
    const cena = sledecaCenaParcele(s)
    if (cena !== null) {
      const el = doc.createElement('div')
      el.className = 'parcela zakljucana'
      el.innerHTML =
        '<div class="sadrzajz"><div class="katanac">' +
        t.njive.katanac +
        '</div><div class="znak">' +
        t.din(cena) +
        '</div></div>'
      // D7: cenu računa core u trenutku klika (prototip je hvatao cenu pri crtanju).
      el.onclick = naNjivi(() => u.akcije.kupiParcelu())
      w.appendChild(el)
    }
    const zr = zrelihUseva(s, now)
    $(doc, '#uberiSveKuca').innerHTML =
      zr >= UBERI_SVE_MIN ? '<button id="uberiSve">' + t.njive.uberiSve(zr) + '</button>' : ''
    const us = doc.querySelector<HTMLElement>('#uberiSve')
    if (us) us.onclick = () => u.akcije.uberiSve()
    potpisPre = potpisNjiva(s, now)
    u.crtaj.tacke(now)
  }

  function tik(now: number): void {
    const u = ui()
    const s = u.igra().s
    s.parcele.forEach((p, i) => {
      const v = pogledParcele(p, now)
      // Prazne i zrele parcele tick ne dira (zrelu prevodi ponovno crtanje posle promene potpisa).
      if (v.vrsta !== 'raste') return
      const el = u.doc.querySelector<HTMLElement>('.parcela[data-i="' + i + '"]')
      if (!el) return
      const tr = el.querySelector<HTMLElement>('.traka i')
      const cd = el.querySelector('.cd')
      if (tr) tr.style.width = Math.min(100, v.udeo * 100) + '%'
      if (cd) cd.textContent = t.njive.odbrojavanje(v.preostaloS)
    })
    if (potpisNjiva(s, now) !== potpisPre) crtaj(now)
  }

  return { crtaj, tik, potpisPre: () => potpisPre }
}
