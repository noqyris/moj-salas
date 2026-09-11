# Odluke

Format: **datum** · odluka · razlog · odbačena alternativa. Novije odluke idu na dno svoje sekcije.

## Alati i okruženje

- **2026-09-11** · Vite 7.3 + Vitest 4.1 + TypeScript 5.9 + ESLint 10, iste verzije kao u `duelko` · kombinacija je već proverena na ovoj mašini i u tvojim projektima · odbačeno: najnovije Vite 8 / Vitest 5 / TypeScript 7 (tek izašli; typescript-eslint još ne prati TS 7)
- **2026-09-11** · Node 22 (`.nvmrc`), `engines >= 22.12` · Vite 7 i jsdom traže Node ≥ 22.12; podrazumevani Node u shell-u (21.7) je EOL · odbačeno: ostati na Node 21 uz starije alate
- **2026-09-11** · `package.json` bez `"type": "module"`, konfiguracije kao `.mts`/`.mjs` · `referenca-sim.jsdom.js` je CommonJS i mora i dalje da se pokreće sa `node referenca-sim.jsdom.js` (`npm run test:prototip`), kako CLAUDE.md navodi · odbačeno: preimenovati harness u `.cjs`
- **2026-09-11** · Faza 1 se radi na grani `faza-1`, a `main` ostaje na prototipu dok faza ne bude odobrena · odobrenje faze postaje običan merge · odbačeno: rad direktno na `main`
- **2026-09-11** · Font Baloo 2 je self-hostovan (`@fontsource/baloo-2`, samo woff2, latin + latin-ext, težine 600/700/800 ≈ 105 KB) · igra mora da radi offline u Capacitor aplikaciji, a Google Fonts CDN šalje IP igrača Google-u, što je GDPR problem za DACH lansiranje · odbačeno: Google Fonts `<link>` kao u prototipu; i woff fallback fajlovi (duplirali bi težinu, WebView ih ne treba)
- **2026-09-11** · ESLint „core granica": `src/core` i `src/config` ne smeju da koriste `Date`, `Math.random`, DOM, `navigator`, tajmere, niti da importuju `ui`, `platform`, `art`, `i18n` · CLAUDE.md pravilo 1 (logika testabilna u Node-u), sprovedeno mehanički kao u `duelko` · odbačeno: oslanjati se samo na disciplinu

## Gameplay — odstupanja od prototipa koja je Đorđe odobrio

Svako od ovih je reprodukovano u jsdom-u nad prototipom pre odluke.

- **2026-09-11** · Kapacitet kokošinjca/štale (4 jaja / 3 mleka) ograničava **zalihu**: kad je puno, proizvodnja staje (`z.t = max(z.t, now − kap·interval) + n·interval` pri kupljenju) · u prototipu je kap ograničavao samo jedno „Pokupi", pa je 24 h odsustva davalo 480 jaja i 144 mleka ponovljenim tapovima; CLAUDE.md test 7 kaže „akumulacija poštuje kapacitet" · odbačeno: zadržati neograničenu zalihu
- **2026-09-11** · Dnevni poklon samo kad datum ide **napred** (`poklonDan < danas`), a reset pamti da je današnji poklon uzet · u prototipu je prebacivanje datuma napred-nazad davalo neograničene poklone, a reset je dozvoljavao ponovni poklon istog dana · odbačeno: poklon za svaki datum različit od sačuvanog. Nuspojava: igrač kome je sat bio ispred čeka da stvarni datum sustigne sačuvani
- **2026-09-11** · Reset čuva podešavanje zvuka (`mute`) · „Obriši napredak" briše napredak, a ne podešavanja · odbačeno: reset vraća zvuk na uključen
- **2026-09-11** · Osvežavanje uživo: tick osvežava i strelicu ▲/▼/— na pijaci (ne samo cenu), a otvoren list semena se ponovo gradi posle level-up-a · strelice su posle 5 min bile kontradiktorne ceni u 8 od 9 redova · odbačeno: strelica samo pri punom renderu
- **2026-09-11** · Zaštita od duplog tapa: posle akcije koja uklanja red (prodaja, isporuka, odbijanje narudžbine), posle otvaranja sledeće overlay kartice, otvaranja lista semena i „Uberi sve" ta oblast ignoriše tapove ~300 ms · brz drugi tap je pogađao red koji je iskočio na isto mesto (prodaja susedne robe, odbijanje pogrešne narudžbine, zatvaranje sledeće kartice nepročitane) · odbačeno: globalno zaključavanje unosa (lomi brze legitimne tapove po različitim kontrolama)
- **2026-09-11** · Tekstovi: trajanje sa decimalnim zarezom („1,5 min", ne „1.5 min"); „Dobro došao nazad" navodi svaku završenu mašinu sa njenom ikonicom i porukom (ranije uvek ikonica kazana i „Mašine su završile posao") · odbačeno: prenos 1:1
