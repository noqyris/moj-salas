/*
 * Zakrpe koje prototip pretvaraju u „prototip sa odobrenim odstupanjima" (ugovor §3), da bi
 * differential paritet poredio port sa ONIM što je Đorđe odobrio, a ne sa starim bagovima.
 *
 * Polazna tačka je referentni patch revizije (spec/../patched/fixes.diff); dodato:
 *   - D6 čuva i `poklonDan` pri resetu (fixes.diff je čuvao samo `mute`);
 *   - D2 odbija i indeks van opsega i zaključanu kulturu (fixes.diff: samo zauzetu parcelu);
 *   - D8 izbacuje `ko` i uzima `msg` iz MUSTERIJE tačno po ugovoru.
 *
 * Svaka zakrpa tvrdi TAČAN broj pojavljivanja (`ocekivano`): ako se prototip promeni, primena
 * pada glasno umesto da tiho promaši. Odstupanja koja drajver ne može da dosegne (D1 traži
 * zastareli handler od 180 ms, D2 klik na zatvoren list, D7 poziv koji UI ne nudi) su ipak
 * zakrpljena — orakl treba da bude verna slika ugovora, ne samo onoga što trenutni drajver gađa.
 *
 * NISU ovde: D11 (nepoznati ključevi) rešava projekcija `normalizuj` u testu pariteta; D9, D10,
 * D13–D17 su UI/sejv ponašanja koja se ne vide u stanju tragova.
 */
import type { Zakrpa } from '../../tests/helpers/prototip'

export const ZAKRPE: readonly Zakrpa[] = [
  {
    // D1: dupli tap na zrelu parcelu — no-op osim ako parcela postoji, ima kulturu i zrela je.
    id: 'D1-uberi',
    nadji: 'function uberi(i, el){\n  const xp = uberiJedan(i);',
    zameni:
      'function uberi(i, el){\n' +
      '  const p0 = S.parcele[i]; if(!p0 || !p0.c || (sad()-p0.t)/1000 < KULTURE[p0.c].vreme) return;\n' +
      '  const xp = uberiJedan(i);',
    ocekivano: 1,
  },
  {
    // D2: dupli tap na seme — odbij van opsega, zauzetu parcelu, zaključanu kulturu, bez novca.
    id: 'D2-posadi',
    nadji: 'if(S.novac<K.seme || izabrana<0) return;',
    zameni:
      'if(S.novac<K.seme || izabrana<0 || izabrana>=S.parcele.length || S.parcele[izabrana].c ||' +
      ' nivoIzXp(S.xp).lvl<K.nivo) return;',
    ocekivano: 1,
  },
  {
    // D3: kapacitet ograničava ZALIHU — z.t = max(z.t, now − kap·I) + n·I.
    id: 'D3-pokupi',
    nadji: 'z.t += n*Z.interval*1000; if(z.t>sad()) z.t = sad();',
    zameni:
      'z.t = Math.max(z.t, sad() - Z.kap*Z.interval*1000) + n*Z.interval*1000;' +
      ' if(z.t>sad()) z.t = sad();',
    ocekivano: 1,
  },
  {
    // D3/D4: zivSpremno se kleše na [0, kap] (sat vraćen unazad → 0, pa pokupi odbija).
    id: 'D4-zivSpremno',
    nadji: 'return Math.min(ZIV[id].kap, Math.floor(((ts||sad())-z.t)/(ZIV[id].interval*1000)));',
    zameni:
      'return Math.max(0, Math.min(ZIV[id].kap,' +
      ' Math.floor(((ts||sad())-z.t)/(ZIV[id].interval*1000))));',
    ocekivano: 1,
  },
  {
    // D4: dugme „Pokupi" je disabled kad n ≤ 0 (tick).
    id: 'D4-dugme',
    nadji: 'if(pEl) pEl.disabled = n===0;',
    zameni: 'if(pEl) pEl.disabled = n<=0;',
    ocekivano: 1,
  },
  {
    // D5: dnevni poklon samo kad datum ide napred ('' je najmanji).
    id: 'D5-poklon',
    nadji: 'if(S.sadio && S.poklonDan !== danas){',
    zameni: 'if(S.sadio && S.poklonDan < danas){',
    ocekivano: 1,
  },
  {
    // D6: reset čuva zvuk i današnji poklon.
    id: 'D6-reset',
    nadji: 'S = POCETNO(); prosliNivo = 1; brojacN = 1;',
    zameni:
      'const m0 = S.mute, p0 = S.poklonDan; S = POCETNO(); S.mute = m0; S.poklonDan = p0;' +
      ' prosliNivo = 1; brojacN = 1;',
    ocekivano: 1,
  },
  {
    // D8: v2 narudžbine sa `ko` — spljošti (sačuvana boja ostaje), msg = prva poruka mušterije
    // istog imena ili '', `ko` se uklanja (01 §h.3: vrednost na vrhu, ako postoji, ima prednost).
    id: 'D8-v2-narudzbine',
    nadji: 'S.narudzbe = Array.isArray(p.narudzbe)?p.narudzbe:[];',
    zameni:
      'S.narudzbe = (Array.isArray(p.narudzbe)?p.narudzbe:[]).map(o=>{ if(!o||!o.ko) return o;' +
      ' const {ko, ...r} = o; const m = MUSTERIJE.find(x=>x.ime===ko.ime);' +
      ' return {...r, ime:r.ime??ko.ime, emoji:r.emoji??ko.emoji, boja:r.boja??ko.boja,' +
      " msg:typeof r.msg==='string'?r.msg:(m?m.poruke[0]:'')}; });",
    ocekivano: 1,
  },
  // D12: jedan `now` po renderu njiva — DOM, „Uberi sve (N)" i potpis iz istog trenutka.
  {
    id: 'D12-zrelihUseva',
    nadji:
      'function zrelihUseva(){ return S.parcele.filter(p=>p.c && (sad()-p.t)/1000>=KULTURE[p.c].vreme).length; }',
    zameni:
      'function zrelihUseva(ts){ const n0=ts||sad();' +
      ' return S.parcele.filter(p=>p.c && (n0-p.t)/1000>=KULTURE[p.c].vreme).length; }',
    ocekivano: 1,
  },
  {
    id: 'D12-potpisNjiva',
    nadji:
      "function potpisNjiva(){\n  return S.parcele.map(p=>{\n    if(!p.c) return 'x';\n" +
      '    const u = (sad()-p.t)/1000/KULTURE[p.c].vreme;',
    zameni:
      'function potpisNjiva(ts){\n  const n0=ts||sad();\n  return S.parcele.map(p=>{\n' +
      "    if(!p.c) return 'x';\n    const u = (n0-p.t)/1000/KULTURE[p.c].vreme;",
    ocekivano: 1,
  },
  {
    id: 'D12-crtajNjive-now',
    nadji: "function crtajNjive(){\n  const w = $('#njive');",
    zameni: "function crtajNjive(){\n  const n0 = sad();\n  const w = $('#njive');",
    ocekivano: 1,
  },
  {
    id: 'D12-crtajNjive-proslo',
    nadji: 'const proslo=(sad()-p.t)/1000, udeo=Math.min(1,proslo/K.vreme);',
    zameni: 'const proslo=(n0-p.t)/1000, udeo=Math.min(1,proslo/K.vreme);',
    ocekivano: 1,
  },
  {
    id: 'D12-crtajNjive-zrelih',
    nadji: 'const zr = zrelihUseva();',
    zameni: 'const zr = zrelihUseva(n0);',
    ocekivano: 1,
  },
  {
    id: 'D12-crtajNjive-potpis',
    nadji: 'potpisPre = potpisNjiva();',
    zameni: 'potpisPre = potpisNjiva(n0);',
    ocekivano: 1,
  },
]

/** Instrumentacija (NIJE odstupanje): svaki `sacuvaj(odmah)` beleži režim u `window.__cuvanja`,
 *  da trag zna da li je korak tražio čuvanje i kojim režimom ('odmah' / 'odlozeno'). */
export const INSTRUMENT_CUVANJE: Zakrpa = {
  id: 'instrument-sacuvaj',
  nadji: 'function sacuvaj(odmah){',
  zameni:
    "function sacuvaj(odmah){ (window.__cuvanja||(window.__cuvanja=[])).push(odmah?'odmah':'odlozeno');",
  ocekivano: 1,
}
