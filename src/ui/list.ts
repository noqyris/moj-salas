/*
 * Donji list „Šta sadiš?" (04 §2.9): sve kulture redom REDOSLED, zaključane i nedostupne su
 * `disabled` (izračunato pri otvaranju). `#semena` se ne briše pri zatvaranju (1:1).
 *
 * `izabrana` se, kao u prototipu, ne poništava posle sadnje ni zatvaranja: dupli tap na seme core
 * odbija jer je parcela zauzeta (D2). Poništava je samo reset (ugovor §6).
 * D15: posle otvaranja pozadina (`#veo`) kratko ignoriše tapove, da drugi tap istog prsta ne zatvori
 * list koji se upravo otvorio.
 */
import { ikonica } from '../art'
import { KULTURE } from '../config'
import { opcijeSemena } from '../core'
import { t } from '../i18n'
import { $ } from './dom'
import type { ListSemena, UiRef } from './kontekst'

export function napraviList(ui: UiRef): ListSemena {
  let izabrana = -1

  function crtaj(): void {
    const u = ui()
    const w = $(u.doc, '#semena')
    const opcije = opcijeSemena(u.igra().s)
    w.innerHTML = opcije
      .map(({ k, zakljucano, moze }) => {
        const K = KULTURE[k]
        return (
          '<button class="seme' +
          (zakljucano ? ' zakljucano' : '') +
          '" data-seme="' +
          k +
          '" ' +
          (moze ? '' : 'disabled') +
          '>' +
          '<div class="slicica">' +
          ikonica(k) +
          '</div>' +
          '<div class="info"><b>' +
          t.kulture[k].naziv +
          '</b><span>' +
          (zakljucano ? t.list.otkljucavaSe(K.nivo) : t.list.info(k)) +
          '</span></div>' +
          '<div class="kosta">' +
          (zakljucano ? t.list.katanac : t.din(K.seme) + '<small>' + t.list.xp(K.xp) + '</small>') +
          '</div></button>'
        )
      })
      .join('')
    for (const { k } of opcije) {
      const b = w.querySelector<HTMLElement>('[data-seme="' + k + '"]')
      if (b) b.onclick = () => u.akcije.posadi(k)
    }
  }

  function otvori(i: number): void {
    const u = ui()
    izabrana = i
    crtaj()
    $(u.doc, '#veo').classList.add('otvoren')
    $(u.doc, '#list').classList.add('otvoren')
    u.zak.zakljucaj('#veo')
  }

  function zatvori(): void {
    const u = ui()
    $(u.doc, '#veo').classList.remove('otvoren')
    $(u.doc, '#list').classList.remove('otvoren')
  }

  return {
    otvori,
    zatvori,
    crtaj,
    otvoren: () => $(ui().doc, '#list').classList.contains('otvoren'),
    izabrana: () => izabrana,
    ponisti: () => {
      izabrana = -1
    },
  }
}
