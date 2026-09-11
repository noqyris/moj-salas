/*
 * Statički skelet stranice — `<body>` prototipa (moja-farma-v3.html L262–335): #app (scena, HUD, main
 * sa 4 taba, nav), pa #veo, #list, #toast, #nivoVeo. Tekst dolazi iz i18n, SVG iz art/. Markap je
 * bajt-identičan prototipu (tests/parity/skelet.test.ts), osim podnaslova na tabli (D17).
 *
 * Svi dinamički regioni (#njive, #zgradeKuca, #narudzbeKuca, #tezga, #radnjaKuca, #statKuca, #semena,
 * #nivoKartica…) ostaju prazni; pune ih rendereri. #leptir1/#leptir2 puni boot (ART.leptir).
 */
import { AMBAR, DRVO1, DRVO2, NAV_IKONE, NOVCIC_PILULA } from '../art'
import { t } from '../i18n'

/** Tabovi redosledom u navigaciji; `data-tab` dugmeta i sufiks `#tab-<id>` sekcije. */
export const TABOVI = ['farma', 'narudzbe', 'pijaca', 'radnja'] as const
export type TabId = (typeof TABOVI)[number]

/** Tab koji je aktivan pri pokretanju (klasa `aktivan` u statičkom HTML-u). */
export const POCETNI_TAB: TabId = 'farma'

/** ID crvene tačke (`span.tacka`) u dugmetu taba. */
export const TACKA_ID: Readonly<Record<TabId, string>> = {
  farma: 'tackaFarma',
  narudzbe: 'tackaNar',
  pijaca: 'tackaPij',
  radnja: 'tackaRad',
}

const NAPOMENA_STIL =
  'font-size:12px;color:#3d6b1e;font-weight:700;margin-top:10px;text-align:center'

function navDugme(id: TabId): string {
  const aktivan = id === POCETNI_TAB ? ' class="aktivan"' : ''
  return (
    `    <button data-tab="${id}"${aktivan}><span class="ikona">${NAV_IKONE[id]}</span>` +
    `${t.nav[id]}<span class="tacka" id="${TACKA_ID[id]}"></span></button>`
  )
}

/** Sadržaj `<body>`-a: tačno ono što je u prototipu između `<body>` i `<script>` (vodeći i završni
 *  prelomi redova uključeni), sa D17 podnaslovom. */
export function skeletHtml(): string {
  const linije = [
    '<div id="app">',
    '  <div id="scena">',
    '    <div class="sunce"></div>',
    '    <div class="oblak o1"></div>',
    '    <div class="oblak o2"></div>',
    '    <div class="brdo zadnje"></div>',
    '    <div class="brdo prednje"></div>',
    '    ' + DRVO2,
    '    ' + DRVO1,
    '    ' + AMBAR,
    '    <span class="scenaKoka" id="scenaKoka"></span>',
    '    <span class="scenaKrava" id="scenaKrava"></span>',
    '    <span class="leptir" id="leptir1"></span>',
    '    <span class="leptir l2" id="leptir2"></span>',
    '    <div id="hud">',
    `      <div class="tabla">${t.hud.tabla}<small>${t.hud.podnaslov}</small></div>`,
    '      <div id="hudDesno">',
    `        <div class="pilula" id="novacPilula">${NOVCIC_PILULA}<span id="novac">0</span>&nbsp;${t.hud.valuta}</div>`,
    `        <div class="nivo" id="nivoPilula">${t.hud.nivo}<span id="nivoBr">1</span><div class="xpTraka"><i id="xpTraka"></i></div></div>`,
    '      </div>',
    '    </div>',
    '  </div>',
    '',
    '  <main>',
    '    <section id="tab-farma" class="tab aktivan">',
    '      <div id="uberiSveKuca"></div>',
    '      <div class="njive" id="njive"></div>',
    '      <div id="zgradeKuca"></div>',
    '    </section>',
    '',
    '    <section id="tab-narudzbe" class="tab">',
    `      <h2>${t.narudzbe.naslov}</h2>`,
    '      <div id="narudzbeKuca"></div>',
    `      <p style="${NAPOMENA_STIL}">${t.narudzbe.napomena}</p>`,
    '    </section>',
    '',
    '    <section id="tab-pijaca" class="tab">',
    `      <h2>${t.pijaca.naslov}</h2>`,
    '      <div class="kartica" style="margin-top:0" id="tezga"></div>',
    `      <p style="${NAPOMENA_STIL}">${t.pijaca.napomena}</p>`,
    '    </section>',
    '',
    '    <section id="tab-radnja" class="tab">',
    `      <h2>${t.radnja.naslov}</h2>`,
    '      <div id="radnjaKuca"></div>',
    `      <h2 style="margin-top:16px">${t.statistika.naslov}</h2>`,
    '      <div class="kartica" style="margin-top:0" id="statKuca"></div>',
    `      <h2 style="margin-top:16px">${t.podesavanja.naslov}</h2>`,
    '      <div class="kartica" style="margin-top:0">',
    `        <button class="dugme tiho" id="zvukDugme" style="margin-top:0">${t.podesavanja.zvuk(false)}</button>`,
    `        <button class="dugme tiho" id="resetDugme">${t.podesavanja.reset}</button>`,
    '      </div>',
    '    </section>',
    '  </main>',
    '',
    '  <nav><div class="unutra">',
    ...TABOVI.map(navDugme),
    '  </div></nav>',
    '</div>',
    '',
    '<div id="veo"></div>',
    `<div id="list"><h3>${t.list.naslov}</h3><div id="semena"></div></div>`,
    '<div id="toast"></div>',
    '<div id="nivoVeo"><div id="nivoKartica"></div></div>',
  ]
  return '\n' + linije.join('\n') + '\n\n'
}

/**
 * Upisuje skelet u `doc.body` i ZAMENJUJE sav postojeći sadržaj body-ja (idempotentno — drugi poziv
 * daje isti DOM, bez duplih ID-jeva). Poziva se jednom, na početku boot-a, pre bilo kog renderera.
 * `<script type="module">` iz index.html se time uklanja iz DOM-a, što ne utiče na skriptu koja se već
 * izvršava. Redosled dece body-ja: #app, #veo, #list, #toast, #nivoVeo; FX čvorovi se dodaju posle njih.
 */
export function montirajSkelet(doc: Document): void {
  doc.body.innerHTML = skeletHtml()
}
