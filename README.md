# Moj Salaš

Mobilna farm igra sa srpskim štihom (seme → rast → žetva → prodaja → reinvestiranje). Faza 1 je
TypeScript port prototipa `moja-farma-v3.html` sa **identičnim ponašanjem** — jedina odstupanja su
odstupanja D1–D17 (vidi [Odstupanja od prototipa](#odstupanja-od-prototipa)).

Stack: Vite 7 + TypeScript (strict), vanilla DOM + SVG, Vitest 4, ESLint, Prettier. Jedina runtime
zavisnost je self-hostovan font Baloo 2.

## Pokretanje

```sh
nvm use 22   # Node 22 iz .nvmrc (Vite 7 i jsdom traže ≥ 22.12)
npm ci
npm run dev  # na telefonu u istoj mreži: http://<IP računara>:5173
```

`npm ci` iz lockfile-a radi i sa npm 10 koji dolazi uz Node 22, ali npm 10 puca pri razrešavanju
stabla bez lockfile-a (`Cannot read properties of null (reading 'edgesOut')` na peer skupu vitest-a) —
za nove pakete i osvežavanje lockfile-a koristi `npx -y npm@11 i -D <paket>`.

## Komande

| Komanda                          | Šta radi                                                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `npm run dev`                    | Vite dev server, sluša i na lokalnoj mreži (`server.host: true`) — igra se otvara na telefonu                |
| `npm run build`                  | `tsc --noEmit` + produkcioni build u `dist/` (relativan `base`, spreman za Capacitor)                        |
| `npm run preview`                | servira `dist/` (takođe na mreži)                                                                            |
| `npm test`                       | svi testovi (Vitest)                                                                                         |
| `npm run test:watch`             | Vitest u watch režimu                                                                                        |
| `npm run coverage`               | testovi + pokrivenost `src/core` (prag 80 % za lines, statements, functions i branches)                      |
| `npm run test:prototip`          | originalni `referenca-sim.jsdom.js` nad prototipom (59 provera + fuzz)                                       |
| `npm run parity:gen`             | regeneriše tragove pariteta `tests/fixtures/parity/*.jsonl` iz zakrpljenog prototipa                         |
| `npm run typecheck`              | `tsc --noEmit`                                                                                               |
| `npm run lint`                   | ESLint, uključujući granicu core-a (bez DOM-a, `Date`, `Math.random`, tajmera, importa ui/platform/art/i18n) |
| `npm run format`                 | Prettier `--write`                                                                                           |
| `npm run format:check`           | Prettier `--check`                                                                                           |
| `node tools/readme/generisi.mjs` | osvežava tabelu balansa ispod iz `src/config` (test pada dok README odstupa od config-a)                     |

## Balans

Izvor istine je `src/config`. Sve ispod je generisano iz njega; `tests/dokumentacija/readme.test.ts`
pada čim se config promeni a README ne. Vremena rasta su skraćena za prototip (rebalans je zadatak
Faze 2).

<!-- balans:pocetak (generisano iz src/config — ne menjati ručno) -->

### Kulture

| Kultura   |    Seme |    Rast | Prodaja (bazna) | XP po žetvi | Nivo |
| --------- | ------: | ------: | --------------: | ----------: | ---: |
| Pšenica   |  10 din |    20 s |          18 din |           2 |    1 |
| Šargarepa |  30 din | 1,5 min |          62 din |           5 |    1 |
| Paprika   |  80 din |   5 min |         185 din |          12 |    2 |
| Bundeva   | 200 din |  30 min |         900 din |          40 |    3 |
| Grožđe    | 450 din |     2 h |       2.300 din |         110 |    4 |

### Proizvodi

| Proizvod | Prodaja (bazna) | Odakle                       |
| -------- | --------------: | ---------------------------- |
| Brašno   |         120 din | Mlin (4 × pšenica)           |
| Ajvar    |         780 din | Kazan za ajvar (3 × paprika) |
| Jaja     |          45 din | Kokošinjac                   |
| Mleko    |         260 din | Štala                        |

### Mašine

| Mašina         |    Cena | Nivo | Ulaz → izlaz             | Trajanje ture | XP po turi |
| -------------- | ------: | ---: | ------------------------ | ------------: | ---------: |
| Mlin           | 350 din |    2 | 4 × pšenica → 1 × brašno |       1,5 min |          8 |
| Kazan za ajvar | 600 din |    3 | 3 × paprika → 1 × ajvar  |         4 min |         25 |

### Životinje

| Životinja  |      Cena | Nivo | Proizvod | Jedan komad na | Kapacitet | XP po komadu |
| ---------- | --------: | ---: | -------- | -------------: | --------: | -----------: |
| Kokošinjac |   900 din |    3 | jaja     |          3 min |         4 |            1 |
| Štala      | 2.600 din |    5 | mleko    |         10 min |         3 |            6 |

### Parcele

| Parcela |       Cena |
| ------- | ---------: |
| 3.      |    150 din |
| 4.      |    330 din |
| 5.      |    730 din |
| 6.      |  1.600 din |
| 7.      |  3.510 din |
| 8.      |  7.730 din |
| 9.      | 17.010 din |

### Nivoi

| Nivo | XP do sledećeg | Ukupno XP |   Bonus | Dnevni poklon | Cilj narudžbine | Otključava                          |
| ---: | -------------: | --------: | ------: | ------------: | --------------: | ----------------------------------- |
|    1 |             30 |         0 |       — |        75 din |           41–72 | Pšenica, Šargarepa                  |
|    2 |             57 |        30 |  80 din |       110 din |          98–170 | Paprika, Mlin                       |
|    3 |            108 |        87 | 120 din |       145 din |         163–282 | Bundeva, Kazan za ajvar, Kokošinjac |
|    4 |            206 |       195 | 160 din |       180 din |         233–404 | Grožđe                              |
|    5 |            391 |       401 | 200 din |       215 din |         308–535 | Štala                               |
|    6 |            743 |       792 | 240 din |       250 din |         387–671 | najava aukcije                      |
|    7 |          1.411 |     1.535 | 280 din |       285 din |         470–814 | —                                   |
|    8 |          2.682 |     2.946 | 320 din |       320 din |         555–962 | —                                   |
|    9 |          5.095 |     5.628 | 360 din |       355 din |       643–1.115 | —                                   |
|   10 |          9.681 |    10.723 | 400 din |       390 din |       734–1.271 | —                                   |
|   11 |         18.393 |    20.404 | 440 din |       425 din |       826–1.432 | —                                   |
|   12 |         34.947 |    38.797 | 480 din |       460 din |       921–1.597 | —                                   |
|   13 |         66.399 |    73.744 | 520 din |       495 din |     1.018–1.765 | —                                   |
|   14 |        126.159 |   140.143 | 560 din |       530 din |     1.117–1.936 | —                                   |
|   15 |        239.702 |   266.302 | 600 din |       565 din |     1.218–2.111 | —                                   |
|   16 |        455.434 |   506.004 | 640 din |       600 din |     1.320–2.288 | —                                   |
|   17 |        865.324 |   961.438 | 680 din |       635 din |     1.424–2.468 | —                                   |
|   18 |      1.644.116 | 1.826.762 | 720 din |       670 din |     1.529–2.651 | —                                   |
|   19 |      3.123.821 | 3.470.878 | 760 din |       705 din |     1.636–2.836 | —                                   |
|   20 |      — (maks.) | 6.594.699 | 800 din |       740 din |     1.745–3.024 | —                                   |

### Formule i pravila

- **Start:** 50 din, 2 prazne parcele, najviše 9 parcela.
- **Cena sledeće parcele** (n = trenutni broj parcela): `round(150 · 2.2^(n − 2) / 10) · 10`.
- **XP za nivo l:** `round(30 · 1.9^(l − 1))`, najviše nivo 20; **bonus** za nivo l: `l · 40` din (za svaki pređeni nivo).
- **Dnevni poklon:** `40 + l · 35` din, jednom po kalendarskom danu, posle prve sadnje.
- **Rast:** klica do 35 % vremena, faza 2 do 80 %, zatim faza 3; **zalivanje** jednom po usevu skida 25 % PREOSTALOG vremena.
- **Tržišna cena:** `max(1, round(baza · (1 + 0.15 · sin(t / 600000 ms · 2π + idx · 1.7))))`; ▲ kad je množilac ≥ 1.02, ▼ kad je ≤ 0.98. idx: 0 psenica, 1 sargarepa, 2 paprika, 3 bundeva, 4 grozdje, 5 brasno, 6 ajvar, 7 jaje, 8 mleko.
- **Narudžbine:** uvek 2 aktivne; jedna vrsta robe sa verovatnoćom 0.55, inače 2; pool = otključane kulture koje rastu ≤ 30 min + proizvodi kupljenih zgrada.
- **Cilj narudžbine:** `55 · lvl^1.25 · (0.75 + r · 0.55)`, r ∈ [0, 1); komada po stavci `max(1, min(12, round(cilj / broj stavki / bazna cena)))`.
- **Nagrada narudžbine** (vrednost = zbir baznih cena): `ceil(vrednost · 1.3 / 5) · 5` din i `max(3, ceil(vrednost / 10))` XP.
- **Anti-softlock:** kupovina se odbija ako bi ostalo manje od 10 din (seme: pšenica), a ništa ne raste, ne proizvodi i magacin je prazan.
- **„Dobro došao nazad“:** posle odsustva dužeg od 3 min, ako je nešto sazrelo, završeno ili skupljeno.
- **Sejv:** ključ `moja-farma-v2`, verzija 3 (v2 se migrira); upis 1200 ms posle poslednje promene, najkasnije na 5000 ms tokom neprekidne igre, odmah pri odlasku u pozadinu.

<!-- balans:kraj -->

## Arhitektura

1. `src/config/` — sav balans, formule, ID-jevi, redosledi i sistemske konstante; nula magičnih brojeva van njega.
2. `src/core/` — čista logika bez DOM-a: akcija `(igra, …, now, rng?) → { ok, dogadjaji, cuvaj }` menja stanje i vraća događaje.
3. `src/core/sejv/` — dekoder, lanac migracija (v2 → v3), normalizacija i `SaveController` (debounce + max-wait, rezerva, readOnly).
4. `src/platform/` — adapteri: skladište (host `window.storage` → localStorage), sat, tajmeri, WebAudio, vibracija, dijalog, lifecycle.
5. `src/ui/app.ts` — `createApp(document, platforma)`: boot, jedan tick od 1 s, unos i lifecycle; sve zavisnosti idu kroz platformu.
6. `src/ui/*` — renderer po regionu (njive, zgrade, narudžbe, tezga, radnja, list, overlay kartice) + FX, toast, HUD, D15 zaključavanje.
7. `src/art/` — sav SVG iz prototipa 1:1; `src/i18n/` — svi UI stringovi (srpski, latinica) i formateri.
8. Tok: tap → handler → core akcija sa jednim `now` → događaji redom (zvuk, vibracija, toast, FX, level-up) → render → čuvanje.
9. Rast, mašine i životinje su timestampovi (offline napredak); tick samo osvežava trake i završava ture mašina.
10. Zavisnosti idu samo ka unutra (ui → core → config); granicu core-a čuvaju ESLint i `tests/core/cistoca.test.ts`.

## Testovi

- **Jedinični** — `tests/core` (sve akcije, formule, pogledi), `tests/core/sejv` (dekoder, migracije, zlatni
  fajl, `SaveController`), `tests/platform`, `tests/i18n`, `tests/art`, `tests/ui/osnova` (DOM pomoćnici,
  toast, overlay red, FX, HUD, zaključavanje, skelet).
- **Regresije R1–R8** (CLAUDE.md) — `tests/regresije/`: R1 keš potpisa (`r1-potpis.ui.test.ts`, UI sa
  skokom sata), R2 ID narudžbina, R3 migracija (+ `tests/core/sejv/r3-migracija.test.ts`), R4
  anti-softlock, R6 zalivanje, R7 offline + kapacitet, R8 više nivoa u jednom pozivu (core i UI); R5 je fuzz.
- **Fuzz** — `tests/core/fuzz.test.ts`: 20 seedova × 2000 nasumičnih akcija (i nedozvoljenih) + bogat i
  „posle odsustva“ start, invarijante I1–I14 posle svakog koraka, poseban režim sa satom unazad;
  `tests/ui/fuzz.ui.test.ts`: prava aplikacija, 7 × 400 tapova (svi elementi ili samo dostupni prstu).
- **Proročište pariteta** — prototip sa odstupanjima D1–D17 (`tools/parity/zakrpe.ts`, svaka zakrpa sa
  tačnim brojem pojavljivanja) u jsdom-u: `tests/parity/` poredi config, art, tekstove, skelet, formule
  (`trzisnaCena` na desetinama hiljada trenutaka), narudžbine (isti rng → iste narudžbine) i reprodukuje
  snimljene tragove kroz core (`replay.test.ts`, `tragovi.test.ts` čuva svežinu fikstura).
- **DOM paritet** — `tests/ui/dom-paritet.ui.test.ts`: port i zakrpljen prototip jedan pored drugog, posle
  svakog tapa/ticka isti `#app`, list, kartice, toast, FX čvorovi, stanje, zvuci, vibracije i sejv
  (dublje: `PARITET_SEMENA=12 PARITET_KORAKA=150 npx vitest run tests/ui/dom-paritet.ui.test.ts`).
- **Referenca port** — `tests/ui/referenca.ui.test.ts`: svih 59 provera iz `referenca-sim.jsdom.js` nad
  portom (T1–T5); original i dalje prolazi nad prototipom (`npm run test:prototip`).
- **Fokusirano** — `tests/ui/fokus.ui.test.ts`, `boot`, `akcije`, `tik`: D9, D13–D16, reset, zvuk,
  lifecycle — sve što paritet ne vidi jer ga prototip nema.

## Odstupanja od prototipa

Sve je 1:1 sa prototipom osim odstupanja **D1–D17**: D3, D5, D6 i D14–D16 je odlučio Đorđe, a ostalo su
ispravke defekata reprodukovanih nad prototipom (pad, pokvaren sejv, gubitak napretka). Svako je upisano u
[`DECISIONS.md`](DECISIONS.md), sekcija „Gameplay — odstupanja od prototipa“;
implementacione odluke Faze 1 su u sekciji „Implementacija (Faza 1)“. U testovima pariteta svako
odstupanje je zakrpa prototipa (`tools/parity/zakrpe.ts`, `tests/ui/zakrpe-ui.ts`), pa se port poredi sa
ciljanim ponašanjem, a ne sa listom izuzetaka.
