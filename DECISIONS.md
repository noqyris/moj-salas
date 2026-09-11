# Odluke

Format: **datum** · odluka · razlog · odbačena alternativa. Novije odluke idu na dno svoje sekcije.

## Alati i okruženje

- **2026-09-11** · Vite 7.3 + Vitest 4.1 + TypeScript 5.9 + ESLint 10, iste verzije kao u `duelko` · kombinacija je već proverena na ovoj mašini i u tvojim projektima · odbačeno: najnovije Vite 8 / Vitest 5 / TypeScript 7 (tek izašli; typescript-eslint još ne prati TS 7)
- **2026-09-11** · Node 22 (`.nvmrc`), `engines >= 22.12` · Vite 7 i jsdom traže Node ≥ 22.12; podrazumevani Node u shell-u (21.7) je EOL · odbačeno: ostati na Node 21 uz starije alate
- **2026-09-11** · `package.json` bez `"type": "module"`, konfiguracije kao `.mts`/`.mjs` · `referenca-sim.jsdom.js` je CommonJS i mora i dalje da se pokreće sa `node referenca-sim.jsdom.js` (`npm run test:prototip`), kako CLAUDE.md navodi · odbačeno: preimenovati harness u `.cjs`
- **2026-09-11** · Faza 1 se radi na grani `faza-1`, a `main` ostaje na prototipu dok faza ne bude odobrena · odobrenje faze postaje običan merge · odbačeno: rad direktno na `main`
- **2026-09-11** · Font Baloo 2 je self-hostovan (`@fontsource/baloo-2`, samo woff2, latin + latin-ext, težine 600/700/800 ≈ 105 KB) · igra mora da radi offline u Capacitor aplikaciji, a Google Fonts CDN šalje IP igrača Google-u, što je GDPR problem za DACH lansiranje · odbačeno: Google Fonts `<link>` kao u prototipu; i woff fallback fajlovi (duplirali bi težinu, WebView ih ne treba)
- **2026-09-11** · ESLint „core granica": `src/core` i `src/config` ne smeju da koriste `Date`, `Math.random`, DOM, `navigator`, tajmere, niti da importuju `ui`, `platform`, `art`, `i18n` · CLAUDE.md pravilo 1 (logika testabilna u Node-u), sprovedeno mehanički kao u `duelko` · odbačeno: oslanjati se samo na disciplinu

## Gameplay — odstupanja od prototipa

Svako od ovih je reprodukovano u jsdom-u nad prototipom pre odluke. **D3, D5, D6, D14, D15 i D16 je
odlučio Đorđe** (2026-09-11, izbor između prototipa i ispravke). Ostalo su ispravke defekata koji ne
mogu biti namerni (pad, pokvaren sejv, gubitak napretka, besmislen tekst); najavljene su Đorđu istog dana
i ne menjaju balans.

- **2026-09-11** · Kapacitet kokošinjca/štale (4 jaja / 3 mleka) ograničava **zalihu**: kad je puno, proizvodnja staje (`z.t = max(z.t, now − kap·interval) + n·interval` pri kupljenju) (D3) · u prototipu je kap ograničavao samo jedno „Pokupi", pa je 24 h odsustva davalo 480 jaja i 144 mleka ponovljenim tapovima; CLAUDE.md test 7 kaže „akumulacija poštuje kapacitet" · odbačeno: zadržati neograničenu zalihu
- **2026-09-11** · Dnevni poklon samo kad datum ide **napred** (`poklonDan < danas`), a reset pamti da je današnji poklon uzet (D5) · u prototipu je prebacivanje datuma napred-nazad davalo neograničene poklone, a reset je dozvoljavao ponovni poklon istog dana · odbačeno: poklon za svaki datum različit od sačuvanog. Nuspojava: igrač kome je sat bio ispred čeka da stvarni datum sustigne sačuvani
- **2026-09-11** · Reset čuva podešavanje zvuka (`mute`) (D6) · „Obriši napredak" briše napredak, a ne podešavanja · odbačeno: reset vraća zvuk na uključen
- **2026-09-11** · Osvežavanje uživo: tick osvežava i strelicu ▲/▼/— na pijaci (ne samo cenu), a otvoren list semena se ponovo gradi posle level-up-a (D14) · strelice su posle 5 min bile kontradiktorne ceni u 8 od 9 redova · odbačeno: strelica samo pri punom renderu
- **2026-09-11** · Zaštita od duplog tapa: posle akcije koja uklanja red (prodaja, isporuka, odbijanje narudžbine), posle otvaranja sledeće overlay kartice, otvaranja lista semena i „Uberi sve" ta oblast ignoriše tapove ~300 ms (D15) · brz drugi tap je pogađao red koji je iskočio na isto mesto (prodaja susedne robe, odbijanje pogrešne narudžbine, zatvaranje sledeće kartice nepročitane) · odbačeno: globalno zaključavanje unosa (lomi brze legitimne tapove po različitim kontrolama)
- **2026-09-11** · Tekstovi: trajanje sa decimalnim zarezom („1,5 min", ne „1.5 min"); „Dobro došao nazad" navodi svaku završenu mašinu sa njenom ikonicom i porukom (ranije uvek ikonica kazana i „Mašine su završile posao") (D16) · odbačeno: prenos 1:1
- **2026-09-11** · Dupli tap na zrelu parcelu je no-op: žetva radi samo nad postojećom, zasađenom i zrelom parcelom (D1) · drugi tap u 180 ms pre ponovnog crtanja je pisao `mag["null"]`, duplo brojao žetvu i bacao grešku, posle čega anti-softlock više nije radio · odbačeno: prenos 1:1
- **2026-09-11** · Sadnja se odbija na zauzetoj parceli, van opsega, za zaključanu kulturu i bez novca (D2) · dupli tap na seme je naplaćivao dvaput i ponovo sadio (gubio zalivanje); zaključanu kulturu je čuvao samo `disabled` · odbačeno: provera samo novca
- **2026-09-11** · Sat vraćen unazad: spremnih jaja/mleka je u [0, kap], „Pokupi" odbija i dugme je `disabled` kad nema ničega (D4) · prototip je tada davao negativan magacin, XP i statistiku · odbačeno: prenos 1:1
- **2026-09-11** · Zaštite koje su bile samo u UI-ju prelaze u core: zgrada (već kupljena, nivo), parcela (najviše 9, cenu računa core), mašina (mora biti kupljena) (D7) · pravila igre moraju da važe i bez UI-ja (fuzz, kasnije pijaca među igračima) · odbačeno: oslanjanje na `disabled`
- **2026-09-11** · v2 narudžbine sa `ko:{ime,emoji,boja}` se pri učitavanju spljošte: polja iz `ko` (sačuvana boja ostaje), `msg` = prva poruka mušterije istog imena, inače '' (D8) · prototip ih je crtao kao „undefined" i zahvaljivao „undefined ti zahvaljuje" · odbačeno: odbaciti stare narudžbine
- **2026-09-11** · Učitavanje koje ne uspe ne sme da pregazi sejv: ništa se ne piše pre kraja učitavanja; odbijeno čitanje ili sejv iz novije verzije ⇒ sesija bez čuvanja uz poruku igraču (D9) · prototip je u tim slučajevima prepisivao napredak novom igrom · odbačeno: nova igra preko postojećeg sejva
- **2026-09-11** · Neispravan sadržaj sejva se normalizuje (01 §h.3), a kad god se nešto odbaci, sirovi original ide u ključ `moja-farma-v2.rezerva` pre prvog upisa (D10) · ništa igračevo se ne gubi bez kopije · odbačeno: tiho odbacivanje
- **2026-09-11** · v2 ključevi `kazan`/`kazanT` i nepoznati ključevi se posle migracije izbacuju (D11) · prototip ih je prenosio i zapisivao zauvek · odbačeno: čuvati ih radi pariteta
- **2026-09-11** · Jedan `now` po crtanju njiva: DOM, „Uberi sve (N)" i keš potpisa iz istog trenutka (D12) · prototip je čitao sat više puta, pa je parcela koja sazri između dva čitanja ostajala zaglavljena na 99 % · odbačeno: prenos 1:1
- **2026-09-11** · Sejv tokom neprekidne igre: debounce 1200 ms + najviše 5000 ms čekanja; `pagehide` i `visibilitychange→hidden` pišu odmah (D13) · prototip u neprekidnoj igri nije pisao nikad, a mobilni browseri ubijaju stranicu bez `visibilitychange` · odbačeno: čist debounce
- **2026-09-11** · Podnaslov na tabli je `prototip v<verzija iz package.json>` (D17) · „prototip v0.3" je zastareo čim je verzija porasla · odbačeno: ručno upisana verzija

## Implementacija (Faza 1)

Odluke iz izrade porta koje ugovor i specifikacije nisu propisali. Odobrena odstupanja D1–D17 su u sekciji iznad.

### Sejv i SaveController

- **2026-09-11** · Rezerva originala je pod ključem `moja-farma-v2.rezerva`; glavni ključ ostaje netaknut · srpski sufiks uz postojeći ključ · odbačeno: `.bak` / `.backup`
- **2026-09-11** · Rezerva se piše samo za `neispravan` sejv i za `ok` sa popravkama; čista v2 migracija (kazan → `masine`, `ko` → ime/emoji/boja) je premeštanje, ne gubitak · bez nepotrebnih upisa · odbačeno: rezerva pri svakoj migraciji
- **2026-09-11** · v3 sejv sa `kazan`/`kazanT` na vrhu (kako ga prototip piše posle migracije) daje popravku `odbaceno`, pa rezervu pri prvom učitavanju · v3 ih nigde ne koristi · odbačeno: tiho odbacivanje
- **2026-09-11** · Popravka je zapis `putanja: odbaceno|zamenjeno|ispravljeno`; dopuna ključa koji nedostaje nije popravka · jasan kriterijum za rezervu i dijagnostiku · odbačeno: slobodan tekst ili bez evidencije
- **2026-09-11** · Ako upis rezerve ne uspe: `greskaSkladista` i sesija bez čuvanja · bez rezerve bi prvi upis uništio original · odbačeno: nastaviti i pregaziti
- **2026-09-11** · `novac`/`xp`: konačan broj se prenosi kakav jeste; `mag`/`stat`: `floor`, negativno ili ne-broj → 0 · 01 §h.3 doslovno · odbačeno: normalizovati i novac
- **2026-09-11** · −0 → 0; beskonačnost nikad ne ulazi u stanje; `v: 1e999` je `neispravan('verzija')`, ne `buduci` · JSON to dozvoljava, stanje ne sme · odbačeno: `buduci` za svaki v > 3
- **2026-09-11** · ID narudžbine: string samih cifara → broj; samo bezbedan ceo broj ≥ 1; kasniji duplikat se odbacuje · `brojacN++` posle učitavanja uvek daje nov ID · odbačeno: prihvatiti svaki broj
- **2026-09-11** · v3 narudžbina bez `msg` dobija prvu poruku mušterije bez popravke; polja na vrhu imaju prednost nad `ko`, različit `ko` se prijavljuje; boja ostaje iz sejva · D8 važi i za v3 · odbačeno: odbaciti narudžbinu
- **2026-09-11** · Kupljena životinja sa `t ≤ 0` dobija `t = now`; nekupljena zgrada sa `t ≠ 0` dobija 0 (obe su popravke) · 01 G7/G8: inače pun kapacitet pri svakom „Pokupi" ili večni `nestoRaste()` · odbačeno: paritet sa prototipom
- **2026-09-11** · `pokreniMigracije` baca za verziju bez koraka; dekoder proverava verziju pre poziva, pa sam nikad ne baca · greška lanca migracija je bag, ne ulaz · odbačeno: tihi fallback
- **2026-09-11** · Max-wait se meri od početka niza zahteva (razmak < 1200 ms) ili od poslednjeg upisa dok niz traje · usamljen zahtev ima pun debounce, neprekidna igra upis na ≤ 5 s · odbačeno: „5 s od poslednjeg upisa" doslovno (usamljen zahtev bi pisao odmah)
- **2026-09-11** · Kontroler piše tek kad je `ucitaj()` završeno I pozvan `spreman()` · D9 važi i uz pogrešan redosled poziva u UI-ju · odbačeno: samo `spreman()`
- **2026-09-11** · Sat vraćen unazad ili odloženi upis koji je već zakasnio (uspavan uređaj, prigušen tab) ⇒ upis odmah · rokovi su na zidnom satu · odbačeno: ignorisati promenu sata
- **2026-09-11** · Skok sata napred odmah posle trenutnog upisa počinje nov niz, pa sledeći upis može stići do ~6 s posle prethodnog · razmak ostaje ograničen · odbačeno: monotoni sat u kontroleru (novi port samo zbog ovoga)
- **2026-09-11** · Kontroler ne pamti ID tajmera koji je sinhroni raspoređivač već izvršio · referenca-sim režim (`cb(); return 0`) · odbačeno: pretpostaviti asinhroni `setTimeout`
- **2026-09-11** · Stanje se čita kroz getter i serijalizuje u trenutku upisa; `videno` se pečatira pri zahtevu · reset menja objekat stanja; 01 §d · odbačeno: snimak pri zahtevu
- **2026-09-11** · `igraIzStanja` deli objekat stanja sa dekoderom (bez kopije) · jedan kontejner stanja · odbačeno: kopija

### Platforma

- **2026-09-11** · Host `window.storage` ima prednost nad localStorage · kontinuitet sa sejvovima test-igrača iz okruženja prototipa (01 OQ1) · odbačeno: uvek localStorage
- **2026-09-11** · Host skladište: svako odbijanje `get` znači „nema ključa" (`null`) · host baca i za nepostojeći ključ, pa novi igrač inače nikad ne bi bio sačuvan · odbačeno: odbijanje kao kvar
- **2026-09-11** · localStorage: `getItem` koji baca → `get` odbija (kvar, D9); `set` upisuje sinhrono u pozivu · upis iz `pagehide` stiže pre zamrzavanja stranice · odbačeno: asinhroni upis
- **2026-09-11** · localStorage se proba ključem `moj-salas.proba` (upiši/obriši); SecurityError ili kvota → igra bez čuvanja · privatni režimi browsera · odbačeno: pristup bez probe
- **2026-09-11** · `onHidden` sluša i `visibilitychange→hidden` i `pagehide`; dupli trenutni upis je bezopasan · mobilni browseri ubijaju stranicu bez `visibilitychange` · odbačeno: samo `visibilitychange`
- **2026-09-11** · `DialogPort.confirm` vraća Promise; `window.confirm` se zove sinhrono u gestu; izuzetak i odbijanje = „ne" · Capacitor dijalog je asinhron; dijalog ne sme da obori igru · odbačeno: sinhroni boolean
- **2026-09-11** · Vibracija: kopija niza pre `vibrate`, ne zavisi od zvuka, izuzeci se gutaju · 1:1 prototip · odbačeno: vezati za `mute`
- **2026-09-11** · AudioContext nastaje lenjo pri prvom zvuku; dok je `suspended`, svako puštanje zove `resume()`; `webkitAudioContext` rezerva; `mute` proverava UI u trenutku puštanja (i za odloženi „novac") · 1:1 prototip · odbačeno: kontekst pri startu
- **2026-09-11** · Dva toka nasumičnosti: `random` (narudžbine) i `fxRandom` (efekti) · efekti ne smeju da pomere narudžbine (paritet) · odbačeno: jedan `Math.random`

### Core, config, i18n i art

- **2026-09-11** · Odbijena akcija vraća zajednički zamrznut `ODBIJENO`; zalivanje zalivene parcele je `ok:false` sa [zvuk tap, poruka „Već je zaliveno"] · ugovor §4 · odbačeno: izuzeci
- **2026-09-11** · `novaNarudzba` baca `RangeError` kad rng vrati vrednost van [0, 1) · jasna greška umesto tihog `undefined` · odbačeno: kleštanje indeksa
- **2026-09-11** · Prototipova linija `if (z.t > now) z.t = now` iz „Pokupi" je izostavljena · uz D3 je dokazivo mrtva · odbačeno: `v8 ignore`
- **2026-09-11** · Udeo rasta parcele se ne kleše odozdo (negativan kad je sat vraćen) · 1:1 prototip · odbačeno: kleštanje na 0
- **2026-09-11** · Konstante koje core nosi u događajima (obrasci vibracije, najviše 6 novčića, prag „Uberi sve" = 2) su u `src/config/prikaz.ts`, jedna definicija za core i ui; `NARUDZBINA_MAX_VRSTA = 2` je u `balans.ts`; test pariteta ih traži u telima prototipovih funkcija · CLAUDE.md „nula magičnih brojeva van config-a", a 6 je bio definisan dvaput (core i ui/fx) · odbačeno: literali po modulima; ime `config/ui.ts` (ESLint granica core-a zabranjuje `**/ui`)
- **2026-09-11** · Preostali literali u core/ui su namerni: `* 1000` / `/ 1000` (s ↔ ms), `* 100` (procenti), 2 | 3 (verzije sejva, faze biljke), mulberry32 konstante, komparator `rng() - 0.5` (02 §1.7), vizuelne FX konstante i CSS u `ui/fx.ts` i šablonima (02 §1.9) · jedinice, šema i izgled nisu balans · odbačeno: imenovati i jedinice
- **2026-09-11** · Konstante formula iz `balans.ts` su izvezene (aditivno) · README generator ispisuje stvarne vrednosti iz config-a · odbačeno: ponavljati brojeve u generatoru
- **2026-09-11** · `sr.ts` sadrži samo tekst; parametrizovani stringovi primaju sirove vrednosti; nijedan string nema `<`, `>`, `&` · bezbedan `innerHTML` i budući `en: Poruke` · odbačeno: HTML u katalogu
- **2026-09-11** · D9 poruke: „Napredak ne može da se učita — igra se ovaj put neće čuvati." i „Napredak je iz novije verzije igre — igra se ovaj put neće čuvati." · igrač mora da zna da se ne čuva · odbačeno: bez poruke
- **2026-09-11** · `trajanjeTxt` (i D16 zakrpa orakla) ide kroz `toLocaleString('sr-RS')`: decimalni zarez, najviše 3 decimale · ugovor §7; nijedna config vrednost ne dostiže razliku · odbačeno: ručna zamena tačke zarezom
- **2026-09-11** · Statički SVG iz HTML-a prototipa je u `art/staticki.ts`; skelet stranice je bajt-identičan prototipu osim D17 · CLAUDE.md „sav SVG u art/" · odbačeno: SVG u skeletu
- **2026-09-11** · Verzija za D17 stiže iz `package.json` kroz Vite `define` (`__APP_VERSION__`) · jedan izvor verzije · odbačeno: ručno upisana verzija
- **2026-09-11** · `index.html` sadrži samo `<head>` prototipa bez Google Fonts-a; naslov je jedini UI tekst van i18n i test ga drži jednakim `t.naslov` i prototipu · naslov mora postojati pre JS-a; fontovi su self-hostovani · odbačeno: `document.title` iz JS-a; CDN link iz 04 §1.1

### UI

- **2026-09-11** · `$` baca kad element ne postoji; koren (Document) se uvek prosleđuje, nema globalnog `document`-a · rana greška, izolovani testovi i instance · odbačeno: prototipov `null`
- **2026-09-11** · Rendereri su fabrike sa zatvorenim stanjem (keš potpisa, izabrana parcela) i dele zajednički `Ui` kontekst (`ui/kontekst.ts`) preko getter-a · samo `crtajNjive` može da piše keš potpisa (pravilo 5), svaka `createApp` instanca je izolovana · odbačeno: funkcije sa deljenim promenljivim stanjem
- **2026-09-11** · D15 zaključavanje je po imenu oblasti (ne po DOM pretku), kraj = `perfNow` + 300 ms, ponovni poziv produžava; postavlja se samo kad akcija uspe; overlay zaključava OK pri svakoj novoj kartici · pokriva i handler odvojenog elementa, odbijena akcija ne pomera redove · odbačeno: globalna brava; zaključavanje posle svakog tapa
- **2026-09-11** · `#novac` se piše samo iz rAF okvira i broji od prikazane vrednosti (start 0), reset je ne nuluje; level-up broji do konačnog iznosa jer core dodaje sve bonuse odmah · 1:1 prototip (B6 nije odobreno) · odbačeno: sinhroni upis; rekonstrukcija međuiznosa po nivou
- **2026-09-11** · Toast: poslednji pobeđuje, skriva se samo uklanjanjem klase `vidljiv` (tekst ostaje) · referenca-sim čita tekst posle isteka · odbačeno: brisanje teksta
- **2026-09-11** · FX troše `fxRandom` tačno kao prototip (novčić 2, kap 2, konfeta 3 izvlačenja); vizuelne FX konstante su u `ui/fx.ts` · 02 §1.9 · odbačeno: FX konstante u config-u
- **2026-09-11** · `izabrana` se poništava samo pri resetu (ugovor §6), ne posle sadnje ni zatvaranja lista · 1:1 prototip; dupli tap na seme ionako odbija D2 · odbačeno: `izabrana = -1` posle sadnje (04 B2)
- **2026-09-11** · Boot: `SaveController` nastaje na početku `boot()` (tada se čita `p.storage`); poruka o sesiji bez čuvanja ide POSLE pozdrava i zavisi od uzroka · zavisnosti se razrešavaju u trenutku poziva; upozorenje je važnije od pozdrava (toast: poslednji pobeđuje) · odbačeno: kontroler u `createApp`; poruka pre pozdrava
- **2026-09-11** · Tick prvo izvrši događaje svih završenih mašina, pa osveži odbrojavanje onih koje rade · core vraća sve događaje odjednom; prototipov redosled po mašini nije uočljiv · odbačeno: poziv core-a po mašini
- **2026-09-11** · D14: oznaka trenda se u ticku menja preko `outerHTML` istog šablona, samo kad se promeni; list semena se na kraju `crtajSve` gradi ponovo bez novog zaključavanja i bez promene izabrane parcele · DOM ostaje isti kao posle punog crtanja; to nije otvaranje lista · odbačeno: posebno menjanje klase/stila/teksta; ponovni `otvoriList`
- **2026-09-11** · Handleri hvataju ID iz petlje crtanja; samo dugmad narudžbina čitaju `Number(dataset…)` u trenutku klika · 1:1 prototip i tipska bezbednost · odbačeno: delegacija događaja
- **2026-09-11** · Prebacivanje zvuka zadržava redosled prototipa: natpis → čuvanje → „tap" · 1:1 L1158–1161 · odbačeno: opšti redosled događaji → crtanje → čuvanje

### Testovi i paritet

- **2026-09-11** · Testovi rade u zoni Europe/Belgrade sa T0 = 15. 1. 2026. 10:00; skriptovani rng `niz()` baca kad se iscrpi · determinizam dana i broja izvlačenja · odbačeno: stvarno vreme
- **2026-09-11** · Čistoća core-a se proverava i pod `npm test`: prevod `src/core` + `src/config` bez DOM/Node tipova i AST zabrana `Date` / `Math.random` / importa ui-platform-art-i18n (`tests/core/cistoca.test.ts`) · ESLint se ne pokreće u `npm test` · odbačeno: samo ESLint; `tsconfig.core.json` (novi config fajl)
- **2026-09-11** · Core fuzz: 20 seedova × 2000 koraka + bogat i „posle odsustva" start; režim sa satom unazad (2 % koraka do 10 min); I13 kroz `kodirajSejv`/`dekodirajSejv` bez popravki · 07 §c · odbačeno: krug kroz JSON.parse
- **2026-09-11** · Orakl pariteta = prototip + zakrpe odobrenih odstupanja (`tools/parity/zakrpe.ts`, UI deo u `tests/ui/zakrpe-ui.ts`) + instrumentacija narudžbina, čuvanja, zvuka i vibracije; svaka zakrpa tvrdi tačan broj pojavljivanja · port se poredi sa odobrenim ponašanjem · odbačeno: nezakrpljen prototip + lista izuzetaka; regex maskiranje DOM-a
- **2026-09-11** · Tragovi: 8 seedova × {nov, bogat} × 200 koraka + 12 skriptovanih; jsonl sa razlikom po redu i sha256 otiskom orakla u zaglavlju; `parity:gen` pokreće TS generator preko Vite `runnerImport` · male, proverljive fiksture bez novih paketa · odbačeno: pun S po redu; tsx / ts-node
- **2026-09-11** · Paritet narudžbina koristi originalni prototip (samo instrumentacija); paritet `trzisnaCena` uključuje analitičke rubne trenutke (baza·m = j + 0.5, m = 1.02 / 0.98) · nijedno odstupanje ne dira narudžbine; samo na granicama preuređena formula menja cenu · odbačeno: samo mreža i nasumični uzorci
- **2026-09-11** · DOM paritet poredi `#app`, list, kartice, toast, FX čvorove (sa stilovima iz `fxRandom`), stanje, zvuke, vibracije i sejv; jedina projekcija je D11 · hvata i redosled izvlačenja i FX tajmere · odbačeno: samo `#app`
- **2026-09-11** · DOM paritet u dva režima tajmera: „odmah" (sejv se poredi posle svakog koraka) i „red" (sejv tek posle smirivanja ≥ 1300 ms, jer D13 menja samo trenutak upisa); pre svakog tapa ≥ 350 ms na obe strane (D15), osim duplog tapa od 60 ms na seme ili zrelu parcelu (D1/D2) · „red" otkriva prozore 180/480/700/800/900/2300/3200 ms · odbačeno: jedan režim
- **2026-09-11** · Nasumični hod pariteta: tap 70 %, tick 12 %, dugo čekanje 9 %, skok sata 3 % (15 % unazad), smirivanje 6 %; vreme ide PRE izbora mete; dostupni tapovi se računaju na oba dokumenta i moraju biti isti · odloženo crtanje menja šta je na ekranu · odbačeno: meta pre pomaka vremena
- **2026-09-11** · Budžet u `npm test`: 5 startova (nov, bogat sa zvukom, v2, 3 h odsustva sa obe mašine, sat unazad) × 3 seeda × 45 koraka + 7 skriptovanih × 2 režima (~10 s); dublje preko `PARITET_SEMENA`/`PARITET_KORAKA` · testovi ostaju brzi · odbačeno: fiksni veliki budžet
- **2026-09-11** · UI fuzz: 7 × 400 akcija (svi elementi / samo dostupni prstu, oba režima tajmera, bogat start), nasumična pauza 0–1300 ms pre tapa, invarijante HUD-a i XP trake · ~12 s, pogađa i otpušta D15 · odbačeno: 12 prolaza (~20 s)
- **2026-09-11** · `mountApp` ima dve ose vremena: sat igre (`skok`) i `perfNow` (`pauza`, u režimu „red" izvršava i dospele tajmere); `zatvoriOverlaye` pauzira 300 ms pre svakog OK · kao referenca-sim (virtuelan je samo `Date`) + D15 · odbačeno: jedna osa
- **2026-09-11** · Pomoćnik prototipa: `tajmeri(ms)` postavlja sat tajmera na rok svakog tajmera pre izvršavanja; putanja do HTML-a ide preko `fileURLToPath(import.meta.url)` · tajmer zakazan iz tajmera je kasnio za ceo prozor; `new URL(…, import.meta.url)` Vite prepisuje u jsdom okruženju · odbačeno: korak od 1 ms u testu pariteta
- **2026-09-11** · Referenca port seeduje sve tokove; fuzz iz TEST 5 pauzira 300 ms pre svake akcije i traži da je bilo žetve, prodaje i isporuke · prototip nema D15; bez pauze zaključana oblast guta tapove (seed 5: 0 isporuka) · odbačeno: fuzz bez pauze
- **2026-09-11** · Zvuk se testira pravim `createAudio` nad brojećim AudioContext-om; reset test koristi `sadio:false` i `poklonDan '2026-01-10'`; D13 se proverava i kroz UI (`videno` iz svakog upisa, razmaci ≤ 5 s) · dokazuje lenji kontekst, „zadržano" ≠ „danas" i ožičenje kontrolera · odbačeno: brojanje samo poziva lažnog porta
- **2026-09-11** · README tabela balansa se generiše iz config-a (`node tools/readme/generisi.mjs`); test poredi README sa generatorom, nezavisno parsira tabele i izračunava formule iz README-a · README ne sme da zastari ni kad se promeni oblik formule · odbačeno: ručna tabela; nova npm skripta
