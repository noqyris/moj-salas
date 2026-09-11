/*
 * Šta prst može da pogodi (07 §c.4 „reachable", isto kao `dostupno()` drajvera pariteta):
 * z-redosled #nivoVeo (80) > #list (41) > #veo (40) > nav (30); ispod vela samo AKTIVNI tab; bez
 * disabled dugmadi (parcele su div-ovi — sve se mogu tapnuti). Radi nad bilo kojim dokumentom (port ili
 * prototip), pa DOM paritet može da proveri da obe strane nude ISTE tapove.
 */

export interface Upit {
  q(s: string): HTMLElement | null
  qa(s: string): HTMLElement[]
}

/** Tap: element je `qa(sel)[i]`; `opis` je stabilan i čitljiv (za poređenje i poruke). */
export interface Tap {
  opis: string
  sel: string
  i: number
  tezina: number
}

export function dostupniTapovi(u: Upit): Tap[] {
  const op: Tap[] = []
  const svi = (
    sel: string,
    tezina: (el: HTMLElement) => number,
    opis: (el: HTMLElement) => string,
  ) => u.qa(sel).forEach((el, i) => op.push({ opis: opis(el), sel, i, tezina: tezina(el) }))

  if (u.q('#nivoVeo.otvoren')) {
    svi(
      '#nivoOk',
      () => 3,
      () => 'ok',
    )
    return op
  }
  if (u.q('#list.otvoren')) {
    const semena = u.qa('#semena [data-seme]:not([disabled])')
    svi(
      '#semena [data-seme]:not([disabled])',
      () => 6 / Math.max(1, semena.length),
      (el) => 'seme ' + (el.dataset.seme ?? '?'),
    )
    svi(
      '#veo',
      () => 1,
      () => 'veo',
    )
    return op
  }
  svi(
    'nav [data-tab]',
    () => 0.3,
    (el) => 'tab ' + (el.dataset.tab ?? '?'),
  )
  switch (u.q('nav button.aktivan')?.dataset.tab) {
    case 'farma':
      svi(
        '#njive .parcela',
        (el) => (el.classList.contains('zakljucana') ? 0.5 : 1.5),
        (el) => 'parcela ' + (el.dataset.i ?? '-') + ' ' + el.className,
      )
      svi(
        '#uberiSve',
        () => 1,
        () => 'uberi sve',
      )
      svi(
        '[data-kuvaj]:not([disabled])',
        () => 1,
        (el) => 'kuvaj ' + (el.dataset.kuvaj ?? '?'),
      )
      svi(
        '[data-pokupi]:not([disabled])',
        () => 1,
        (el) => 'pokupi ' + (el.dataset.pokupi ?? '?'),
      )
      break
    case 'narudzbe':
      svi(
        '[data-isporuci]:not([disabled])',
        () => 2,
        (el) => 'isporuci ' + (el.dataset.isporuci ?? '?'),
      )
      svi(
        '[data-odbij]',
        () => 1,
        (el) => 'odbij ' + (el.dataset.odbij ?? '?'),
      )
      break
    case 'pijaca':
      svi(
        '[data-prodaj]',
        () => 1,
        (el) => 'prodaj ' + (el.dataset.prodaj ?? '?'),
      )
      break
    case 'radnja':
      svi(
        '[data-kupi]:not([disabled])',
        () => 2,
        (el) => 'kupi ' + (el.dataset.kupi ?? '?'),
      )
      svi(
        '#zvukDugme',
        () => 0.2,
        () => 'zvuk',
      )
      svi(
        '#resetDugme',
        () => 0.02,
        () => 'reset',
      )
      break
    default:
      throw new Error('nijedan tab nije aktivan')
  }
  return op
}

/** Ponderisan izbor (seedovan tok `r`). */
export function izaberi<T extends { tezina: number }>(op: readonly T[], r: () => number): T {
  const ukupno = op.reduce((s, x) => s + x.tezina, 0)
  let x = r() * ukupno
  for (const o of op) {
    x -= o.tezina
    if (x <= 0) return o
  }
  const poslednji = op[op.length - 1]
  if (poslednji === undefined) throw new Error('nema opcija')
  return poslednji
}
