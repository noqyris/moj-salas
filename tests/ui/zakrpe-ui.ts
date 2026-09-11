/*
 * UI zakrpe orakla za DOM paritet (04 §7.5). `tools/parity/zakrpe.ts` pokriva odstupanja koja se vide u
 * STANJU (D1–D6, D8, D12); ovde su ona koja se vide samo u DOM-u, da orakl bude „prototip sa odobrenim
 * odstupanjima" i za markap — pa se DOM porta poredi BEZ ikakve normalizacije:
 *   - D14 (smer): tick osvežava i oznaku trenda (▲/▼/—) posle cene, istim markapom kao crtajTezgu;
 *   - D14 (list): crtajSve ponovo gradi list semena ako je otvoren (npr. posle level-up OK);
 *   - D16 (trajanje): trajanjeTxt kroz toLocaleString('sr-RS') — „1,5 min" (ugovor §7);
 *   - D16 (dobrodošlica): po jedan red za SVAKU završenu mašinu, ART[id] + poruka `gotovo`;
 *   - D17: podnaslov table `prototip v<verzija iz package.json>`;
 *   - ugovor §6 (reset): `izabrana = -1` i zatvoren list (04 §4.12 je obrnuto — ugovor ima prednost).
 *
 * D9, D13 i D15 se NE zakrpljuju: D9 menja samo neuspešna učitavanja, D13 samo trenutak upisa (test
 * poredi sejv kad su obe strane upisale), a D15 test izbegava (≥ ZAKLJUCAVANJE_TAPA_MS između tapova).
 *
 * INSTRUMENT_UI nisu odstupanja: beleže zvuke (posle provere `mute`, kao što ih port pušta) i vibracije,
 * da test uporedi i ono što se ne vidi u DOM-u.
 *
 * Svaka zakrpa tvrdi tačan broj pojavljivanja (primeniZakrpe baca ako se prototip promeni).
 */
import type { Zakrpa } from '../helpers/prototip'

/** Isti markap oznake trenda kao prototipov `crtajTezgu` (L899). */
const SMER_JS =
  'tc.smer>0?\'<span class="smer gore">▲ dobra cena</span>\':tc.smer<0?' +
  '\'<span class="smer dole">▼ slaba cena</span>\':' +
  '\'<span class="smer" style="color:var(--mastilo-b)">— prosek</span>\''

export function zakrpeUi(verzija: string): readonly Zakrpa[] {
  return [
    {
      id: 'D14-smer',
      nadji: "el.textContent = fmt(trzisnaCena(el.dataset.cena).cena)+' din';",
      zameni:
        "const tc = trzisnaCena(el.dataset.cena); el.textContent = fmt(tc.cena)+' din';" +
        ' const str = ' +
        SMER_JS +
        ';' +
        ' const oz = el.nextElementSibling; if(oz && oz.outerHTML !== str) oz.outerHTML = str;',
      ocekivano: 1,
    },
    {
      id: 'D14-list',
      nadji:
        'function crtajSve(){ crtajNovac(); crtajNivo(); crtajNjive(); crtajZgrade(); crtajNarudzbe();' +
        ' crtajTezgu(); crtajRadnju(); }',
      zameni:
        'function crtajSve(){ crtajNovac(); crtajNivo(); crtajNjive(); crtajZgrade(); crtajNarudzbe();' +
        " crtajTezgu(); crtajRadnju(); if($('#list').classList.contains('otvoren')) otvoriList(izabrana); }",
      ocekivano: 1,
    },
    {
      id: 'D16-trajanje',
      nadji:
        "function trajanjeTxt(s){ if(s>=3600) return (s/3600)+' h'; if(s>=60) return (s/60)+' min';" +
        " return s+' s'; }",
      zameni:
        "function trajanjeTxt(s){ if(s>=3600) return (s/3600).toLocaleString('sr-RS')+' h';" +
        " if(s>=60) return (s/60).toLocaleString('sr-RS')+' min'; return s.toLocaleString('sr-RS')+' s'; }",
      ocekivano: 1,
    },
    {
      id: 'D16-dobrodoslica',
      nadji:
        "if(mGotovo) linije += '<div><span class=\"slicica\">'+ART.kazan+'</span>Mašine su završile" +
        " posao</div>';",
      zameni:
        'for(const id in MASINE){ const m = S.masine[id];' +
        ' if(m.k && m.t>0 && m.t + MASINE[id].vreme*1000 <= pre)' +
        " linije += '<div><span class=\"slicica\">'+ART[id]+'</span>'+MASINE[id].gotovo+'</div>'; }",
      ocekivano: 1,
    },
    {
      id: 'D17-podnaslov',
      nadji: '<small>prototip v0.3</small>',
      zameni: `<small>prototip v${verzija}</small>`,
      ocekivano: 1,
    },
    {
      id: 'ugovor6-reset',
      nadji: "sacuvaj(true); crtajSve(); toast('Nova igra. Srećno! 🌱');",
      zameni:
        "izabrana = -1; zatvoriList(); sacuvaj(true); crtajSve(); toast('Nova igra. Srećno! 🌱');",
      ocekivano: 1,
    },
  ]
}

export const INSTRUMENT_UI: readonly Zakrpa[] = [
  {
    // Posle provere `mute` — tačno ono što port prosleđuje AudioPort-u.
    id: 'instrument-zvuk',
    nadji: '  if(S.mute) return;',
    zameni: '  if(S.mute) return; (window.__zvuci||(window.__zvuci=[])).push(v);',
    ocekivano: 1,
  },
  {
    id: 'instrument-vibro',
    nadji: 'function vibro(ms){ try{',
    zameni:
      'function vibro(ms){ (window.__vibracije||(window.__vibracije=[])).push(JSON.stringify(ms)); try{',
    ocekivano: 1,
  },
]
