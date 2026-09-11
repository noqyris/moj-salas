/*
 * DOM pomoćnici. Koren (Document ili element) se uvek prosleđuje — nema skrivenog `document`-a,
 * pa svaki test/instanca aplikacije radi nad svojim stablom.
 */

/** Prvi element za selektor; BACA ako ga nema (prototipov `$` bi pukao kasnije, na null-u). */
export function $<E extends Element = HTMLElement>(koren: ParentNode, selektor: string): E {
  const el = koren.querySelector<E>(selektor)
  if (!el) throw new Error(`Element ne postoji: ${selektor}`)
  return el
}

/** Svi elementi za selektor, redosledom u dokumentu, kao pravi niz. */
export function $$<E extends Element = HTMLElement>(koren: ParentNode, selektor: string): E[] {
  return Array.from(koren.querySelectorAll<E>(selektor))
}
