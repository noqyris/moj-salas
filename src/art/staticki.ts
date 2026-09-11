/*
 * Inline SVG iz statičkog HTML-a prototipa (moja-farma-v3.html L269–328), izmešten u art/ (CLAUDE.md:
 * „sav SVG … u art/"). Stringovi su bajt-identični izvoru; skelet (src/ui/skelet.ts) ih umeće na ista
 * mesta. Za razliku od ART sprajtova, ovi nemaju `xmlns` (parser ga dodaje sam unutar HTML-a).
 */

/** Unutrašnjost drveta — drvo1 i drvo2 se razlikuju samo po klasi (L269–270). */
const DRVO_UNUTRA =
  '<rect x="26" y="46" width="8" height="30" rx="3" fill="#7c4e26"/><circle cx="30" cy="30" r="20" fill="#5f9e37"/><circle cx="17" cy="40" r="12" fill="#6fae44"/><circle cx="43" cy="40" r="12" fill="#6fae44"/>'

function drvo(klasa: 'drvo1' | 'drvo2'): string {
  return `<svg class="ukras ${klasa}" viewBox="0 0 60 80">` + DRVO_UNUTRA + '</svg>'
}

/** Drvo levo (L269). */
export const DRVO2 = drvo('drvo2')
/** Drvo desno od ambara (L270). */
export const DRVO1 = drvo('drvo1')

/** Ambar (L271–278). Prelomi redova i uvlačenje su deo stringa jer je skelet bajt-identičan prototipu;
 *  razmaci između SVG elemenata se ne crtaju. */
export const AMBAR =
  '<svg class="ukras ambar" viewBox="0 0 120 90">\n' +
  '      <rect x="28" y="42" width="64" height="42" rx="3" fill="#c94f35"/>\n' +
  '      <polygon points="22,44 60,14 98,44" fill="#8f3b26"/>\n' +
  '      <rect x="50" y="58" width="20" height="26" rx="2" fill="#7a2f1e"/>\n' +
  '      <path d="M50 58 L70 84 M70 58 L50 84" stroke="#e8d8c6" stroke-width="2.5"/>\n' +
  '      <rect x="49" y="57" width="22" height="28" rx="2" fill="none" stroke="#e8d8c6" stroke-width="2.5"/>\n' +
  '      <circle cx="60" cy="32" r="6" fill="#f7ecd9" stroke="#8f3b26" stroke-width="2"/>\n' +
  '    </svg>'

/** Novčić u novčaniku (L286) — isto što i ART.novcic, samo bez `xmlns`. */
export const NOVCIC_PILULA =
  '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#ffc53d" stroke="#d89a17" stroke-width="2"/><circle cx="12" cy="12" r="5.5" fill="none" stroke="#d89a17" stroke-width="1.6" opacity=".7"/></svg>'

/** Ikonice tabova u donjoj navigaciji (L325–328); `stroke="currentColor"` prati boju dugmeta. */
export const NAV_IKONE: Readonly<Record<'farma' | 'narudzbe' | 'pijaca' | 'radnja', string>> = {
  farma:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21V11"/><path d="M12 14C8 14 5 11 5 7c4 0 7 3 7 7z"/><path d="M12 12c4 0 7-3 7-7-4 0-7 3-7 7z"/></svg>',
  narudzbe:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3.5" width="14" height="17" rx="2.5"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>',
  pijaca:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10h16l-1.8 9a2 2 0 0 1-2 1.6H7.8a2 2 0 0 1-2-1.6L4 10z"/><path d="M8.5 10L12 4l3.5 6"/><path d="M9 14v3M12 14v3M15 14v3"/></svg>',
  radnja:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9.5" cy="19" r="1.6"/><circle cx="17" cy="19" r="1.6"/><path d="M3.5 4.5h2.4l2.3 10.4a1.6 1.6 0 0 0 1.6 1.3h7.4a1.6 1.6 0 0 0 1.6-1.2L20.5 8H7"/></svg>',
}
