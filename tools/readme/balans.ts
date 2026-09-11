/*
 * Tabela balansa za README.md, generisana iz src/config (izvor istine; CLAUDE.md: „config + testovi +
 * tabela u README u istom komitu"). tests/dokumentacija/readme.test.ts pada čim README odstupi od
 * ovog izlaza. Posle promene balansa: `node tools/readme/generisi.mjs`.
 *
 * Nazivi su iz i18n (isti kao u igri), trajanja kroz `trajanjeTxt`, iznosi kroz `fmt` („1.600 din“).
 * Brojevi u formulama su konstante iz config-a, a tabele parcela i nivoa su izračunate config
 * funkcijama — promena konstante ili oblika formule menja README.
 */
import {
  AUKCIJA_NIVO,
  DOBRODOSLICA_PRAG_S,
  FAZA_2_OD,
  FAZA_3_OD,
  KLJUC_SEJVA,
  KULTURE,
  MASINE,
  MASINE_REDOSLED,
  MAX_NIVO,
  MAX_PARCELA,
  NARUDZBINA_AKTIVNIH,
  NARUDZBINA_BAZA,
  NARUDZBINA_EKSPONENT,
  NARUDZBINA_JEDNA_VRSTA,
  NARUDZBINA_KOM_MAX,
  NARUDZBINA_KOM_MIN,
  NARUDZBINA_MAX_VREME_KULTURE,
  NARUDZBINA_MAX_VRSTA,
  NARUDZBINA_NAGRADA_KORAK,
  NARUDZBINA_NAGRADA_MNOZILAC,
  NARUDZBINA_RASPON,
  NARUDZBINA_RASPON_MIN,
  NARUDZBINA_XP_DELILAC,
  NARUDZBINA_XP_MIN,
  NIVO_BONUS_PO_NIVOU,
  PARCELA_CENA_BAZA,
  PARCELA_CENA_RAST,
  PARCELA_CENA_ZAOKRUZI,
  PIJACA_AMPLITUDA,
  PIJACA_FAZNI_POMAK,
  PIJACA_MIN_CENA,
  PIJACA_PERIOD_MS,
  PIJACA_PRAG_DOLE,
  PIJACA_PRAG_GORE,
  POCETNE_PARCELE,
  POCETNI_NOVAC,
  POKLON_BAZA,
  POKLON_PO_NIVOU,
  PROIZVODI,
  PROIZVODI_REDOSLED,
  REDOSLED,
  SEJV_MAX_CEKANJE_MS,
  SEJV_ODLAGANJE_MS,
  SOFTLOCK_REZERVA_KULTURA,
  SVI_KLJUCEVI,
  VERZIJA_SEJVA,
  XP_BAZA,
  XP_RAST,
  ZALIVANJE_UDEO,
  ZIV,
  ZIV_REDOSLED,
  ciljNarudzbine,
  cenaParcele,
  dnevniPoklon,
  nivoBonus,
  xpZaNivo,
  type ProizvodId,
} from '../../src/config'
import { t } from '../../src/i18n'
import { fmt, trajanjeTxt } from '../../src/i18n/format'

export const POCETAK = '<!-- balans:pocetak (generisano iz src/config — ne menjati ručno) -->'
export const KRAJ = '<!-- balans:kraj -->'

const din = (n: number): string => fmt(n) + ' din'
const procenat = (x: number): string => fmt(x * 100) + ' %'
const red = (celije: readonly (string | number)[]): string => '| ' + celije.join(' | ') + ' |'
const tabela = (zaglavlje: readonly string[], desno: readonly boolean[], redovi: string[][]) =>
  [red(zaglavlje), red(desno.map((d) => (d ? '---:' : '---'))), ...redovi.map((r) => red(r))].join(
    '\n',
  )

function izvorProizvoda(p: ProizvodId): string {
  for (const id of MASINE_REDOSLED) {
    const M = MASINE[id]
    if (M.izlaz === p) {
      return `${t.masine[id].naziv} (${M.ulazN} × ${t.kulture[M.ulazK].naziv.toLowerCase()})`
    }
  }
  for (const id of ZIV_REDOSLED) if (ZIV[id].proizvod === p) return t.zivotinje[id].naziv
  return '—'
}

function otkljucava(l: number): string {
  const nazivi = [
    ...REDOSLED.filter((k) => KULTURE[k].nivo === l).map((k) => t.kulture[k].naziv),
    ...MASINE_REDOSLED.filter((id) => MASINE[id].nivo === l).map((id) => t.masine[id].naziv),
    ...ZIV_REDOSLED.filter((id) => ZIV[id].nivo === l).map((id) => t.zivotinje[id].naziv),
    ...(l === AUKCIJA_NIVO ? ['najava aukcije'] : []),
  ]
  return nazivi.length ? nazivi.join(', ') : '—'
}

function kulture(): string {
  return tabela(
    ['Kultura', 'Seme', 'Rast', 'Prodaja (bazna)', 'XP po žetvi', 'Nivo'],
    [false, true, true, true, true, true],
    REDOSLED.map((k) => {
      const K = KULTURE[k]
      return [
        t.kulture[k].naziv,
        din(K.seme),
        trajanjeTxt(K.vreme),
        din(K.cena),
        String(K.xp),
        String(K.nivo),
      ]
    }),
  )
}

function proizvodi(): string {
  return tabela(
    ['Proizvod', 'Prodaja (bazna)', 'Odakle'],
    [false, true, false],
    PROIZVODI_REDOSLED.map((p) => [
      t.proizvodi[p].naziv,
      din(PROIZVODI[p].cena),
      izvorProizvoda(p),
    ]),
  )
}

function masine(): string {
  return tabela(
    ['Mašina', 'Cena', 'Nivo', 'Ulaz → izlaz', 'Trajanje ture', 'XP po turi'],
    [false, true, true, false, true, true],
    MASINE_REDOSLED.map((id) => {
      const M = MASINE[id]
      const ulaz = `${M.ulazN} × ${t.kulture[M.ulazK].naziv.toLowerCase()}`
      const izlaz = `1 × ${t.proizvodi[M.izlaz].naziv.toLowerCase()}`
      return [
        t.masine[id].naziv,
        din(M.cena),
        String(M.nivo),
        `${ulaz} → ${izlaz}`,
        trajanjeTxt(M.vreme),
        String(M.xp),
      ]
    }),
  )
}

function zivotinje(): string {
  return tabela(
    ['Životinja', 'Cena', 'Nivo', 'Proizvod', 'Jedan komad na', 'Kapacitet', 'XP po komadu'],
    [false, true, true, false, true, true, true],
    ZIV_REDOSLED.map((id) => {
      const Z = ZIV[id]
      return [
        t.zivotinje[id].naziv,
        din(Z.cena),
        String(Z.nivo),
        t.proizvodi[Z.proizvod].naziv.toLowerCase(),
        trajanjeTxt(Z.interval),
        String(Z.kap),
        String(Z.xpPo),
      ]
    }),
  )
}

function parcele(): string {
  const redovi: string[][] = []
  for (let n = POCETNE_PARCELE; n < MAX_PARCELA; n++) {
    redovi.push([`${n + 1}.`, din(cenaParcele(n))])
  }
  return tabela(['Parcela', 'Cena'], [false, true], redovi)
}

function nivoi(): string {
  const redovi: string[][] = []
  let ukupno = 0
  for (let l = 1; l <= MAX_NIVO; l++) {
    const cilj = `${fmt(ciljNarudzbine(l, 0))}–${fmt(ciljNarudzbine(l, 1))}`
    redovi.push([
      String(l),
      l < MAX_NIVO ? fmt(xpZaNivo(l)) : '— (maks.)',
      fmt(ukupno),
      l > 1 ? din(nivoBonus(l)) : '—',
      din(dnevniPoklon(l)),
      cilj,
      otkljucava(l),
    ])
    ukupno += xpZaNivo(l)
  }
  return tabela(
    [
      'Nivo',
      'XP do sledećeg',
      'Ukupno XP',
      'Bonus',
      'Dnevni poklon',
      'Cilj narudžbine',
      'Otključava',
    ],
    [true, true, true, true, true, true, false],
    redovi,
  )
}

function formule(): string {
  const psenica = KULTURE[SOFTLOCK_REZERVA_KULTURA]
  const idx = SVI_KLJUCEVI.map((k, i) => `${i} ${k}`).join(', ')
  return [
    `- **Start:** ${din(POCETNI_NOVAC)}, ${POCETNE_PARCELE} prazne parcele, najviše ${MAX_PARCELA} parcela.`,
    `- **Cena sledeće parcele** (n = trenutni broj parcela): \`round(${PARCELA_CENA_BAZA} · ${PARCELA_CENA_RAST}^(n − 2) / ${PARCELA_CENA_ZAOKRUZI}) · ${PARCELA_CENA_ZAOKRUZI}\`.`,
    `- **XP za nivo l:** \`round(${XP_BAZA} · ${XP_RAST}^(l − 1))\`, najviše nivo ${MAX_NIVO}; **bonus** za nivo l: \`l · ${NIVO_BONUS_PO_NIVOU}\` din (za svaki pređeni nivo).`,
    `- **Dnevni poklon:** \`${POKLON_BAZA} + l · ${POKLON_PO_NIVOU}\` din, jednom po kalendarskom danu, posle prve sadnje.`,
    `- **Rast:** klica do ${procenat(FAZA_2_OD)} vremena, faza 2 do ${procenat(FAZA_3_OD)}, zatim faza 3; **zalivanje** jednom po usevu skida ${procenat(ZALIVANJE_UDEO)} PREOSTALOG vremena.`,
    `- **Tržišna cena:** \`max(${PIJACA_MIN_CENA}, round(baza · (1 + ${PIJACA_AMPLITUDA} · sin(t / ${PIJACA_PERIOD_MS} ms · 2π + idx · ${PIJACA_FAZNI_POMAK}))))\`; ▲ kad je množilac ≥ ${PIJACA_PRAG_GORE}, ▼ kad je ≤ ${PIJACA_PRAG_DOLE}. idx: ${idx}.`,
    `- **Narudžbine:** uvek ${NARUDZBINA_AKTIVNIH} aktivne; jedna vrsta robe sa verovatnoćom ${NARUDZBINA_JEDNA_VRSTA}, inače ${NARUDZBINA_MAX_VRSTA}; pool = otključane kulture koje rastu ≤ ${trajanjeTxt(NARUDZBINA_MAX_VREME_KULTURE)} + proizvodi kupljenih zgrada.`,
    `- **Cilj narudžbine:** \`${NARUDZBINA_BAZA} · lvl^${NARUDZBINA_EKSPONENT} · (${NARUDZBINA_RASPON_MIN} + r · ${NARUDZBINA_RASPON})\`, r ∈ [0, 1); komada po stavci \`max(${NARUDZBINA_KOM_MIN}, min(${NARUDZBINA_KOM_MAX}, round(cilj / broj stavki / bazna cena)))\`.`,
    `- **Nagrada narudžbine** (vrednost = zbir baznih cena): \`ceil(vrednost · ${NARUDZBINA_NAGRADA_MNOZILAC} / ${NARUDZBINA_NAGRADA_KORAK}) · ${NARUDZBINA_NAGRADA_KORAK}\` din i \`max(${NARUDZBINA_XP_MIN}, ceil(vrednost / ${NARUDZBINA_XP_DELILAC}))\` XP.`,
    `- **Anti-softlock:** kupovina se odbija ako bi ostalo manje od ${din(psenica.seme)} (seme: ${t.kulture[SOFTLOCK_REZERVA_KULTURA].naziv.toLowerCase()}), a ništa ne raste, ne proizvodi i magacin je prazan.`,
    `- **„Dobro došao nazad“:** posle odsustva dužeg od ${trajanjeTxt(DOBRODOSLICA_PRAG_S)}, ako je nešto sazrelo, završeno ili skupljeno.`,
    `- **Sejv:** ključ \`${KLJUC_SEJVA}\`, verzija ${VERZIJA_SEJVA} (v2 se migrira); upis ${SEJV_ODLAGANJE_MS} ms posle poslednje promene, najkasnije na ${SEJV_MAX_CEKANJE_MS} ms tokom neprekidne igre, odmah pri odlasku u pozadinu.`,
  ].join('\n')
}

/** Sadržaj između oznaka (bez oznaka), neformatiran — README ga drži u Prettier obliku. */
export function tabelaBalansa(): string {
  return [
    '### Kulture',
    kulture(),
    '### Proizvodi',
    proizvodi(),
    '### Mašine',
    masine(),
    '### Životinje',
    zivotinje(),
    '### Parcele',
    parcele(),
    '### Nivoi',
    nivoi(),
    '### Formule i pravila',
    formule(),
  ].join('\n\n')
}

/** Deo README-a između oznaka (bez praznih redova na krajevima); baca ako oznaka nema. */
export function izReadmea(readme: string): string {
  const a = readme.indexOf(POCETAK)
  const b = readme.indexOf(KRAJ)
  if (a < 0 || b < a) throw new Error('README.md: nema oznaka tabele balansa')
  return readme.slice(a + POCETAK.length, b).trim()
}

/** README sa novim sadržajem između oznaka. */
export function uReadme(readme: string, sadrzaj: string): string {
  const a = readme.indexOf(POCETAK)
  const b = readme.indexOf(KRAJ)
  if (a < 0 || b < a) throw new Error('README.md: nema oznaka tabele balansa')
  return readme.slice(0, a + POCETAK.length) + '\n\n' + sadrzaj + '\n\n' + readme.slice(b)
}
