/*
 * Šta se generiše: nasumični tragovi (seme × {fresh, rich} × 200 koraka, 07 §d.6) i skriptovani
 * tragovi za retke putanje koje nasumični drajver skoro nikad ne pogodi (mašine ~1/2000 koraka,
 * odsustvo, više nivoa odjednom, nivo 20, reset, poklon kroz dane, sat unazad, v2 sejv).
 */
import type { Stanje } from '../../src/core/types'
import { DAN_T0, MAG0, narudzba, stanje } from '../../tests/helpers'
import { T0, type KorakSkripte, type OpcijeTraga, type Start } from './tragovi'

const MIN = 60_000
const SAT = 60 * MIN
const DAN = 24 * SAT

const sejv = (o: Partial<Stanje>): string => JSON.stringify(stanje(o))

export const START_FRESH: Start = { ime: 'fresh', raw: null }

/** Kao referenca-sim TEST 3 (revizijin `STARTS.rich`): nivo 8, poklon još nije uzet. */
export const START_RICH: Start = {
  ime: 'rich',
  raw: JSON.stringify({
    v: 3,
    novac: 5000,
    xp: 5000,
    parcele: [
      { c: null, t: 0, z: false },
      { c: null, t: 0, z: false },
      { c: null, t: 0, z: false },
    ],
    mag: { ...MAG0, psenica: 20, sargarepa: 10, paprika: 9, bundeva: 2 },
    masine: { mlin: { k: false, t: 0 }, kazan: { k: false, t: 0 } },
    ziv: { kokosinjac: { k: false, t: 0 }, stala: { k: false, t: 0 } },
    narudzbe: [],
    mute: true,
    sadio: true,
    stat: { ubrano: 0, zaradjeno: 0, isporuke: 0 },
    poklonDan: '',
    videno: T0 - SAT,
  }),
}

/** referenca-sim TEST 4 (07 R3), relativno na T0: v2 sa kazanom, `ko` narudžbinama, bez `z`. */
export const START_V2: Start = {
  ime: 'v2',
  raw: JSON.stringify({
    v: 2,
    novac: 777,
    xp: 150,
    parcele: [
      { c: 'paprika', t: T0 - MIN },
      { c: null, t: 0 },
    ],
    mag: { psenica: 3, sargarepa: 0, paprika: 2, bundeva: 0, grozdje: 1, ajvar: 1 },
    kazan: true,
    kazanT: 0,
    narudzbe: [
      {
        id: 5,
        ko: { ime: 'Baka Mira', emoji: '👵', boja: '#fff' },
        stavke: [{ k: 'psenica', kom: 2 }],
        din: 60,
        xp: 5,
      },
      {
        id: 6,
        ko: { ime: 'Piljar Pera', emoji: '🧢', boja: '#fff' },
        stavke: [{ k: 'sargarepa', kom: 1 }],
        din: 80,
        xp: 6,
      },
    ],
    mute: false,
    sadio: true,
    videno: T0,
  }),
}

const posadi = (i: number): KorakSkripte => ({ k: 'plant', i, crop: 'psenica' })

export const SLUCAJNI: readonly OpcijeTraga[] = [1, 2, 3, 4, 5, 6, 7, 8].flatMap((seme) => [
  { ime: `fresh-s${seme}`, seme, start: START_FRESH, koraka: 200 },
  { ime: `rich-s${seme}`, seme, start: START_RICH, koraka: 200 },
])

export const SKRIPTOVANI: readonly OpcijeTraga[] = [
  {
    // Obe mašine: kupovina, pokretanje, završetak u ticku (i obe u ISTOM ticku), ponovo, 10 h.
    ime: 'skripta-masine',
    seme: 101,
    start: START_RICH,
    skripta: [
      { k: 'buy', id: 'mlin' },
      { k: 'buy', id: 'kazan' },
      { k: 'startMachine', id: 'mlin' },
      { k: 'startMachine', id: 'kazan' },
      { k: 'wait', ms: 1000 },
      { k: 'wait', ms: 60_000 },
      { k: 'wait', ms: 30_000 },
      { k: 'startMachine', id: 'mlin' },
      { k: 'wait', ms: 150_000 },
      { k: 'startMachine', id: 'kazan' },
      { k: 'startMachine', id: 'mlin' },
      { k: 'wait', ms: 10 * SAT },
      { k: 'sell', item: 'brasno' },
      { k: 'sell', item: 'ajvar' },
      { k: 'reject' },
    ],
  },
  {
    // Level-up iz TICKA (mašina donosi poslednjih 8 XP do nivoa 9).
    ime: 'skripta-masina-nivo',
    seme: 102,
    start: {
      ime: 'masina-nivo',
      raw: sejv({
        novac: 500,
        xp: 5620,
        mag: { ...MAG0, psenica: 8 },
        masine: { mlin: { k: true, t: 0 }, kazan: { k: false, t: 0 } },
      }),
    },
    skripta: [
      { k: 'startMachine', id: 'mlin' },
      { k: 'wait', ms: 91_000 },
      { k: 'overlayOk' },
      { k: 'startMachine', id: 'mlin' },
      { k: 'wait', ms: 90_000 },
    ],
  },
  {
    // 07 R7: sat odsustva — dobrodošlica + poklon u redu, mašina se knjiži PRVIM tickom,
    // životinje kapirane; pa još jedan hladan start 3 h kasnije.
    ime: 'skripta-odsustvo',
    seme: 103,
    start: {
      ime: 'odsustvo',
      raw: sejv({
        xp: 5000,
        videno: T0 - SAT,
        poklonDan: '2026-01-14',
        parcele: [
          { c: 'psenica', t: T0 - SAT - 10_000, z: false },
          { c: 'psenica', t: T0 - SAT - 2 * SAT, z: false },
          { c: 'sargarepa', t: T0 - 10_000, z: false },
          { c: 'grozdje', t: T0 - 2 * SAT, z: false },
        ],
        masine: { mlin: { k: true, t: T0 - SAT - MIN }, kazan: { k: true, t: 0 } },
        ziv: { kokosinjac: { k: true, t: T0 - SAT - 6 * MIN }, stala: { k: true, t: T0 - SAT } },
      }),
    },
    skripta: [
      { k: 'overlayOk' },
      { k: 'overlayOk' },
      { k: 'wait', ms: 1000 },
      { k: 'harvestAll' },
      { k: 'collect', id: 'kokosinjac' },
      { k: 'collect', id: 'stala' },
      { k: 'reload', ms: 3 * SAT },
      { k: 'collect', id: 'kokosinjac' },
      { k: 'collect', id: 'stala' },
      { k: 'harvest', i: 2 },
    ],
  },
  {
    // D3: dugo odsustvo ne pravi zalihu preko kapaciteta; obe grane formule (pun / delimičan).
    ime: 'skripta-zivotinje',
    seme: 104,
    start: START_RICH,
    skripta: [
      { k: 'buy', id: 'kokosinjac' },
      { k: 'buy', id: 'stala' },
      { k: 'wait', ms: SAT },
      { k: 'collect', id: 'kokosinjac' },
      { k: 'wait', ms: 1000 },
      { k: 'wait', ms: 400_000 },
      { k: 'collect', id: 'kokosinjac' },
      { k: 'wait', ms: 140_000 },
      { k: 'collect', id: 'kokosinjac' },
      { k: 'collect', id: 'stala' },
      { k: 'wait', ms: DAN },
      { k: 'collect', id: 'stala' },
      { k: 'collect', id: 'kokosinjac' },
      { k: 'reload', ms: 2 * SAT },
      { k: 'collect', id: 'kokosinjac' },
      { k: 'collect', id: 'stala' },
      { k: 'wait', ms: 30 * MIN },
      { k: 'collect', id: 'stala' },
    ],
  },
  {
    // 07 R8: jedna isporuka od 200 XP sa nivoa 1 → nivoi 2, 3, 4 (zamena posle dodajXp, iz
    // pool-a nivoa 4); pa „Uberi sve" 7 grožđa → nivoi 5 i 6; pa pojedinačna žetva.
    ime: 'skripta-nivoi',
    seme: 105,
    start: {
      ime: 'nivoi',
      raw: sejv({
        novac: 50,
        xp: 0,
        mag: { ...MAG0, psenica: 1 },
        narudzbe: [narudzba(1, 'psenica', 1, 25, 200), narudzba(2, 'sargarepa', 9, 700, 70)],
        parcele: [
          ...Array.from({ length: 7 }, () => ({
            c: 'grozdje' as const,
            t: T0 - 3 * SAT,
            z: false,
          })),
          { c: null, t: 0, z: false },
          { c: null, t: 0, z: false },
        ],
      }),
    },
    skripta: [
      { k: 'deliver', id: 1 },
      { k: 'harvestAll' },
      posadi(7),
      { k: 'water', i: 7 },
      { k: 'wait', ms: 15_000 },
      { k: 'harvest', i: 7 },
      { k: 'reject' },
    ],
  },
  {
    // Nivo 20 je plafon: prelazak daje +800, dalje XP ne daje level-up.
    ime: 'skripta-nivo-20',
    seme: 106,
    start: {
      ime: 'nivo-20',
      raw: sejv({
        novac: 1000,
        xp: 6_594_690,
        parcele: [
          { c: 'grozdje', t: T0 - 3 * SAT, z: false },
          { c: 'grozdje', t: T0 - 3 * SAT, z: false },
          { c: 'grozdje', t: T0 - 3 * SAT, z: false },
        ],
      }),
    },
    skripta: [{ k: 'harvest', i: 0 }, { k: 'harvestAll' }, posadi(0), { k: 'wait', ms: 25_000 }],
  },
  {
    // D6: reset čuva zvuk i današnji poklon; ID-jevi kreću od 1; poklon tek sledećeg dana.
    ime: 'skripta-reset',
    seme: 107,
    start: START_RICH,
    skripta: [
      { k: 'toggleMute' },
      { k: 'toggleMute' },
      { k: 'toggleMute' },
      posadi(0),
      { k: 'reset' },
      posadi(0),
      { k: 'reload', ms: MIN },
      { k: 'reload', ms: DAN },
      { k: 'toggleMute' },
      { k: 'reset' },
      { k: 'reject' },
    ],
  },
  {
    // D5: poklon kroz dane — prvi hladan start posle sadnje (isti dan), ne opet isti dan (ni u
    // 23:59:59.999), da u ponoć, sat unazad ne, pa napred opet da.
    ime: 'skripta-poklon',
    seme: 108,
    start: START_FRESH,
    skripta: [
      posadi(0),
      { k: 'reload', ms: MIN },
      { k: 'reload', ms: 2 * MIN },
      // T0 je 10:00 po beogradskom vremenu → ponoć je T0 + 14 h; sada je T0 + 3 min.
      { k: 'reload', ms: 14 * SAT - 3 * MIN - 1 },
      { k: 'reload', ms: 1 },
      { k: 'reload', ms: -3 * DAN },
      { k: 'wait', ms: 1000 },
      { k: 'reload', ms: 5 * DAN },
      { k: 'harvest', i: 0 },
    ],
  },
  {
    // D4 + D5: sat vraćen unazad — tap na dugme omogućeno PRE promene sata (pre sledećeg
    // ticka) ne sme da pokupi negativno; tick ga zatim onemogući; hladan start „juče" bez poklona.
    ime: 'skripta-sat-unazad',
    seme: 109,
    start: START_RICH,
    skripta: [
      { k: 'buy', id: 'kokosinjac' },
      { k: 'wait', ms: SAT },
      { k: 'collect', id: 'kokosinjac' },
      { k: 'wait', ms: 10 * MIN },
      { k: 'jump', ms: -2 * SAT },
      { k: 'collect', id: 'kokosinjac' },
      { k: 'wait', ms: 1000 },
      { k: 'reload', ms: -SAT },
      { k: 'wait', ms: 50 * MIN },
      { k: 'wait', ms: 3 * SAT },
      { k: 'collect', id: 'kokosinjac' },
      { k: 'reload', ms: -2 * DAN },
      { k: 'reload', ms: 3 * DAN },
    ],
  },
  {
    // Granice (>= svuda) i dupli tapovi: D2 (seme dok se list zatvara), D1 (zastarela pločica
    // pre crtanja posle 180 ms); zrelo tačno na granici za „Uberi sve" i za pojedinačnu žetvu;
    // zalivanje sa 2 ms preostalo (Math.round → −1 ms).
    ime: 'skripta-granice',
    seme: 112,
    start: { ime: 'granice', raw: sejv({ novac: 100 }) },
    skripta: [
      posadi(0),
      posadi(1),
      { k: 'dupliTap' },
      { k: 'wait', ms: 20_000 },
      { k: 'harvestAll' },
      posadi(0),
      { k: 'wait', ms: 19_998 },
      { k: 'water', i: 0 },
      { k: 'wait', ms: 1 },
      { k: 'harvest', i: 0 },
      { k: 'dupliTap' },
      { k: 'openList', i: 0 },
      { k: 'closeList' },
    ],
  },
  {
    // v2 sejv (D8 spljoštene narudžbine, D11 bez kazan/kazanT), pa kazan iz v2 radi dalje.
    ime: 'skripta-v2',
    seme: 110,
    start: START_V2,
    skripta: [
      { k: 'deliver', id: 5 },
      { k: 'reject', id: 6 },
      { k: 'wait', ms: 240_000 },
      { k: 'harvest', i: 0 },
      { k: 'startMachine', id: 'kazan' },
      { k: 'wait', ms: 240_000 },
      { k: 'sell', item: 'ajvar' },
    ],
  },
  {
    // Anti-softlock kroz UI: tačno 600 din, prazan magacin, ništa ne raste → kazan odbijen
    // (dugme je omogućeno); parcele se kupuju dok ima novca, pa odbijanje „nemaš dovoljno".
    ime: 'skripta-softlock',
    seme: 111,
    start: { ime: 'softlock', raw: sejv({ novac: 600, xp: 200, poklonDan: DAN_T0 }) },
    skripta: [
      { k: 'buy', id: 'kazan' },
      { k: 'buyPlot' },
      { k: 'buyPlot' },
      posadi(0),
      { k: 'buyPlot' },
    ],
  },
]

export const SVI_TRAGOVI: readonly OpcijeTraga[] = [...SLUCAJNI, ...SKRIPTOVANI]
