# CLAUDE.md — Projekat „Moj Salaš"

> Ovaj fajl je jedini izvor konteksta koji ti treba. Pročitaj ga celog, zatim pročitaj ceo `moja-farma-v3.html`, pa tek onda piši kod.

## Ko je klijent i kako radimo

Radiš za Đorđa — solo indie developera mobilnih igara za balkansko tržište. Komunikacija je na srpskom, kratka i direktivna („nastavi", „popravi", „napravi bolje"). Očekuje se da:

- **donosiš odluke samostalno** — ne zapitkuj usred zadatka; ako doneseš nedokumentovanu odluku, upiši je u `DECISIONS.md` (format: datum · odluka · razlog · odbačena alternativa)
- **isporučuješ kompletne artefakte** — kod koji radi, testovi koji prolaze, ne skice
- radiš **fazu po fazu** i **staneš posle svake faze** za pregled i odobrenje

## Šta je projekat

**„Moj Salaš"** — mobilna farm igra (idle/tycoon petlja: seme → rast → žetva → prodaja → reinvestiranje) sa srpskim štihom: ajvar, kazan, salaš, domaće mušterije. Ciljna platforma Android/iOS preko web tehnologija. Ciljno tržište: Balkan + dijaspora (detalji u odeljku „Tržišna strategija"). Dugoročna vizija: single-player jezgro → asinhrona pijaca među igračima → (mnogo kasnije) aukcija.

### Ime i brend

- Ime igre je **„Moj Salaš"** (sa š u display imenu). Provereno je da na App Store i Google Play ne postoji igra tog imena; generičko „Farma" je izbegnuto namerno — prostor je zakrčen klonovima, a „Farma" je u regionu i veliki rijaliti TV brend.
- Za ASO koristi podnaslov tipa „farma igra" da pretraga „farma" i dalje pronalazi aplikaciju.
- Bundle ID predloži u Fazi 3 (npr. `rs.mojsalas.igra`) i upiši u `DECISIONS.md`.
- U prototipu je natpis na tabli već „Moj Salaš". Reč „farma/salaš" kao pojam u gameplay tekstovima je slobodna — brend je uvek „Moj Salaš".

### Tržišna strategija (odlučeno)

Igra se pravi za **Balkan + dijasporu**, ne za globalno tržište. Razlozi: globalni farm žanr je zakrčen (Hay Day/Township klasa sa UA budžetima nedostižnim solo developeru), a jedini pravi diferencijator ove igre je lokalni štih (ajvar, kazan, salaš, domaće mušterije) — koji radi samo regionalno. Dijaspora u DACH regionu je monetizacioni sloj: zapadni eCPM na rewarded ads, jak nostalgični okidač, i traži igru baš na srpskom.

**Redosled lansiranja:**
1. **Soft launch:** Bosna i Hercegovina, Crna Gora, Severna Makedonija — jeftino testiranje retencije i ekonomije
2. **Glavno lansiranje:** Srbija + Hrvatska
3. **Dijaspora:** DACH storefront-ovi (Nemačka, Austrija, Švajcarska) — ista aplikacija, srpski jezik, bez prevoda

**Posledice po razvoj:**
- Store ime je lokalizovano po storefront-u: „Moj Salaš" u regionu i DACH; englesko ime (npr. „Salaš: Balkan Farm") rezervisano za eventualnu kasniju globalnu ekspanziju — zato `i18n/` modul postoji od Faze 1 iako je jezik samo srpski
- UI ostaje isključivo srpski (latinica); engleski se NE dodaje dok globalna ekspanzija ne bude eksplicitno odobrena
- U Fazi 3 predvidi lokalizovane store listinge po redosledu iznad; odluke upiši u `DECISIONS.md`
- Monetizacija (kasnija faza, ne implementirati bez naloga): rewarded ads + kozmetika; **nikad paywall na core gameplay**

## Šta postoji u repou

| Fajl | Šta je |
|---|---|
| `moja-farma-v3.html` | **Izvor istine.** Kompletan, testiran prototip u jednom fajlu: sav gameplay, balans, SVG grafika, UI tekstovi, zvuk, perzistencija. |
| `referenca-sim.jsdom.js` | Referentni regresioni testovi iz prototip faze (jsdom harness, 59 provera + fuzz). **Specifikacija ponašanja** — prevedi ih u vitest u Fazi 1. Pokretanje: `npm i jsdom` pa `node referenca-sim.jsdom.js` iz root-a. |
| `CLAUDE.md` | Ovaj fajl. |

Prototip već sadrži: 5 kultura sa 3 vizuelne faze rasta (ručno crtani SVG), zalivanje (-25 % vremena, jednom po usevu), 2 mašine (mlin: 4 pšenice → brašno; kazan: 3 paprike → ajvar), 2 životinje sa pasivnom proizvodnjom (kokošinjac → jaja, štala → mleko), XP/nivoe sa otključavanjima i novčanim bonusom, tablu za narudžbine (uvek 2 aktivne, NPC mušterije sa porukama, nagrada ~30 % iznad tržišta), pijacu sa cenama koje osciliraju ±15 %, kupovinu parcela (do 9), dnevni poklon, „dobro došao nazad" ekran, statistiku, zvuk (WebAudio sinteza), vibracije, offline rast preko timestamp-ova i migraciju sejva v2→v3.

Sav UI tekst je na srpskom (latinica) i tako ostaje.

---

## FAZA 1 — od prototipa do prave kodne baze (počni odmah)

Pretvori prototip u strukturiran TypeScript projekat sa **identičnim ponašanjem** (feature parity), spreman za dalji razvoj i pakovanje u mobilnu aplikaciju.

### Stack (odlučeno — ne menjaj bez jakog razloga; odstupanja u DECISIONS.md)

- **Vite + TypeScript (strict)**, vanilla DOM + SVG — bez React/frameworka; prototip dokazuje da nije potreban
- **vitest** za testove logike
- Kasnije Capacitor (Android prvo) — zato **sve browser API-je (storage, audio, vibracije) izoluj iza adaptera**
- Minimalne zavisnosti; ciljna veličina bundle-a < 300 KB

### Struktura projekta

```
src/
  config/      # SAV balans: kulture, proizvodi, mašine, životinje, XP kriva,
               # cene parcela, mušterije, formule nagrada — nula magičnih brojeva van ovoga
  core/        # čista logika BEZ DOM-a: state, save/load + migracije, economy
               # (tržišne cene), xp, fields, orders, machines, animals, dailyGift, offline
  platform/    # adapteri: storage (localStorage sada, Capacitor Preferences kasnije),
               # audio (WebAudio), haptics (navigator.vibrate)
  ui/          # tabovi (farma, narudžbine, pijaca, radnja), scena (nebo/brda/ambar),
               # fx (leteći novčići, konfete, kapi, +XP), overlay red, toast, donji list
  art/         # sav SVG iz prototipa kao TS konstante/funkcije, prenet 1:1
  i18n/        # svi UI stringovi na jednom mestu (srpski default)
  main.ts
tests/
index.html
```

### Pravila

1. `core/` ne sme da importuje ništa iz DOM-a — sva logika mora biti testabilna u Node-u.
2. State ima polje `v` i lanac migracija. Učitaj i v2 i v3 sejv iz prototipa (storage ključ `moja-farma-v2` — **ne menjaj ključ**, čuva napredak postojećih test-igrača) bez gubitka podataka.
3. Rast, mašine i životinje rade preko **timestamp-ova** (offline napredak), nikad preko akumuliranih tajmera.
4. TypeScript strict, bez `any`. ESLint + Prettier.
5. Render kao u prototipu: pun render na akciju, tick od 1 s samo ažurira trake/brojače; **kad se stanje strukturno promeni, keš potpisa se osvežava u render funkciji** (vidi regresioni test 1).

### Obavezni testovi — regresije stvarnih bagova iz razvoja prototipa

1. **Keš potpisa parcela:** posadi → uberi → posadi istu kombinaciju — druga tura MORA preći u „zrelo" stanje i biti uberiva. (Bag: tick je keširao potpis stanja, render van tick-a ga nije osvežavao, pa su biljke zauvek glavile na 100 %.)
2. **ID narudžbina:** posle učitavanja sejva brojač nastavlja od `max(id)+1`; isporuka pogađa tačno tu narudžbinu. (Bag: brojač je kretao od 1 posle reload-a → kolizija ID-jeva.)
3. **Migracija v2→v3:** `kazan`/`kazanT` prelaze u `masine.kazan`, nova polja magacina se dopunjuju nulama, parcele dobijaju `z` (zaliveno) flag.
4. **Anti-softlock:** sa tačno cenom zgrade u džepu, praznim magacinom i ničim što raste/proizvodi — kupovina se odbija (mora ostati bar za seme pšenice).
5. **Invarijante (fuzz 1000+ nasumičnih akcija):** novac i magacin nikad negativni, parcela ≤ 9, uvek tačno 2 narudžbine.
6. **Zalivanje:** jednom po usevu, skraćuje 25 % preostalog vremena, ne ide ispod nule.
7. **Offline:** usevi sazreli tokom odsustva se prepoznaju za „dobro došao nazad"; akumulacija jaja/mleka poštuje kapacitet.
8. **XP:** jedan poziv koji preskoči više nivoa otvara sve level-up overlaye redom, sa bonusom za svaki nivo.

`referenca-sim.jsdom.js` već pokriva većinu ovih scenarija nad prototipom — koristi ga kao specifikaciju dok pišeš vitest verzije nad novim `core/` modulima.

### Definicija završene Faze 1

- `npm run dev` radi i na telefonu preko lokalne mreže; ponašanje identično prototipu
- `npm test` zeleno; pokrivenost `core/` ≥ 80 %
- `npm run build` prolazi bez grešaka i upozorenja
- README: setup, komande, tabela balansa, arhitektura u 10 redova
- **Stani i sačekaj odobrenje.**

---

## FAZA 2 — sadržaj i poliranje (posle odobrenja)

- 2–3 nove kulture (npr. paradajz nivo 2, suncokret nivo 5) i **turšija** kao treća prerada — brojke predloži sam, u duhu postojeće krive (brže kulture = veći profit po minutu; svaka nova kultura u `config/` + testovi)
- Dostignuća (npr. „prvih 100 žetvi", „10 isporuka Baka Miri") sa malom nagradom
- Podešavanja: zvuk po kategorijama, reset, priprema za više jezika
- PWA manifest + ikonica + splash (ikonica: drvena tabla „Moj Salaš" u stilu postojeće scene)

## FAZA 3 — mobilno pakovanje

- Capacitor Android build; storage adapter na Preferences; haptics plugin; hardversko back dugme; safe-area; test na pravom uređaju; bundle ID u `DECISIONS.md`; lokalizovani store listinzi po redosledu iz „Tržišne strategije" (soft launch BiH/CG/MK → RS+HR → DACH)

## FAZA 4 — asinhrona pijaca među igračima (prvo dizajn dokument, pa implementacija)

- Hay Day model: igrač izlaže robu na svojoj tezgi, drugi kupuju kroz „novine" — asinhrono, bez real-time zahteva
- Predlog backenda: Supabase (anonimni auth, tabele `listings`/`transactions`, RLS), server-side validacija cena sa min/max granicama po artiklu
- Pre implementacije: **simulacija ekonomije** — skripta koja simulira 1000 igrača kroz 30 dana i proverava inflaciju/deflaciju
- Real-time aukcija tek posle stabilne baze igrača (pouka iz Diablo 3 aukcijske kuće)

---

## Način rada

- Mali, jasni komiti (conventional commits); testovi idu uz feature u istom komitu
- Kad menjaš balans: `config/` + testovi + tabela u README u istom komitu
- Nedokumentovane odluke → `DECISIONS.md`
- Ako ti nešto u prototipu deluje kao greška ili nelogičnost — **prvo pitaj**, možda je namerna dizajnerska odluka
- Komentari u kodu srpski ili engleski; UI stringovi isključivo srpski (latinica)

---

## Prilog — trenutni balans (brza referenca; izvor istine je prototip)

**Kulture** (seme / vreme / prodaja / XP / nivo):
pšenica 10 din / 20 s / 18 / 2 XP / nv. 1 · šargarepa 30 / 90 s / 62 / 5 / nv. 1 · paprika 80 / 5 min / 185 / 12 / nv. 2 · bundeva 200 / 30 min / 900 / 40 / nv. 3 · grožđe 450 / 2 h / 2300 / 110 / nv. 4
(Vremena su skraćena za prototip — rebalans pre produkcije, kao zadatak u Fazi 2.)

**Proizvodi** (bazna prodaja): brašno 120 · ajvar 780 · jaja 45 · mleko 260

**Mašine:** mlin 350 din, nv. 2, 4 pšenice → 1 brašno za 90 s, +8 XP · kazan 600 din, nv. 3, 3 paprike → 1 ajvar za 4 min, +25 XP

**Životinje:** kokošinjac 900 din, nv. 3, 1 jaje / 3 min, kapacitet 4, +1 XP po jajetu · štala 2600 din, nv. 5, 1 mleko / 10 min, kapacitet 3, +6 XP

**Formule:**
- Cena n-te parcele: `round(150 · 2.2^(n−2) / 10) · 10`, maks. 9 parcela
- XP za nivo l: `round(30 · 1.9^(l−1))`; bonus na level-up: `l · 40` din
- Tržišna cena: `baza · (1 + 0.15 · sin(t/600s · 2π + idx·1.7))` — period 10 min
- Narudžbina: ciljna vrednost `55 · lvl^1.25 · (0.75–1.3)`, 1–2 artikla iz otključanog pool-a (kulture ≤ 30 min rasta + proizvodi ako postoji zgrada), nagrada `ceil(vrednost·1.3/5)·5` din + `ceil(vrednost/10)` XP, uvek tačno 2 aktivne
- Dnevni poklon: `40 + lvl · 35` din, jednom po kalendarskom danu
- Zalivanje: jednom po usevu, `preostalo − 25 %`
