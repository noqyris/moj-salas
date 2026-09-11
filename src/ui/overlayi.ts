/*
 * Šabloni overlay kartica (04 §2.10): level-up (prikaziNivo L722–726), „Dobro došao nazad" (boot
 * L1191–1198, sa D16 redom po mašini) i dnevni poklon (L1209–1211). Markap je 1:1 sa prototipom;
 * tekst je iz i18n, grafika iz art/. Svaka kartica završava dugmetom `#nivoOk`.
 */
import { ART, ikonicaOtkljucavanja } from '../art'
import { ZIV, ZIV_REDOSLED } from '../config'
import type { Otkljucavanje, RezimeOdsustva } from '../core'
import { nazivOtkljucavanja, t } from '../i18n'

const OK = (tekst: string): string =>
  '<button class="dugme zlatno" id="nivoOk">' + tekst + '</button>'

/** Level-up kartica za jedan pređeni nivo (bonus je već u novcu). */
export function nivoHtml(
  nivo: number,
  bonus: number,
  otkljucano: readonly Otkljucavanje[],
): string {
  const plocice = otkljucano
    .map(
      (o) =>
        '<div class="kockica"><span class="slicica">' +
        ikonicaOtkljucavanja(o) +
        '</span>' +
        nazivOtkljucavanja(o) +
        '</div>',
    )
    .join('')
  return (
    '<div class="zvezda">' +
    t.noviNivo.zvezda +
    '</div><h3>' +
    t.noviNivo.naslov(nivo) +
    '</h3>' +
    '<p>' +
    t.noviNivo.nagrada +
    '<b style="color:var(--zlato-t)">' +
    t.noviNivo.nagradaIznos(bonus) +
    '</b></p>' +
    (otkljucano.length
      ? '<p style="margin-top:6px">' +
        t.noviNivo.otkljucano +
        '</p><div class="otkljucano">' +
        plocice +
        '</div>'
      : '') +
    OK(t.noviNivo.ok)
  )
}

function red(ikona: string, tekst: string): string {
  return '<div><span class="slicica">' + ikona + '</span>' + tekst + '</div>'
}

/** „Dobro došao nazad": sazreli usevi, pa (D16) po red za SVAKU završenu mašinu sa njenom ikonicom
 *  i porukom `gotovo`, pa proizvodi životinja redom ZIV (jaja pre mleka). */
export function dobrodoslicaHtml(r: RezimeOdsustva): string {
  let linije = ''
  if (r.sazrelo) linije += red(ART.psenica3, t.dobrodoslica.sazrelo(r.sazrelo))
  for (const id of r.gotoveMasine) linije += red(ART[id], t.dobrodoslica.masina(id))
  // `skupilo` nastaje redom ZIV (rezimeOdsustva), pa je ovo isti redosled kao prototipov `for…in`.
  for (const id of ZIV_REDOSLED) {
    const p = ZIV[id].proizvod
    const n = r.skupilo[p]
    if (n) linije += red(ART[p], t.dobrodoslica.skupljeno(p, n))
  }
  return (
    '<div class="zvezda">' +
    t.dobrodoslica.zvezda +
    '</div><h3>' +
    t.dobrodoslica.naslov +
    '</h3><p>' +
    t.dobrodoslica.podnaslov +
    '</p>' +
    '<div class="spisak">' +
    linije +
    '</div>' +
    OK(t.dobrodoslica.ok)
  )
}

/** Dnevni poklon (novac je već dodat; HUD ga sustiže tek na „Hvala!"). */
export function poklonHtml(dar: number): string {
  return (
    '<span class="slicica" style="width:56px;display:inline-block">' +
    ART.poklon +
    '</span>' +
    '<h3>' +
    t.poklon.naslov +
    '</h3><p>' +
    t.poklon.pre +
    '<b style="color:var(--zlato-t)">' +
    t.poklon.iznos(dar) +
    '</b>' +
    t.poklon.posle +
    '</p>' +
    OK(t.poklon.ok)
  )
}
