/*
 * M16/M17: zlatni diferencijalni test dekodera nad tests/fixtures/sejv/ucitaj-golden.json —
 * 33 sirove vrednosti skladišta, svaka sa TAČNIM `S` koje prototipov `ucitaj()` (L548–569)
 * ostavlja, sa satom zamrznutim na BASE (generator: scratchpad/baseline/gen-golden-ucitaj.cjs).
 *
 * - Klase missing / rejected / producible (sve što prototip ili skladište zaista mogu da daju):
 *   port === prototip, uz SAMO dozvoljena odstupanja D8 i D11 (`primeniDozvoljenaOdstupanja`,
 *   svako dokumentovano u alati.ts). Za rejected je stanje isto (nova igra); razlika je u
 *   kontroleru (D9: rezerva / readOnly umesto pregaženog sejva) — vidi kontroler.test.ts.
 * - Klase hand-edited / corrupt: prototip + D8/D11 + TAČNO navedene popravke (D10), svaka
 *   sa razlogom. Za „corrupt" prototip ostavlja polu-spojeno stanje i start pada (01 B3);
 *   port gradi ispravno stanje iz istog sejva.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { MAX_PARCELA } from '../../../src/config'
import { dekodirajSejv, kodirajSejv, type DekodiranSejv } from '../../../src/core/sejv'
import { pocetnoStanje } from '../../../src/core/stanje'
import { jeJsonObj, primeniDozvoljenaOdstupanja, type Json, type JsonObj } from './alati'

type Klasa = 'missing' | 'rejected' | 'producible' | 'hand-edited' | 'corrupt'
interface Slucaj {
  name: string
  class: Klasa
  raw: string | null
  S: Json
}
const ZLATNI = JSON.parse(
  readFileSync(new URL('../../fixtures/sejv/ucitaj-golden.json', import.meta.url), 'utf8'),
) as { BASE: number; cases: Slucaj[] }
const BASE = ZLATNI.BASE
const MORA: readonly Klasa[] = ['missing', 'rejected', 'producible']

function slucaj(ime: string): Slucaj {
  const c = ZLATNI.cases.find((x) => x.name === ime)
  if (!c) throw new Error(`nema slučaja ${ime}`)
  return c
}
/** Prototipovo S za slučaj, sa primenjenim D8/D11. */
const proto = (ime: string): JsonObj => primeniDozvoljenaOdstupanja(slucaj(ime).S)
function objekat(x: Json | undefined): JsonObj {
  if (!jeJsonObj(x ?? null)) throw new Error('nije objekat')
  return x as JsonObj
}
/** Uklanja ključeve po putanji (`'mag.tursija'`) — ono što prototip čuva, a port odbacuje. */
function bez(o: JsonObj, ...putanje: string[]): JsonObj {
  for (const p of putanje) {
    const delovi = p.split('.')
    const poslednji = delovi.pop() ?? ''
    let x: JsonObj = o
    for (const d of delovi) x = objekat(x[d])
    Reflect.deleteProperty(x, poslednji)
  }
  return o
}
const PRAZNA = { c: null, t: 0, z: false }

/** Očekivana vrsta dekodiranja za svaki slučaj. */
const VRSTA: Record<string, Partial<DekodiranSejv>> = {
  'missing key': { vrsta: 'prazan' },
  'empty string': { vrsta: 'prazan' },
  'JSON null': { vrsta: 'neispravan', razlog: 'nije-objekat' },
  'invalid JSON': { vrsta: 'neispravan', razlog: 'json' },
  'JSON number': { vrsta: 'neispravan', razlog: 'nije-objekat' },
  'JSON array': { vrsta: 'neispravan', razlog: 'nije-objekat' },
  'JSON string': { vrsta: 'neispravan', razlog: 'nije-objekat' },
  'v:1': { vrsta: 'neispravan', razlog: 'verzija' },
  'v:4 (future)': { vrsta: 'buduci', verzija: 4 },
  'v:"3" (string)': { vrsta: 'neispravan', razlog: 'verzija' },
  'v missing': { vrsta: 'neispravan', razlog: 'verzija' },
}

/** Obavezni slučajevi: popravke (sve moraju biti prazne osim D11 u v3 posle migracije). */
const POPRAVKE_OBAVEZNIH: Record<string, string[]> = {
  'v2 TEST4 fixture': [],
  'v2 kazan cooking': [],
  'v2 with stat+poklonDan': [],
  'v2 without videno': [],
  'v3 full': [],
  // D11: u v3 sejvu `kazan/kazanT` nisu premešteni nigde (prototip ih ignoriše) → odbačeni → rezerva.
  'v3 as written after a v2 migration (kazan/kazanT/ko carried)': [
    'kazan: odbaceno',
    'kazanT: odbaceno',
  ],
}

/** Ručno izmenjeni / oštećeni sejvovi: očekivano stanje i popravke, svaka sa razlogom. */
const RUCNI: Record<string, { stanje: () => unknown; popravke: string[] }> = {
  // Isto kao prototip.
  'v2 minimal {v:2}': { stanje: () => pocetnoStanje(BASE), popravke: [] },
  // 01 G7: nekupljen kazan sa t>0 bi zauvek držao nestoRaste() true (prototip: kazan {k:false, t>0}).
  'v2 kazanT set but kazan false': {
    stanje: () => {
      const s = proto('v2 kazanT set but kazan false')
      objekat(s.masine).kazan = { k: false, t: 0 }
      return s
    },
    popravke: ['masine.kazan.t: ispravljeno'],
  },
  // Stanje isto kao prototip (L566: vrh pobeđuje); pregaženi masine.kazan se prijavljuje.
  'v2 with masine present (kazan override wins)': {
    stanje: () => proto('v2 with masine present (kazan override wins)'),
    popravke: ['masine.kazan.k: zamenjeno', 'masine.kazan.t: zamenjeno'],
  },
  'v3 only {v:3}': { stanje: () => pocetnoStanje(BASE), popravke: [] },
  // [] ne nosi podatke; prototip isto daje 2 početne parcele.
  'v3 parcele []': { stanje: () => proto('v3 parcele []'), popravke: [] },
  // Isto stanje kao prototip, ali objekat sa parcelom je odbačen → rezerva.
  'v3 parcele non-array': {
    stanje: () => proto('v3 parcele non-array'),
    popravke: ['parcele: zamenjeno'],
  },
  // Isto stanje kao prototip (L564 koercije); svaka koercija se prijavljuje.
  'v3 parcele odd elements': {
    stanje: () => proto('v3 parcele odd elements'),
    popravke: [
      'parcele[0].extra: odbaceno',
      'parcele[0].z: ispravljeno',
      'parcele[1]: zamenjeno',
      'parcele[2].c: zamenjeno',
      'parcele[2].t: zamenjeno',
    ],
  },
  // 01 G1/G2, B8: prototip čuva nepoznate ključeve na vrhu, u mag/stat i unutar mašina
  // (a nepoznatu decu masine/ziv tiho odbacuje); port odbacuje sve i prijavljuje svaki.
  'v3 unknown keys everywhere': {
    stanje: () =>
      bez(
        proto('v3 unknown keys everywhere'),
        'extraTop',
        'mag.tursija',
        'masine.mlin.lvl',
        'stat.rekord',
      ),
    popravke: [
      'extraTop: odbaceno',
      'mag.tursija: odbaceno',
      'masine.susara: odbaceno',
      'masine.mlin.lvl: odbaceno',
      'ziv.svinje: odbaceno',
      'stat.rekord: odbaceno',
    ],
  },
  // Isto stanje kao prototip (`p.mag||{}`…); null je prisutna vrednost koja se zamenjuje.
  'v3 nested objects null': {
    stanje: () => proto('v3 nested objects null'),
    popravke: ['mag: zamenjeno', 'stat: zamenjeno', 'masine: zamenjeno', 'ziv: zamenjeno'],
  },
  // 01 L5 paritet: masine bez mlin vraća mlin na početno.
  'v3 masine.kazan partial': { stanje: () => proto('v3 masine.kazan partial'), popravke: [] },
  'v3 narudzbe non-array': {
    stanje: () => proto('v3 narudzbe non-array'),
    popravke: ['narudzbe: zamenjeno'],
  },
  // Paritet: sve ispravne narudžbine ostaju (broj se sam svede na 2).
  'v3 three orders (kept)': { stanje: () => proto('v3 three orders (kept)'), popravke: [] },
  // 01 B10: prototip čuva 12 parcela (crta ih bez zaključane pločice); port najviše MAX_PARCELA.
  'v3 twelve parcels (kept)': {
    stanje: () => {
      const s = proto('v3 twelve parcels (kept)')
      const p = s.parcele
      return { ...s, parcele: Array.isArray(p) ? p.slice(0, MAX_PARCELA) : p }
    },
    popravke: ['parcele[9]: odbaceno', 'parcele[10]: odbaceno', 'parcele[11]: odbaceno'],
  },
  // 01 G3: prototip čuva novac:null (HUD 0, sejv null) i videno:null.
  'v3 novac null, videno null': {
    stanje: () => ({ ...proto('v3 novac null, videno null'), novac: 50, videno: BASE }),
    popravke: ['novac: zamenjeno', 'videno: zamenjeno'],
  },
  // 01 B3: prototip baca na L564 i ostavlja polu-spojeno stanje (parcele sa null, narudzbe 'x').
  'v3 null parcel (sparse array from stale izabrana) -> PARTIAL state': {
    stanje: () => ({
      ...proto('v3 full'),
      parcele: [PRAZNA, PRAZNA, { c: 'psenica', t: BASE, z: false }],
      narudzbe: [],
    }),
    popravke: ['parcele[1]: zamenjeno', 'narudzbe: zamenjeno'],
  },
  // 01 B3: u prototipu v ostaje 2 i kazan se ne mapira; port normalno migrira.
  'v2 null parcel -> PARTIAL state (v stays 2, kazan not mapped)': {
    stanje: () => ({ ...proto('v2 TEST4 fixture'), parcele: [PRAZNA, PRAZNA] }),
    popravke: ['parcele[1]: zamenjeno'],
  },
}

const sortirano = (a: readonly string[]) => [...a].sort()

describe('zlatni fajl', () => {
  it('ima 33 slučaja (17 obaveznih) i svaki ima očekivanje u ovom testu', () => {
    expect(BASE).toBe(1789000000000)
    expect(ZLATNI.cases).toHaveLength(33)
    const obavezni = ZLATNI.cases.filter((c) => MORA.includes(c.class))
    expect(obavezni).toHaveLength(17)
    for (const c of ZLATNI.cases) {
      const pokriven = c.name in VRSTA || c.name in POPRAVKE_OBAVEZNIH || c.name in RUCNI
      expect(pokriven, c.name).toBe(true)
    }
  })
})

describe('M16 — obavezni slučajevi: port === prototip + D8/D11', () => {
  it.each(ZLATNI.cases.filter((c) => MORA.includes(c.class)).map((c) => [c.name, c] as const))(
    '%s',
    (_ime, c) => {
      const d = dekodirajSejv(c.raw, BASE)
      expect(d.stanje).toEqual(primeniDozvoljenaOdstupanja(c.S))
      const vrsta = VRSTA[c.name]
      if (vrsta) {
        expect(d).toMatchObject(vrsta)
      } else {
        const v = jeJsonObj(c.raw === null ? null : (JSON.parse(c.raw) as Json))
          ? objekat(JSON.parse(c.raw ?? 'null') as Json).v
          : undefined
        expect(d).toMatchObject({ vrsta: 'ok', izVerzije: v })
        if (d.vrsta === 'ok') expect(d.popravke).toEqual(POPRAVKE_OBAVEZNIH[c.name])
      }
    },
  )
})

describe('ručno izmenjeni i oštećeni: prototip + D8/D11 + navedene popravke (D10)', () => {
  it.each(Object.entries(RUCNI))('%s', (ime, ocekivano) => {
    const c = slucaj(ime)
    expect(MORA).not.toContain(c.class)
    const d = dekodirajSejv(c.raw, BASE)
    expect(d.vrsta).toBe('ok')
    if (d.vrsta !== 'ok') return
    expect(d.stanje).toEqual(ocekivano.stanje())
    expect(sortirano(d.popravke)).toEqual(sortirano(ocekivano.popravke))
  })
})

describe('M17 — idempotencija nad svih 33', () => {
  it.each(ZLATNI.cases.map((c) => [c.name, c] as const))('%s', (_ime, c) => {
    const prvi = dekodirajSejv(c.raw, BASE)
    const drugi = dekodirajSejv(kodirajSejv(prvi.stanje), BASE)
    expect(drugi.stanje).toEqual(prvi.stanje)
    expect(drugi).toMatchObject({ vrsta: 'ok', izVerzije: 3, popravke: [] })
  })
})
