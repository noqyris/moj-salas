/*
 * Svi UI stringovi igre — srpski, latinica. Tekst je doslovno iz prototipa (moja-farma-v3.html);
 * tests/parity/tekst.test.ts ga poredi sa živim prototipom. Namerne razlike: D16 (trajanjeTxt sa
 * decimalnim zarezom; „Dobro došao nazad" navodi svaku završenu mašinu) i D17 (podnaslov nosi
 * verziju iz package.json), plus nove poruke za D9 (sejv koji ne može da se učita).
 *
 * Pravila:
 * - Ovde je samo TEKST. Markap oko njega (tagovi, klase, inline stilovi, SVG) pravi ui/. Gde prototip
 *   seče rečenicu markapom (npr. „Nagrada: <b>+80 din</b>"), svaki deo je zaseban ključ.
 * - Parametrizovani stringovi su funkcije. Primaju SIROVE vrednosti (brojeve, ID-jeve) i formatiraju
 *   ih tačno kao prototip (05 §3.13): novac kroz `fmt`, komadi/XP/nivoi sirovo, nazivi iz kataloga
 *   na dnu fajla (sa `.toLowerCase()` tamo gde ga prototip ima).
 * - Nijedan string ne sadrži `<`, `>` ni `&` (05 §1.4), pa je umetanje kroz innerHTML bezbedno.
 * - Tačni znakovi: — (U+2014), „ “ (U+201E/U+201C), × (U+00D7), · (U+00B7), → (U+2192), ＋ (U+FF0B)…
 *   Ne menjati ASCII sličnim znakovima.
 */
import {
  KULTURE,
  MASINE,
  PROIZVODI,
  ZIV,
  jeKulturaArtikal,
  jeMasina,
  type ArtikalId,
  type KulturaId,
  type MasinaId,
  type ProizvodId,
  type ZgradaId,
  type ZivotinjaId,
} from '../config'
import { fmt, trajanjeTxt, vremeTxt } from './format'

// ── Katalog: nazivi i opisi po ID-ju iz config-a ──────────────────────────────

export interface NazivTekst {
  readonly naziv: string
}

export interface MasinaTekst {
  readonly naziv: string
  /** Opis u radnji (kartica koja se može kupiti). */
  readonly opis: string
  /** Tekst dugmeta koje pokreće turu. */
  readonly akcija: string
  /** Toast kad se tura završi; D16: i red u „Dobro došao nazad". */
  readonly gotovo: string
}

export interface ZivotinjaTekst {
  readonly naziv: string
  /** Opis u radnji. */
  readonly opis: string
}

/** Nazivi kultura (L489–493), velikim početnim slovom. */
const kulture: Readonly<Record<KulturaId, NazivTekst>> = {
  psenica: { naziv: 'Pšenica' },
  sargarepa: { naziv: 'Šargarepa' },
  paprika: { naziv: 'Paprika' },
  bundeva: { naziv: 'Bundeva' },
  grozdje: { naziv: 'Grožđe' },
}

/** Nazivi proizvoda (L497–500). ID `jaje` je jednina, naziv „Jaja" množina — kao u prototipu. */
const proizvodi: Readonly<Record<ProizvodId, NazivTekst>> = {
  brasno: { naziv: 'Brašno' },
  ajvar: { naziv: 'Ajvar' },
  jaje: { naziv: 'Jaja' },
  mleko: { naziv: 'Mleko' },
}

/** Mašine (L503–506). Brojevi u tekstu („4 pšenice", „3×") moraju da prate config — test to proverava. */
const masine: Readonly<Record<MasinaId, MasinaTekst>> = {
  mlin: {
    naziv: 'Mlin',
    opis: 'Melje 4 pšenice u džak brašna.',
    akcija: 'Samelji brašno — 4× pšenica → 1 džak',
    gotovo: 'Brašno je samleveno!',
  },
  kazan: {
    naziv: 'Kazan za ajvar',
    opis: 'Pretvara 3 paprike u teglu ajvara.',
    akcija: 'Skuvaj ajvar — 3× paprika → 1 tegla',
    gotovo: 'Ajvar je gotov!',
  },
}

/** Životinje (L509–512). „svakih 10 minuta" mora da prati `ZIV.stala.interval` — test to proverava. */
const zivotinje: Readonly<Record<ZivotinjaId, ZivotinjaTekst>> = {
  kokosinjac: { naziv: 'Kokošinjac', opis: 'Koke nose jaja same od sebe — samo ih pokupi.' },
  stala: { naziv: 'Štala', opis: 'Krava daje mleko na svakih 10 minuta.' },
}

/** Naziv artikla u magacinu (prototip `SVE_CENE[k].naziv`). */
function nazivArtikla(k: ArtikalId): string {
  return jeKulturaArtikal(k) ? kulture[k].naziv : proizvodi[k].naziv
}

/** Naziv zgrade (prototip `D.naziv`, D = MASINE[id] || ZIV[id]). */
function nazivZgrade(id: ZgradaId): string {
  return jeMasina(id) ? masine[id].naziv : zivotinje[id].naziv
}

/** Iznos u dinarima: `fmt(n) + ' din'` — običan razmak (NBSP je samo u novčaniku, vidi `hud.valuta`). */
function din(n: number): string {
  return fmt(n) + ' din'
}

/** „+N XP" — N sirovo. */
function plusXp(xp: number): string {
  return '+' + xp + ' XP'
}

// ── Katalog stringova ─────────────────────────────────────────────────────────

export const sr = {
  /** `<title>` dokumenta (L6). */
  naslov: 'Moj Salaš',

  /** Iznos u dinarima („1.234 din"): tezga, parcela, seme, statistika, kartice… (05 `common.money`). */
  din,

  /** HUD (L284–287). */
  hud: {
    /** Tekst na tabli. */
    tabla: 'Moj Salaš',
    /** `<small>` na tabli (CSS ga piše velikim slovima). D17: verzija iz package.json umesto „v0.3". */
    podnaslov: `prototip v${__APP_VERSION__}`,
    /** Posle `<span id="novac">` i `&nbsp;` u novčaniku — jedino mesto sa NBSP ispred „din". */
    valuta: 'din',
    /** Ispred `<span id="nivoBr">` (sa razmakom na kraju). */
    nivo: 'Nv. ',
  },

  /** Donja navigacija (L325–328). */
  nav: {
    farma: 'Farma',
    narudzbe: 'Narudžbine',
    pijaca: 'Pijaca',
    radnja: 'Radnja',
  },

  /** Tab Farma — parcele (crtajNjive L780–824). */
  njive: {
    /** `.plus` na praznoj parceli (U+FF0B). */
    plus: '＋',
    /** `.hint` na parceli 0 dok igrač nije ništa posadio. */
    hint: 'Tapni da posadiš 👇',
    /** `.uberi` na zreloj parceli. */
    uberi: 'Uberi!',
    /** `.katanac` na zaključanoj parceli — emoji, ne ART.katanac. Cena ispod je `din(cena)`. */
    katanac: '🔒',
    /** `<button id="uberiSve">`, samo kad je zrelo ≥ 2; n sirovo. */
    uberiSve: (n: number): string => 'Uberi sve (' + n + ')',
    /** `.cd` odbrojavanje na parceli koja raste (i tick). */
    odbrojavanje: (preostaloS: number): string => vremeTxt(preostaloS),
  },

  /** Tab Farma — kartice mašina i životinja (crtajZgrade L826–863). Nazivi su u `masine`/`zivotinje`. */
  zgrade: {
    /** `<p>` kartice mašine (L842–843): „Imaš 3× pšenica · brašno ide po ~120 din (+8 XP)". Nema razmaka
     *  između broja i ×; nazivi malim slovom; cena je BAZNA cena proizvoda, ne tržišna. */
    masinaInfo: (id: MasinaId, imam: number): string => {
      const M = MASINE[id]
      return (
        'Imaš ' +
        imam +
        '× ' +
        kulture[M.ulazK].naziv.toLowerCase() +
        ' · ' +
        proizvodi[M.izlaz].naziv.toLowerCase() +
        ' ide po ~' +
        fmt(PROIZVODI[M.izlaz].cena) +
        ' din (+' +
        M.xp +
        ' XP)'
      )
    },
    /** `<p data-mcd>` dok mašina radi (render i tick L837/L1115). */
    gotovoZa: (preostaloS: number): string => 'Gotovo za ' + vremeTxt(preostaloS),
    /** Tekst POSLE `<span data-zn>{n}</span>` u kartici životinje (L851–852):
     *  „/4 × jaja spremno · novo na 3 min". */
    zivotinjaInfo: (id: ZivotinjaId): string => {
      const Z = ZIV[id]
      return (
        '/' +
        Z.kap +
        ' × ' +
        proizvodi[Z.proizvod].naziv.toLowerCase() +
        ' spremno · novo na ' +
        trajanjeTxt(Z.interval)
      )
    },
    /** Dugme za kupljenje proizvoda životinje. */
    pokupi: 'Pokupi',
  },

  /** Donji list „Šta sadiš?" (otvoriList L955–968). */
  list: {
    /** `<h3>` lista (L333). */
    naslov: 'Šta sadiš?',
    /** Otključana kultura: „raste 20 s · prodaja ~18 din" (bazna prodajna cena). D16 u trajanju. */
    info: (k: KulturaId): string =>
      'raste ' + trajanjeTxt(KULTURE[k].vreme) + ' · prodaja ~' + fmt(KULTURE[k].cena) + ' din',
    /** Zaključana kultura — BEZ tačke na kraju (radnja ima tačku). */
    otkljucavaSe: (nivo: number): string => 'Otključava se na nivou ' + nivo,
    /** `<small>` u ceni semena (cena je `din(seme)`). */
    xp: plusXp,
    /** Umesto cene kad je kultura zaključana. */
    katanac: '🔒',
  },

  /** Tab Narudžbine (L300–302, crtajNarudzbe L865–889). Ime, emoji i poruka su iz narudžbine. */
  narudzbe: {
    naslov: 'Tabla za narudžbine',
    /** Napomena ispod table (L302). */
    napomena: 'Isporuke donose više novca i XP nego pijaca 😉',
    /** Poruka mušterije pod navodnicima „…“ (U+201E … U+201C). */
    poruka: (msg: string): string => '„' + msg + '“',
    /** Stavka: „imam/treba", oba sirovo. */
    stavka: (imam: number, treba: number): string => imam + '/' + treba,
    /** Nagrada POSLE ART.novcic — sa vodećim razmakom, kao u prototipu (L878). */
    nagradaDin: (iznos: number): string => ' ' + din(iznos),
    /** `.xpp` nagrada. */
    nagradaXp: (xp: number): string => '✦ +' + xp + ' XP',
    isporuci: 'Isporuči',
    odbij: 'Nemam to — daj drugu ↺',
  },

  /** Tab Pijaca (L306–308, crtajTezgu L891–908). */
  pijaca: {
    naslov: 'Tvoja tezga',
    napomena: 'Cene se menjaju tokom dana — ▲ prodaj, ▼ sačekaj.',
    /** Kad je ceo magacin prazan. */
    prazna: 'Tezga je prazna. Uberi nešto, pa se vrati da prodaš.',
    /** „× 1234 kom" — kom sirovo, BEZ fmt. Naziv robe je `nazivArtikla(k)`, cena `din(cena)`. */
    kolicina: (kom: number): string => '× ' + kom + ' kom',
    /** Oznaka trenda: smer > 0 / < 0 / = 0. */
    smer: {
      gore: '▲ dobra cena',
      dole: '▼ slaba cena',
      prosek: '— prosek',
    },
    prodajSve: 'Prodaj sve',
  },

  /** Tab Radnja — zgrade (L312, crtajRadnju L910–928). Opis zgrade je `masine[id].opis`/`zivotinje[id].opis`. */
  radnja: {
    naslov: 'Zgrade i oprema',
    kupljeno: 'Kupljeno ✓ — nalazi se na farmi.',
    kupi: (cena: number): string => 'Kupi — ' + fmt(cena) + ' din',
    /** `<h3>` zaključane zgrade. */
    zakljucano: (id: ZgradaId): string => nazivZgrade(id) + ' 🔒',
    /** Zaključana zgrada — SA tačkom na kraju (list semena je nema). */
    otkljucavaSe: (nivo: number): string => 'Otključava se na nivou ' + nivo + '.',
    aukcijaNaslov: 'Aukcijska kuća 🔒',
    aukcijaOpis: 'Trgovina sa pravim igračima — stiže u multiplayer verziji.',
  },

  /** Tab Radnja — statistika (L314, L929–932). Vrednosti: fmt(ubrano), din(zaradjeno), fmt(isporuke). */
  statistika: {
    naslov: 'Statistika',
    ubrano: 'Ubrano i sakupljeno',
    zaradjeno: 'Ukupno zarađeno',
    isporuke: 'Isporučenih narudžbina',
  },

  /** Tab Radnja — podešavanja (L316–319, L933). */
  podesavanja: {
    naslov: 'Podešavanja',
    zvuk: (mute: boolean): string => 'Zvuk: ' + (mute ? 'isključen' : 'uključen'),
    reset: 'Obriši napredak i počni ispočetka',
  },

  /** Reset (L1153). */
  reset: {
    /** Tekst potvrde (DialogPort.confirm). */
    potvrda: 'Sigurno? Sav napredak se briše.',
  },

  /** Level-up kartica (prikaziNivo L712–730). Nazivi pločica: `nazivOtkljucavanja` u index.ts. */
  noviNivo: {
    /** `.zvezda` (U+2B50, bez VS16). */
    zvezda: '⭐',
    naslov: (nivo: number): string => 'Nivo ' + nivo + '!',
    /** Ispred `<b>` sa iznosom — sa razmakom na kraju. */
    nagrada: 'Nagrada: ',
    /** U `<b>`: „+80 din". */
    nagradaIznos: (bonus: number): string => '+' + din(bonus),
    /** Samo ako ima bar jedna pločica. */
    otkljucano: 'Otključano:',
    /** Pločica na AUKCIJA_NIVO (uz ART.katanac). */
    aukcija: 'Aukcija uskoro',
    ok: 'Super!',
  },

  /** „Dobro došao nazad" (boot L1191–1198). */
  dobrodoslica: {
    zvezda: '🌅',
    naslov: 'Dobro došao nazad!',
    podnaslov: 'Dok te nije bilo:',
    /** Uz ART.psenica3; n sirovo. */
    sazrelo: (n: number): string => 'Sazrelo useva: ' + n,
    /** D16: po jedan red za SVAKU završenu mašinu, uz ART[id] — tekst je poruka `gotovo` te mašine
     *  (prototip je imao jedan red „Mašine su završile posao" uvek sa ikonicom kazana). */
    masina: (id: MasinaId): string => masine[id].gotovo,
    /** Uz ART[p]: „Jaja: +4" — naziv velikim slovom (NE malim), n sirovo. */
    skupljeno: (p: ProizvodId, n: number): string => proizvodi[p].naziv + ': +' + n,
    ok: 'Idemo!',
  },

  /** Dnevni poklon (boot L1203–1213). */
  poklon: {
    naslov: 'Dnevni poklon',
    /** Ispred `<b>` sa iznosom — sa razmakom na kraju. */
    pre: 'Dobio si ',
    /** U `<b>`: „+215 din". */
    iznos: (dar: number): string => '+' + din(dar),
    /** Posle `</b>` — sa razmakom na početku. */
    posle: ' za vernost farmi. Vidimo se sutra!',
    ok: 'Hvala!',
  },

  /** Toast poruke (toast() L596–598). Poruke iz core-a idu kroz `porukaTekst` (index.ts). */
  toast: {
    /** Boot bez „Dobro došao nazad", dok igrač nije ništa posadio. */
    dobrodosao: 'Dobro došao na farmu! 👩‍🌾',
    savetZalivanje: 'Savet: tapni biljku dok raste da je zaliješ 💧',
    vecZaliveno: 'Već je zaliveno 💧',
    /** „25%" mora da prati ZALIVANJE_UDEO — test to proverava. */
    zaliveno: 'Zaliveno — raste 25% brže 💧',
    ubranoSve: (n: number): string => 'Ubrano ' + n + ' useva 🌾',
    /** Naziv velikim slovom; zarada kroz fmt. */
    prodato: (kom: number, k: ArtikalId, zarada: number): string =>
      'Prodato ' + kom + ' × ' + nazivArtikla(k) + ' za ' + din(zarada),
    /** `ime` je iz narudžbine (sačuvano u sejvu), ne iz kataloga. */
    zahvaljuje: (ime: string, iznos: number): string => ime + ' ti zahvaljuje! +' + din(iznos),
    nemasNovca: 'Nemaš dovoljno dinara',
    /** „pšenice" mora da prati SOFTLOCK_REZERVA_KULTURA — test to proverava. */
    ostaviZaSeme: 'Ostavi bar za seme pšenice 🙂',
    novaParcela: 'Nova parcela je tvoja 🎉',
    zgradaNaFarmi: (id: ZgradaId): string => nazivZgrade(id) + ' je na farmi! 🎉',
    /** Naziv proizvoda malim slovom. */
    pokupljeno: (n: number, p: ProizvodId): string =>
      '+' + n + ' × ' + proizvodi[p].naziv.toLowerCase() + ' u korpi',
    novaIgra: 'Nova igra. Srećno! 🌱',
    /** D9: skladište je odbilo čitanje — sesija je readOnly. */
    ucitavanjeNeuspelo: 'Napredak ne može da se učita — igra se ovaj put neće čuvati.',
    /** D9: sejv je iz novije verzije igre — sesija je readOnly, sejv ostaje netaknut. */
    sejvNovijeVerzije: 'Napredak je iz novije verzije igre — igra se ovaj put neće čuvati.',
  },

  /** Efekti (L639). */
  fx: {
    /** `.plusxp` iznad sidra; xp sirovo (za „Uberi sve" zbir, i kad preskoči više nivoa). */
    plusXp,
  },

  // Katalog po ID-ju
  kulture,
  proizvodi,
  masine,
  zivotinje,

  /** Naziv robe po ID-ju (prototip `SVE_CENE[k].naziv`) — tezga, toast „Prodato". */
  nazivArtikla,
  /** Naziv zgrade po ID-ju (mašina ili životinja). */
  nazivZgrade,
}

/** Oblik kataloga; budući jezici (npr. `en: Poruke`) moraju da ga ispune ceo. */
export type Poruke = typeof sr
