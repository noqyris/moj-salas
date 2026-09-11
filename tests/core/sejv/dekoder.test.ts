/*
 * Dekoder i normalizacija (01 §h.5 M1–M3, M9–M13, M15, M18) + svojstva:
 * dekoder nikad ne baca, uvek gradi nov objekat, i SVAKO odbacivanje se prijavljuje (D10).
 */
import { describe, expect, it } from 'vitest'
import { MAX_PARCELA, VERZIJA_SEJVA } from '../../../src/config'
import {
  dekodirajSejv,
  kodirajSejv,
  normalizujV3,
  type DekodiranSejv,
} from '../../../src/core/sejv'
import { pocetnoStanje } from '../../../src/core/stanje'
import type { Stanje } from '../../../src/core/types'
import { MAG0, T0, mulberry32, narudzba } from '../../helpers'
import {
  bogatoStanje,
  jeJsonObj,
  json,
  prekrsajiOblika,
  v3PosleMigracije,
  type Json,
  type JsonObj,
} from './alati'

type Ok = Extract<DekodiranSejv, { vrsta: 'ok' }>

function kaoOk(d: DekodiranSejv): Ok {
  if (d.vrsta !== 'ok') throw new Error(`očekivano 'ok', dobijeno '${d.vrsta}'`)
  return d
}
const dek = (o: unknown): Ok => kaoOk(dekodirajSejv(JSON.stringify(o), T0))
const bogat = (): JsonObj => json(bogatoStanje()) as unknown as JsonObj
const sa = (izmene: JsonObj): JsonObj => ({ ...bogat(), ...izmene })
function bez(o: JsonObj, kljuc: string): JsonObj {
  const kopija = { ...o }
  Reflect.deleteProperty(kopija, kljuc)
  return kopija
}
const sortirano = (a: readonly string[]) => [...a].sort()

describe('M1 — prazno skladište', () => {
  it.each([null, ''])('%j → prazan; stanje = pocetnoStanje(now), videno = now', (raw) => {
    const d = dekodirajSejv(raw, T0)
    expect(d).toEqual({ vrsta: 'prazan', stanje: pocetnoStanje(T0) })
    expect(d.stanje.videno).toBe(T0)
    expect(dekodirajSejv(raw, T0 + 5).stanje.videno).toBe(T0 + 5)
  })

  it('svako dekodiranje gradi nov objekat (nema deljenih referenci)', () => {
    const a = dekodirajSejv(null, T0).stanje
    const b = dekodirajSejv(null, T0).stanje
    a.mag.psenica = 9
    a.parcele[0] = { c: 'psenica', t: T0, z: false }
    expect(b.mag.psenica).toBe(0)
    expect(b.parcele[0]).toEqual({ c: null, t: 0, z: false })
  })
})

describe('M2 — ne može da se pročita', () => {
  it.each([
    ['{"v":3,', 'json'],
    ['{', 'json'],
    ['undefined', 'json'],
    ['NaN', 'json'],
    ["{'v':3}", 'json'],
    ['{"v":3}x', 'json'],
    ['null', 'nije-objekat'],
    ['5', 'nije-objekat'],
    ['0', 'nije-objekat'],
    ['"x"', 'nije-objekat'],
    ['""', 'nije-objekat'],
    ['true', 'nije-objekat'],
    ['false', 'nije-objekat'],
    ['[]', 'nije-objekat'],
    ['[{"v":3}]', 'nije-objekat'],
  ] as const)('%s → neispravan (%s), početno stanje', (raw, razlog) => {
    expect(dekodirajSejv(raw, T0)).toEqual({
      vrsta: 'neispravan',
      razlog,
      stanje: pocetnoStanje(T0),
    })
  })
})

describe('M3 — verzija', () => {
  it.each([
    ['nedostaje', undefined],
    ['"3"', '3'],
    ['"2"', '2'],
    ['1', 1],
    ['0', 0],
    ['-3', -3],
    ['2.5', 2.5],
    ['4.5', 4.5],
    ['null', null],
    ['true', true],
    ['[3]', [3]],
  ] as const)('v: %s → neispravan (verzija), sadržaj se ne koristi', (_opis, v) => {
    const raw = JSON.stringify({ ...bez(bogat(), 'v'), v })
    expect(dekodirajSejv(raw, T0)).toEqual({
      vrsta: 'neispravan',
      razlog: 'verzija',
      stanje: pocetnoStanje(T0),
    })
  })

  it('v: 1e999 (Infinity iz JSON-a) → neispravan (verzija)', () => {
    expect(dekodirajSejv('{"v":1e999,"novac":7}', T0)).toMatchObject({
      vrsta: 'neispravan',
      razlog: 'verzija',
    })
  })

  it.each([4, 5, 99, 1e20])('v: %d (ceo, > VERZIJA_SEJVA) → buduci, početno stanje', (v) => {
    expect(v).toBeGreaterThan(VERZIJA_SEJVA)
    expect(dekodirajSejv(JSON.stringify(sa({ v })), T0)).toEqual({
      vrsta: 'buduci',
      verzija: v,
      stanje: pocetnoStanje(T0),
    })
  })

  it('v: 2 i v: 3 su podržane; "3.0" u JSON-u je broj 3', () => {
    expect(dek(sa({ v: 3 })).izVerzije).toBe(3)
    expect(dek({ v: 2 }).izVerzije).toBe(2)
    const d = kaoOk(dekodirajSejv('{"v":3.0,"novac":7}', T0))
    expect(d.izVerzije).toBe(3)
    expect(d.stanje.novac).toBe(7)
  })
})

describe('ispravan v3 prolazi netaknut', () => {
  it('bogato stanje: decode(encode(s)) = s, bez popravki, isti redosled ključeva', () => {
    const s = bogatoStanje()
    const d = kaoOk(dekodirajSejv(kodirajSejv(s), T0))
    expect(d.stanje).toEqual(s)
    expect(d.popravke).toEqual([])
    expect(Object.keys(d.stanje)).toEqual(Object.keys(pocetnoStanje(0)))
    expect(Object.keys(d.stanje.narudzbe[1] ?? {})).toEqual([
      'id',
      'ime',
      'emoji',
      'boja',
      'msg',
      'stavke',
      'din',
      'xp',
    ])
  })

  it('kodirajSejv je JSON.stringify stanja (isti oblik kao prototip L574)', () => {
    const s = bogatoStanje()
    expect(kodirajSejv(s)).toBe(JSON.stringify(s))
  })

  it('nasumična ispravna stanja (300, seed 7): identitet i bez popravki (čist sejv ne pravi rezervu)', async () => {
    const { nasumicnoStanje } = await import('./alati')
    const r = mulberry32(7)
    for (let i = 0; i < 300; i++) {
      const s = nasumicnoStanje(r, T0)
      const d = kaoOk(dekodirajSejv(kodirajSejv(s), T0))
      expect(d.popravke, `slučaj ${i}`).toEqual([])
      expect(d.stanje, `slučaj ${i}`).toEqual(s)
    }
  })
})

describe('M9 — podrazumevane vrednosti po podstablu', () => {
  it('{v:3} → sve podrazumevano (novac 50), bez popravki', () => {
    const d = dek({ v: 3 })
    expect(d.stanje).toEqual(pocetnoStanje(T0))
    expect(d.stanje.novac).toBe(50)
    expect(d.popravke).toEqual([])
  })

  const SMECE: [string, Json][] = [
    ['null', null],
    ['string "ab"', 'ab'],
    ['niz', [1, 2]],
    ['broj', 5],
  ]

  describe.each(['mag', 'stat', 'masine', 'ziv'] as const)('%s', (kljuc) => {
    it('nedostaje → samo to podstablo podrazumevano, bez popravke', () => {
      const d = dek(bez(bogat(), kljuc))
      expect(d.stanje).toEqual({ ...bogatoStanje(), [kljuc]: pocetnoStanje(T0)[kljuc] })
      expect(d.popravke).toEqual([])
    })
    it.each(SMECE)('%s → samo to podstablo podrazumevano + popravka', (_opis, vrednost) => {
      const d = dek(sa({ [kljuc]: vrednost }))
      expect(d.stanje).toEqual({ ...bogatoStanje(), [kljuc]: pocetnoStanje(T0)[kljuc] })
      expect(d.popravke).toEqual([`${kljuc}: zamenjeno`])
    })
  })

  describe.each([
    ['masine', 'mlin'],
    ['masine', 'kazan'],
    ['ziv', 'kokosinjac'],
    ['ziv', 'stala'],
  ] as const)('%s.%s', (grupa, id) => {
    const ocekivano = (): Stanje => {
      const s = bogatoStanje()
      const g: Record<string, { k: boolean; t: number }> = s[grupa]
      g[id] = { k: false, t: 0 }
      return s
    }
    const sejvSa = (dete: Json | undefined): JsonObj => {
      const o = bogat()
      const g = o[grupa]
      if (!jeJsonObj(g)) throw new Error('grupa')
      if (dete === undefined) Reflect.deleteProperty(g, id)
      else g[id] = dete
      return o
    }
    it('nedostaje → samo to dete podrazumevano (prototip spaja po detetu, L559–562)', () => {
      const d = dek(sejvSa(undefined))
      expect(d.stanje).toEqual(ocekivano())
      expect(d.popravke).toEqual([])
    })
    it.each(SMECE)('%s → samo to dete podrazumevano + popravka', (_opis, vrednost) => {
      const d = dek(sejvSa(vrednost))
      expect(d.stanje).toEqual(ocekivano())
      expect(d.popravke).toEqual([`${grupa}.${id}: zamenjeno`])
    })
  })
})

describe('M10 — delimične zgrade (paritet)', () => {
  it('masine: {kazan:{k:true}} → kazan {k:true,t:0} i mlin {k:false,t:0}', () => {
    const d = dek(sa({ masine: { kazan: { k: true } } }))
    expect(d.stanje.masine).toEqual({ mlin: { k: false, t: 0 }, kazan: { k: true, t: 0 } })
    expect(d.popravke).toEqual([])
  })

  it('nekupljena mašina sa t≠0 → t 0 (01 G7); kupljena radi dalje', () => {
    const d = dek(sa({ masine: { mlin: { k: false, t: T0 - 5 }, kazan: { k: true, t: T0 - 7 } } }))
    expect(d.stanje.masine).toEqual({ mlin: { k: false, t: 0 }, kazan: { k: true, t: T0 - 7 } })
    expect(d.popravke).toEqual(['masine.mlin.t: ispravljeno'])
  })

  it('kupljena životinja sa t ≤ 0 ili bez t → t = now (01 G8); nekupljena sa t → 0', () => {
    const d = dek(sa({ ziv: { kokosinjac: { k: true, t: 0 }, stala: { k: false, t: T0 - 9 } } }))
    expect(d.stanje.ziv).toEqual({ kokosinjac: { k: true, t: T0 }, stala: { k: false, t: 0 } })
    expect(sortirano(d.popravke)).toEqual([
      'ziv.kokosinjac.t: ispravljeno',
      'ziv.stala.t: ispravljeno',
    ])
    const bezT = dek(sa({ ziv: { kokosinjac: { k: true }, stala: { k: true, t: -4 } } }))
    expect(bezT.stanje.ziv).toEqual({ kokosinjac: { k: true, t: T0 }, stala: { k: true, t: T0 } })
  })

  it('k koje nije boolean se svodi sa !! (kao prototip), t koje nije broj → 0', () => {
    const d = dek(sa({ masine: { mlin: { k: 1, t: 'x' }, kazan: { k: 0, t: T0 } } }))
    expect(d.stanje.masine).toEqual({ mlin: { k: true, t: 0 }, kazan: { k: false, t: 0 } })
    expect(sortirano(d.popravke)).toEqual([
      'masine.kazan.k: ispravljeno',
      'masine.kazan.t: ispravljeno',
      'masine.mlin.k: ispravljeno',
      'masine.mlin.t: zamenjeno',
    ])
  })
})

describe('M11 — parcele', () => {
  it.each([
    ['nedostaje', undefined, []],
    ['[]', [], []],
    ['objekat', { 0: { c: 'psenica', t: 1, z: false } }, ['parcele: zamenjeno']],
    ['string', 'x', ['parcele: zamenjeno']],
    ['null', null, ['parcele: zamenjeno']],
  ] as const)('%s → 2 početne parcele', (_opis, parcele, popravke) => {
    const o = parcele === undefined ? bez(bogat(), 'parcele') : sa({ parcele: json(parcele) })
    const d = dek(o)
    expect(d.stanje.parcele).toEqual(pocetnoStanje(T0).parcele)
    expect(d.popravke).toEqual(popravke)
  })

  const PRAZNA = { c: null, t: 0, z: false }
  it.each([
    [
      'z:1 → true',
      { c: 'psenica', t: T0, z: 1 },
      { c: 'psenica', t: T0, z: true },
      ['parcele[0].z: ispravljeno'],
    ],
    ['bez z (v2) → false', { c: 'psenica', t: T0 }, { c: 'psenica', t: T0, z: false }, []],
    [
      't:null → 0',
      { c: 'psenica', t: null, z: false },
      { c: 'psenica', t: 0, z: false },
      ['parcele[0].t: zamenjeno'],
    ],
    [
      't:"5" → 0',
      { c: 'psenica', t: '5', z: false },
      { c: 'psenica', t: 0, z: false },
      ['parcele[0].t: zamenjeno'],
    ],
    [
      't:0 sa kulturom ostaje (L564 x.t||0)',
      { c: 'grozdje', t: 0, z: false },
      { c: 'grozdje', t: 0, z: false },
      [],
    ],
    [
      'višak polja',
      { c: 'psenica', t: T0, z: false, lvl: 9 },
      { c: 'psenica', t: T0, z: false },
      ['parcele[0].lvl: odbaceno'],
    ],
    [
      "c:'' → prazna",
      { c: '', t: null },
      PRAZNA,
      ['parcele[0].c: zamenjeno', 'parcele[0].t: zamenjeno'],
    ],
    [
      'prazna sa t/z → čista prazna',
      { c: null, t: 5, z: true },
      PRAZNA,
      ['parcele[0].t: zamenjeno', 'parcele[0].z: zamenjeno'],
    ],
    ['{} → prazna', {}, PRAZNA, []],
    ['prazna bez z (v2)', { c: null, t: 0 }, PRAZNA, []],
  ] as const)('%s', (_opis, ulaz, izlaz, popravke) => {
    const d = dek(sa({ parcele: [json(ulaz), PRAZNA] }))
    expect(d.stanje.parcele).toEqual([izlaz, PRAZNA])
    expect(sortirano(d.popravke)).toEqual(sortirano(popravke))
  })
})

describe('M12 — oštećene parcele ne ruše učitavanje (01 B3)', () => {
  it.each([null, 5, 'x', true, [], [1]])('parcela %j → prazna parcela', (x) => {
    const d = dek(
      sa({ parcele: [{ c: 'psenica', t: T0, z: false }, x, { c: 'paprika', t: T0, z: true }] }),
    )
    expect(d.stanje.parcele).toEqual([
      { c: 'psenica', t: T0, z: false },
      { c: null, t: 0, z: false },
      { c: 'paprika', t: T0, z: true },
    ])
    expect(d.popravke).toEqual(['parcele[1]: zamenjeno'])
  })

  it('nepoznata kultura (npr. iz novijeg builda) → prazna parcela + popravka', () => {
    const d = dek(
      sa({
        parcele: [
          { c: 'kukuruz', t: T0, z: true },
          { c: null, t: 0, z: false },
        ],
      }),
    )
    expect(d.stanje.parcele[0]).toEqual({ c: null, t: 0, z: false })
    expect(sortirano(d.popravke)).toEqual([
      'parcele[0].c: zamenjeno',
      'parcele[0].t: zamenjeno',
      'parcele[0].z: zamenjeno',
    ])
  })

  it(`${MAX_PARCELA} parcela ostaje, 12 → prvih ${MAX_PARCELA} (01 B10)`, () => {
    const parcele = Array.from({ length: 12 }, (_, i) => ({ c: 'psenica', t: T0 - i, z: false }))
    const devet = dek(sa({ parcele: parcele.slice(0, MAX_PARCELA) }))
    expect(devet.stanje.parcele).toEqual(parcele.slice(0, MAX_PARCELA))
    expect(devet.popravke).toEqual([])
    const d = dek(sa({ parcele }))
    expect(d.stanje.parcele).toEqual(parcele.slice(0, MAX_PARCELA))
    expect(d.popravke).toEqual([
      'parcele[9]: odbaceno',
      'parcele[10]: odbaceno',
      'parcele[11]: odbaceno',
    ])
  })
})

describe('M13 — narudžbine', () => {
  const o7 = (): JsonObj => json(narudzba(7, 'psenica', 3, 70, 6)) as unknown as JsonObj
  const o8 = (): JsonObj => json(narudzba(8, 'sargarepa', 1, 80, 6)) as unknown as JsonObj
  const sa7 = (izmene: JsonObj): JsonObj => ({ ...o7(), ...izmene })

  it.each([
    ['bez stavki', bez(o7(), 'stavke')],
    ['stavke []', sa7({ stavke: [] })],
    ['stavke nije niz', sa7({ stavke: 'x' })],
    ['stavka null', sa7({ stavke: [null] })],
    ['nepoznat artikal', sa7({ stavke: [{ k: 'kukuruz', kom: 1 }] })],
    ['kom 0', sa7({ stavke: [{ k: 'psenica', kom: 0 }] })],
    ['kom -1', sa7({ stavke: [{ k: 'psenica', kom: -1 }] })],
    ['kom 1.5', sa7({ stavke: [{ k: 'psenica', kom: 1.5 }] })],
    ['kom "2"', sa7({ stavke: [{ k: 'psenica', kom: '2' }] })],
    [
      'druga stavka loša',
      sa7({
        stavke: [
          { k: 'psenica', kom: 1 },
          { k: 'x', kom: 1 },
        ],
      }),
    ],
    ['bez id', bez(o7(), 'id')],
    ['id 0', sa7({ id: 0 })],
    ['id -1', sa7({ id: -1 })],
    ['id 1.5', sa7({ id: 1.5 })],
    ['id "abc"', sa7({ id: 'abc' })],
    ['id ""', sa7({ id: '' })],
    ['id "0"', sa7({ id: '0' })],
    ['id "-3"', sa7({ id: '-3' })],
    ['id null', sa7({ id: null })],
    ['id true', sa7({ id: true })],
    ['id 1e20 (nije bezbedan ceo broj)', sa7({ id: 1e20 })],
    ['bez din', bez(o7(), 'din')],
    ['din "70"', sa7({ din: '70' })],
    ['xp null', sa7({ xp: null })],
    ['narudžbina je broj', 5],
    ['narudžbina je null', null],
    ['narudžbina je niz', []],
  ] as const)('%s → odbačena, ostale ostaju', (_opis, losa) => {
    const d = dek(sa({ narudzbe: [losa, o8()] }))
    expect(d.stanje.narudzbe).toEqual([o8()])
    expect(d.popravke).toEqual(['narudzbe[0]: odbaceno'])
  })

  it("string id '9' → 9 (prototip bi je zaglavio: x.id === +dataset nikad ne važi)", () => {
    const d = dek(sa({ narudzbe: [sa7({ id: '9' }), o8()] }))
    expect(d.stanje.narudzbe.map((o) => o.id)).toEqual([9, 8])
    expect(d.popravke).toEqual(['narudzbe[0].id: ispravljeno'])
  })

  it('dupli id → prva ostaje, kasnija odbačena (i kad je id string)', () => {
    const d = dek(sa({ narudzbe: [o7(), { ...o8(), id: 7 }, { ...o8(), id: '7' }, o8()] }))
    expect(d.stanje.narudzbe).toEqual([o7(), o8()])
    expect(d.popravke).toEqual(['narudzbe[1]: odbaceno', 'narudzbe[2]: odbaceno'])
  })

  it('3 ispravne narudžbine → sve 3 ostaju (paritet; broj se sam svede na 2)', () => {
    const tri = [o7(), o8(), { ...o8(), id: 9 }]
    const d = dek(sa({ narudzbe: tri }))
    expect(d.stanje.narudzbe).toEqual(tri)
    expect(d.popravke).toEqual([])
  })

  it('narudzbe nije niz → [] (L565)', () => {
    expect(dek(sa({ narudzbe: 'x' }))).toMatchObject({
      stanje: { narudzbe: [] },
      popravke: ['narudzbe: zamenjeno'],
    })
    expect(dek(bez(bogat(), 'narudzbe'))).toMatchObject({ stanje: { narudzbe: [] }, popravke: [] })
  })

  it('višak polja u narudžbini i stavci se odbacuje, narudžbina ostaje', () => {
    const d = dek(
      sa({ narudzbe: [sa7({ hitno: true, stavke: [{ k: 'psenica', kom: 3, cena: 1 }] })] }),
    )
    expect(d.stanje.narudzbe).toEqual([o7()])
    expect(sortirano(d.popravke)).toEqual([
      'narudzbe[0].hitno: odbaceno',
      'narudzbe[0].stavke[0].cena: odbaceno',
    ])
  })

  it('ime/emoji/boja/msg koji nisu string → prazno / poruka mušterije + popravka', () => {
    const d = dek(sa({ narudzbe: [sa7({ emoji: 5, boja: null, msg: 7 })] }))
    expect(d.stanje.narudzbe[0]).toEqual({
      ...o7(),
      emoji: '',
      boja: '',
      msg: 'Za unučiće spremam ručak…',
    })
    expect(sortirano(d.popravke)).toEqual([
      'narudzbe[0].boja: zamenjeno',
      'narudzbe[0].emoji: zamenjeno',
      'narudzbe[0].msg: zamenjeno',
    ])
  })

  it('v3 narudžbina bez msg → prva poruka mušterije (D8), bez popravke; nepoznata mušterija → ""', () => {
    const d = dek(sa({ narudzbe: [bez(o7(), 'msg'), { ...bez(o8(), 'msg'), ime: 'Neko Treći' }] }))
    expect(d.stanje.narudzbe.map((o) => o.msg)).toEqual(['Za unučiće spremam ručak…', ''])
    expect(d.popravke).toEqual([])
  })

  it('din/xp su konačni brojevi i prenose se kakvi jesu (01 §h.3)', () => {
    const d = dek(sa({ narudzbe: [sa7({ din: 70.5, xp: 2 })] }))
    expect(d.stanje.narudzbe[0]).toMatchObject({ din: 70.5, xp: 2 })
  })
})

describe('M15 — skalarno smeće', () => {
  it.each([
    ['novac:null', { novac: null }, { novac: 50 }, ['novac: zamenjeno']],
    ['novac:"5"', { novac: '5' }, { novac: 50 }, ['novac: zamenjeno']],
    ['xp:"5"', { xp: '5' }, { xp: 0 }, ['xp: zamenjeno']],
    ['xp:[]', { xp: [] }, { xp: 0 }, ['xp: zamenjeno']],
    ['mute:"yes" → !!', { mute: 'yes' }, { mute: true }, ['mute: ispravljeno']],
    ['mute:0 → !!', { mute: 0 }, { mute: false }, ['mute: ispravljeno']],
    ['sadio:1 → !!', { sadio: 1 }, { sadio: true }, ['sadio: ispravljeno']],
    ['poklonDan:5', { poklonDan: 5 }, { poklonDan: '' }, ['poklonDan: zamenjeno']],
    ['poklonDan:null', { poklonDan: null }, { poklonDan: '' }, ['poklonDan: zamenjeno']],
    ['videno:null', { videno: null }, { videno: T0 }, ['videno: zamenjeno']],
    ['videno:0', { videno: 0 }, { videno: T0 }, ['videno: zamenjeno']],
    ['videno:-5', { videno: -5 }, { videno: T0 }, ['videno: zamenjeno']],
    ['videno:"x"', { videno: 'x' }, { videno: T0 }, ['videno: zamenjeno']],
  ] as const)('%s', (_opis, ulaz, izlaz, popravke) => {
    const d = dek(sa(json(ulaz)))
    expect(d.stanje).toEqual({ ...bogatoStanje(), ...izlaz })
    expect(d.popravke).toEqual(popravke)
  })

  it('konačni novac/xp se prenose kakvi jesu, kao prototip (01 §h.3)', () => {
    expect(dek(sa({ novac: -5, xp: 12.5 })).stanje).toMatchObject({ novac: -5, xp: 12.5 })
  })

  it.each([
    ['"3"', '3', 0, 'zamenjeno'],
    ['3.7', 3.7, 3, 'ispravljeno'],
    ['-2', -2, 0, 'zamenjeno'],
    ['null', null, 0, 'zamenjeno'],
    ['true', true, 0, 'zamenjeno'],
  ] as const)('mag.psenica %s → %d (nema "3"+2 = "32")', (_opis, x, ocekivano, vrsta) => {
    const d = dek(sa({ mag: { ...MAG0, psenica: x } }))
    expect(d.stanje.mag).toEqual({ ...MAG0, psenica: ocekivano })
    expect(d.popravke).toEqual([`mag.psenica: ${vrsta}`])
  })

  it('06 bug 1: zatrovan magacin `"null": null` se čisti (inače magPrazan() zauvek false)', () => {
    const d = dek(sa({ mag: { ...MAG0, psenica: 2, null: null } }))
    expect(d.stanje.mag).toEqual({ ...MAG0, psenica: 2 })
    expect(d.popravke).toEqual(['mag.null: odbaceno'])
  })

  it('stat: nepoznat ključ i loša vrednost', () => {
    const d = dek(sa({ stat: { ubrano: 'x', zaradjeno: 5, isporuke: 1, rekord: 9 } }))
    expect(d.stanje.stat).toEqual({ ubrano: 0, zaradjeno: 5, isporuke: 1 })
    expect(sortirano(d.popravke)).toEqual(['stat.rekord: odbaceno', 'stat.ubrano: zamenjeno'])
  })

  it('Infinity (1e999) i -0 iz JSON-a nikad ne stižu u stanje', () => {
    const raw = JSON.stringify(bogatoStanje())
      .replace('"novac":1234', '"novac":1e999')
      .replace('"xp":5000', '"xp":-1e999')
      .replace('"psenica":5', '"psenica":-0')
      .replace('"videno":' + String(T0 - 3_600_000), '"videno":1e999')
      .replace(`"t":${T0 - 30_000}`, '"t":1e999')
      .replace('"din":70', '"din":-0')
    const d = kaoOk(dekodirajSejv(raw, T0))
    expect(d.stanje).toMatchObject({ novac: 50, xp: 0, videno: T0 })
    expect(d.stanje.masine.mlin).toEqual({ k: true, t: 0 })
    expect(Object.is(d.stanje.mag.psenica, 0)).toBe(true)
    expect(Object.is(d.stanje.narudzbe[0]?.din, 0)).toBe(true)
    expect(json(d.stanje)).toEqual(d.stanje)
    expect(prekrsajiOblika(d.stanje)).toEqual([])
  })
})

describe('M18 — nepoznati ključevi na svakom nivou', () => {
  it('se odbacuju i svaki se prijavljuje; rezultat je Stanje tačnog oblika', () => {
    const s = bogatoStanje()
    const [p0, ...ostaleParcele] = s.parcele
    const o = {
      ...s,
      nepoznato: { dubina: [1, 2] },
      mag: { ...s.mag, tursija: 7 },
      stat: { ...s.stat, rekord: 9 },
      masine: { ...s.masine, susara: { k: true, t: 0 }, mlin: { ...s.masine.mlin, lvl: 2 } },
      ziv: { ...s.ziv, svinje: { k: true, t: 0 }, stala: { ...s.ziv.stala, ime: 'Milka' } },
      parcele: [{ ...p0, djubrivo: true }, ...ostaleParcele],
      narudzbe: [
        {
          ...narudzba(7, 'psenica', 3, 70, 6),
          hitno: true,
          stavke: [{ k: 'psenica', kom: 3, cena: 1 }],
        },
        {
          id: 9,
          ko: { ime: 'Baka Mira', emoji: '👵', boja: '#fff', glas: 'tih' },
          stavke: [{ k: 'jaje', kom: 2 }],
          din: 120,
          xp: 9,
        },
      ],
    }
    const d: Ok = dek(o)
    const rezultat: Stanje = d.stanje
    expect(prekrsajiOblika(rezultat)).toEqual([])
    expect(rezultat).toEqual({
      ...bogatoStanje(),
      narudzbe: [
        narudzba(7, 'psenica', 3, 70, 6),
        {
          id: 9,
          ime: 'Baka Mira',
          emoji: '👵',
          boja: '#fff',
          msg: 'Za unučiće spremam ručak…',
          stavke: [{ k: 'jaje', kom: 2 }],
          din: 120,
          xp: 9,
        },
      ],
    })
    expect(sortirano(d.popravke)).toEqual(
      sortirano([
        'nepoznato: odbaceno',
        'mag.tursija: odbaceno',
        'stat.rekord: odbaceno',
        'masine.susara: odbaceno',
        'masine.mlin.lvl: odbaceno',
        'ziv.svinje: odbaceno',
        'ziv.stala.ime: odbaceno',
        'parcele[0].djubrivo: odbaceno',
        'narudzbe[0].hitno: odbaceno',
        'narudzbe[0].stavke[0].cena: odbaceno',
        'narudzbe[1].ko.glas: odbaceno',
      ]),
    )
  })
})

describe('nov objekat, nikad ne baca', () => {
  function objektiU(x: unknown, skup = new Set<object>()): Set<object> {
    if (typeof x === 'object' && x !== null) {
      skup.add(x)
      for (const v of Object.values(x)) objektiU(v, skup)
    }
    return skup
  }

  it('normalizujV3 ne deli nijedan objekat sa ulazom i ne menja ulaz', () => {
    const ulaz = { ...bogat(), narudzbe: v3PosleMigracije(mulberry32(5), T0).narudzbe ?? [] }
    const snimak = json(ulaz)
    const { stanje } = normalizujV3(ulaz, T0)
    expect(ulaz).toEqual(snimak)
    const izUlaza = objektiU(ulaz)
    for (const o of objektiU(stanje)) expect(izUlaza.has(o)).toBe(false)
  })

  // Seedovan fuzz: nasumične mutacije ispravnih sejvova + čist šum. Za svaki ulaz:
  // ne baca, oblik je ispravan, nema NaN/Infinity/-0, i ponovno dekodiranje je identitet
  // BEZ popravki (dakle sledeće učitavanje ne prepisuje rezervu).
  const VREDNOSTI: Json[] = [
    null,
    true,
    false,
    0,
    1,
    -1,
    2.5,
    5e20,
    '',
    'x',
    '3',
    'psenica',
    'kukuruz',
    [],
    [1, 'a'],
    {},
    { c: 'psenica', t: 1 },
    { k: true },
    { id: 1, stavke: [{ k: 'jaje', kom: 1 }], din: 5, xp: 3 },
    '__INF__',
    '__MINUS0__',
  ]
  function mutiraj(o: Json, r: () => number, dubina = 0): Json {
    if (Array.isArray(o)) {
      return o.map((x) =>
        r() < 0.15
          ? (VREDNOSTI[Math.floor(r() * VREDNOSTI.length)] ?? null)
          : mutiraj(x, r, dubina + 1),
      )
    }
    if (!jeJsonObj(o)) return o
    const izlaz: JsonObj = {}
    for (const [k, v] of Object.entries(o)) {
      const x = r()
      if (x < 0.08) continue
      izlaz[k] =
        x < 0.2
          ? (VREDNOSTI[Math.floor(r() * VREDNOSTI.length)] ?? null)
          : mutiraj(v, r, dubina + 1)
    }
    if (r() < 0.1)
      izlaz['k' + Math.floor(r() * 5)] = VREDNOSTI[Math.floor(r() * VREDNOSTI.length)] ?? null
    return izlaz
  }
  function samoBrisanje(o: Json, r: () => number): Json {
    if (Array.isArray(o)) return o.map((x) => samoBrisanje(x, r))
    if (!jeJsonObj(o)) return o
    const izlaz: JsonObj = {}
    for (const [k, v] of Object.entries(o))
      if (k === 'v' || r() > 0.12) izlaz[k] = samoBrisanje(v, r)
    return izlaz
  }
  /** Listovi JSON stabla (prazni objekti/nizovi ne nose podatke i preskaču se). */
  function listovi(
    x: unknown,
    putanja = '',
    izlaz = new Map<string, unknown>(),
  ): Map<string, unknown> {
    if (Array.isArray(x)) x.forEach((v, i) => listovi(v, `${putanja}[${i}]`, izlaz))
    else if (typeof x === 'object' && x !== null) {
      for (const [k, v] of Object.entries(x)) listovi(v, putanja ? `${putanja}.${k}` : k, izlaz)
    } else izlaz.set(putanja, x)
    return izlaz
  }
  function sum(r: () => number, dubina: number): Json {
    const x = r()
    if (dubina <= 0 || x < 0.4) return VREDNOSTI[Math.floor(r() * VREDNOSTI.length)] ?? null
    if (x < 0.6) return Array.from({ length: Math.floor(r() * 4) }, () => sum(r, dubina - 1))
    const o: JsonObj = {}
    const kljucevi = [
      'v',
      'novac',
      'parcele',
      'mag',
      'masine',
      'ziv',
      'narudzbe',
      'stavke',
      'id',
      'c',
      't',
      'k',
      'ko',
      'mlin',
    ]
    for (let i = 0; i < 4; i++)
      o[kljucevi[Math.floor(r() * kljucevi.length)] ?? 'v'] = sum(r, dubina - 1)
    return o
  }

  it('3000 seedovanih oštećenih sejvova: nikad ne baca, uvek ispravno Stanje, idempotentno', async () => {
    const { nasumicanV2 } = await import('./alati')
    const r = mulberry32(2026)
    const vrste = new Map<string, number>()
    let bezPopravki = 0
    for (let i = 0; i < 3000; i++) {
      const baza: Json =
        i % 4 === 0
          ? (json(bogatoStanje()) as unknown as Json)
          : i % 4 === 1
            ? v3PosleMigracije(r, T0)
            : i % 4 === 2
              ? nasumicanV2(r, T0)
              : sum(r, 4)
      // Pola bogatih sejvova samo gubi ključeve (popunjavanje nije popravka) — za proveru bez gubitka.
      const o = i % 4 === 3 ? baza : i % 8 === 0 ? samoBrisanje(baza, r) : mutiraj(baza, r)
      if (jeJsonObj(o) && i % 4 !== 3 && r() < 0.9) o.v = jeJsonObj(baza) ? (baza.v ?? 3) : 3
      const raw = JSON.stringify(o)
        .replaceAll('"__INF__"', '1e999')
        .replaceAll('"__MINUS0__"', '-0')
      let d: DekodiranSejv | undefined
      expect(() => {
        d = dekodirajSejv(raw, T0)
      }, raw).not.toThrow()
      if (!d) continue
      vrste.set(d.vrsta, (vrste.get(d.vrsta) ?? 0) + 1)
      expect(prekrsajiOblika(d.stanje), raw).toEqual([])
      expect(json(d.stanje)).toEqual(d.stanje)
      const opet = kaoOk(dekodirajSejv(kodirajSejv(d.stanje), T0))
      expect(opet.stanje, raw).toEqual(d.stanje)
      expect(opet.popravke, raw).toEqual([])
      // D10 obrnuto: bez popravki NIŠTA iz v3 ulaza nije izgubljeno (svaki list je u izlazu).
      const ulaz: unknown = JSON.parse(raw)
      if (
        d.vrsta === 'ok' &&
        d.izVerzije === 3 &&
        d.popravke.length === 0 &&
        !raw.includes('"ko"')
      ) {
        bezPopravki++
        const izlaz = listovi(d.stanje)
        for (const [putanja, v] of listovi(ulaz)) {
          expect(
            izlaz.has(putanja) && izlaz.get(putanja) === v,
            `${putanja} izgubljen: ${raw}`,
          ).toBe(true)
        }
      }
    }
    expect(bezPopravki).toBeGreaterThan(30)
    // Fuzz mora da pogađa sve grane, ne samo 'neispravan'.
    expect(vrste.get('ok')).toBeGreaterThan(1500)
    expect(vrste.get('neispravan')).toBeGreaterThan(50)
  })
})

describe('D10 — svako odbacivanje se prijavljuje (iscrpno nad svim putanjama)', () => {
  interface Mesto {
    putanja: string
    vrednost: Json
    postavi(v: Json): void
  }
  /** Sve putanje u JSON stablu, u formatu popravki: `mag.psenica`, `narudzbe[0].stavke[1].k`. */
  function mesta(x: Json, putanja = '', izlaz: Mesto[] = []): Mesto[] {
    if (Array.isArray(x)) {
      x.forEach((v, i) => {
        const p = `${putanja}[${i}]`
        izlaz.push({ putanja: p, vrednost: v, postavi: (n) => (x[i] = n) })
        mesta(v, p, izlaz)
      })
    } else if (jeJsonObj(x)) {
      for (const [k, v] of Object.entries(x)) {
        const p = putanja ? `${putanja}.${k}` : k
        izlaz.push({ putanja: p, vrednost: v, postavi: (n) => (x[k] = n) })
        mesta(v, p, izlaz)
      }
    }
    return izlaz
  }
  const naPutanji = (o: JsonObj, putanja: string): Mesto => {
    const m = mesta(o).find((x) => x.putanja === putanja)
    if (!m) throw new Error(`nema putanje ${putanja}`)
    return m
  }
  const vrsta = (x: Json) => (x === null ? 'null' : Array.isArray(x) ? 'niz' : typeof x)
  const ZAMENE: Json[] = [null, true, 7, 'x', [1], { a: 1 }]
  const putanjaPopravke = (p: string) => p.slice(0, p.lastIndexOf(': '))
  const roditelj = (p: string) => p.replace(/(\.[^.[\]]+|\[\d+\])$/, '')
  const ispod = (p: string, pretk: string) =>
    p === pretk || p.startsWith(pretk + '.') || p.startsWith(pretk + '[')
  /** Popravka na toj putanji, na pretku (npr. cela narudžbina odbačena), ili na bratu unutar
   *  istog (ne-korenskog) roditelja: `parcele[0].c ← null` je ispravna prazna parcela, a gube se
   *  (i prijavljuju) njeni `t` i `z`. */
  const pokriva = (popravke: string[], putanja: string) =>
    popravke
      .map(putanjaPopravke)
      .some((p) => ispod(putanja, p) || (roditelj(putanja) !== '' && ispod(p, roditelj(putanja))))

  const baze: [string, () => JsonObj][] = [
    ['bogat v3', bogat],
    ['v3 posle migracije (ko narudžbine)', () => v3PosleMigracije(mulberry32(11), T0)],
  ]

  it.each(baze)('%s: zamena bilo koje vrednosti drugim tipom → prijavljena', (_ime, baza) => {
    let provereno = 0
    for (const { putanja, vrednost } of mesta(baza())) {
      for (const zamena of ZAMENE) {
        if (vrsta(vrednost) === vrsta(zamena)) continue
        const o = baza()
        naPutanji(o, putanja).postavi(zamena)
        const d = dekodirajSejv(JSON.stringify(o), T0)
        provereno++
        if (d.vrsta !== 'ok') {
          // Samo loša verzija obara ceo sejv — a tada ide ceo u rezervu.
          expect(putanja).toBe('v')
          expect(d).toMatchObject({ vrsta: 'neispravan', razlog: 'verzija' })
          continue
        }
        const opis = `${putanja} ← ${JSON.stringify(zamena)}: [${d.popravke.join(' | ')}]`
        expect(pokriva(d.popravke, putanja), opis).toBe(true)
      }
    }
    expect(provereno).toBeGreaterThan(300)
  })

  it.each(baze)(
    '%s: nepoznat ključ u bilo kom objektu → tačno taj ključ prijavljen',
    (_ime, baza) => {
      const objekti = [
        '',
        ...mesta(baza())
          .filter((m) => jeJsonObj(m.vrednost))
          .map((m) => m.putanja),
      ]
      for (const putanja of objekti) {
        const o = baza()
        const kontejner = putanja === '' ? o : naPutanji(o, putanja).vrednost
        if (!jeJsonObj(kontejner)) throw new Error(putanja)
        kontejner.nepoznat = 1
        const d = kaoOk(dekodirajSejv(JSON.stringify(o), T0))
        expect(d.popravke, putanja).toContain(
          putanja ? `${putanja}.nepoznat: odbaceno` : 'nepoznat: odbaceno',
        )
      }
      expect(objekti.length).toBeGreaterThan(15)
    },
  )
})
