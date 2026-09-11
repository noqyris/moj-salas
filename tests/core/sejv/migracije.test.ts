/*
 * Lanac migracija i v2 → v3 (01 §c.3, §h.2; h.5 M5–M8). R3 (M4) je u r3-migracija.test.ts.
 */
import { describe, expect, it } from 'vitest'
import { NAJSTARIJA_VERZIJA_SEJVA, VERZIJA_SEJVA } from '../../../src/config'
import {
  MIGRACIJE,
  dekodirajSejv,
  pokreniMigracije,
  v2uV3,
  type DekodiranSejv,
  type Migracija,
} from '../../../src/core/sejv'
import { MAG0, T0 } from '../../helpers'
import { bogatoStanje, json, v2Test4, type JsonObj } from './alati'

type Ok = Extract<DekodiranSejv, { vrsta: 'ok' }>
function dek(o: unknown): Ok {
  const d = dekodirajSejv(JSON.stringify(o), T0)
  if (d.vrsta !== 'ok') throw new Error(`očekivano 'ok', dobijeno '${d.vrsta}'`)
  return d
}
function bez(o: JsonObj, ...kljucevi: string[]): JsonObj {
  const kopija = { ...o }
  for (const k of kljucevi) Reflect.deleteProperty(kopija, k)
  return kopija
}

describe('v2uV3 (prototip L566 + D11)', () => {
  it('kazan/kazanT prelaze u masine.kazan i nestaju sa vrha; ostalo netaknuto; ulaz se ne menja', () => {
    const ulaz = { v: 2, novac: 1, kazan: true, kazanT: 123, nesto: { a: 1 } }
    const snimak = json(ulaz)
    const popravke: string[] = []
    const izlaz = v2uV3(ulaz, popravke)
    expect(izlaz).toEqual({
      v: 3,
      novac: 1,
      nesto: { a: 1 },
      masine: { kazan: { k: true, t: 123 } },
    })
    expect(Object.keys(izlaz)).not.toContain('kazan')
    expect(Object.keys(izlaz)).not.toContain('kazanT')
    expect(ulaz).toEqual(snimak)
    expect(popravke).toEqual([]) // premeštanje nije gubitak
  })

  it('bez kazan/kazanT → {k: !!undefined, t: undefined || 0} = {k:false, t:0}', () => {
    expect(v2uV3({ v: 2 })).toEqual({ v: 3, masine: { kazan: { k: false, t: 0 } } })
  })

  it('postojeći `masine`: vrednosti sa vrha pregaze kazan (L566), mlin ostaje; pregaženo se beleži', () => {
    const popravke: string[] = []
    const izlaz = v2uV3(
      {
        v: 2,
        kazan: false,
        kazanT: 0,
        masine: { mlin: { k: true, t: 5 }, kazan: { k: true, t: 123 } },
      },
      popravke,
    )
    expect(izlaz.masine).toEqual({ mlin: { k: true, t: 5 }, kazan: { k: false, t: 0 } })
    expect(popravke).toEqual(['masine.kazan.k: zamenjeno', 'masine.kazan.t: zamenjeno'])
  })

  it('isti kazan u `masine` i na vrhu → ništa nije pregaženo', () => {
    const popravke: string[] = []
    v2uV3({ v: 2, kazan: true, kazanT: 7, masine: { kazan: { k: true, t: 7 } } }, popravke)
    expect(popravke).toEqual([])
  })

  it('kazan koji nije boolean se svodi sa !! i beleži', () => {
    const popravke: string[] = []
    expect(v2uV3({ v: 2, kazan: 1 }, popravke).masine).toEqual({ kazan: { k: true, t: 0 } })
    expect(popravke).toEqual(['kazan: ispravljeno'])
  })
})

describe('pokreniMigracije', () => {
  it(`MIGRACIJE ima korak za svaku verziju od ${NAJSTARIJA_VERZIJA_SEJVA} do ${VERZIJA_SEJVA - 1}`, () => {
    for (let v = NAJSTARIJA_VERZIJA_SEJVA; v < VERZIJA_SEJVA; v++) {
      expect(MIGRACIJE[v]).toBeTypeOf('function')
    }
    expect(MIGRACIJE[VERZIJA_SEJVA]).toBeUndefined()
  })

  it('tekuća verzija se vraća kao isti objekat (bez koraka)', () => {
    const o = { v: VERZIJA_SEJVA, novac: 5 }
    expect(pokreniMigracije(o)).toBe(o)
  })

  it('v2 prolazi kroz v2uV3', () => {
    expect(pokreniMigracije({ v: 2, kazan: true, kazanT: 9 })).toEqual({
      v: 3,
      masine: { kazan: { k: true, t: 9 } },
    })
  })

  it('lanac ide korak po korak, redom, i prosleđuje popravke', () => {
    const redosled: number[] = []
    const korak =
      (od: number): Migracija =>
      (o, popravke) => {
        redosled.push(od)
        popravke?.push(`v${od}`)
        return { ...o, v: od + 1 }
      }
    const popravke: string[] = []
    const izlaz = pokreniMigracije({ v: 1, a: 1 }, popravke, { 1: korak(1), 2: korak(2) })
    expect(izlaz).toEqual({ v: 3, a: 1 })
    expect(redosled).toEqual([1, 2])
    expect(popravke).toEqual(['v1', 'v2'])
  })

  it.each([
    ['v:1 (nema koraka)', 1, /nema migracije iz v1/],
    ['v:"3"', '3', /ne može da se migrira/],
    ['v:2.5', 2.5, /ne može da se migrira/],
    ['v:4 (budući)', 4, /ne može da se migrira/],
    ['bez v', undefined, /ne može da se migrira/],
  ])('%s → baca (dekoder ovo nikad ne traži)', (_opis, v, poruka) => {
    expect(() => pokreniMigracije({ v })).toThrow(poruka)
  })

  it('korak koji ne podigne v tačno za 1 → baca', () => {
    expect(() => pokreniMigracije({ v: 2 }, [], { 2: (o) => ({ ...o, v: 4 }) })).toThrow(
      /mora da vrati v3/,
    )
    expect(() => pokreniMigracije({ v: 2 }, [], { 2: (o) => ({ ...o }) })).toThrow(
      /mora da vrati v3/,
    )
  })
})

describe('M5 — v2 sa kazanom koji kuva', () => {
  it('kazanT = T0 − 60 000 → masine.kazan.t sačuvan (tura se završava na prvom ticku)', () => {
    const d = dek({ ...v2Test4(), kazanT: T0 - 60_000 })
    expect(d.stanje.masine).toEqual({
      mlin: { k: false, t: 0 },
      kazan: { k: true, t: T0 - 60_000 },
    })
    expect(d.popravke).toEqual([])
  })
})

describe('M6 — v2 kazan sa lošim kombinacijama', () => {
  it('kazan:false, kazanT>0 → k:false, t:0 (01 G7: inače nestoRaste() zauvek true) + popravka', () => {
    const d = dek({ ...v2Test4(), kazan: false, kazanT: T0 - 60_000 })
    expect(d.stanje.masine.kazan).toEqual({ k: false, t: 0 })
    expect(d.popravke).toEqual(['masine.kazan.t: ispravljeno'])
  })

  it('v2 sa `masine`: kazan sa vrha pobeđuje, mlin iz `masine` ostaje', () => {
    const d = dek({
      ...v2Test4(),
      kazan: false,
      masine: { mlin: { k: true, t: 0 }, kazan: { k: true, t: 123 } },
    })
    expect(d.stanje.masine).toEqual({ mlin: { k: true, t: 0 }, kazan: { k: false, t: 0 } })
    expect(d.popravke).toEqual(['masine.kazan.k: zamenjeno', 'masine.kazan.t: zamenjeno'])
  })

  it('kazanT koji nije broj → t 0 + popravka', () => {
    const d = dek({ ...v2Test4(), kazanT: 'sutra' })
    expect(d.stanje.masine.kazan).toEqual({ k: true, t: 0 })
    expect(d.popravke).toEqual(['masine.kazan.t: zamenjeno'])
  })
})

describe('M7 — v2 polja kojih možda nema', () => {
  it('bez videno → videno = now (nema lažnog „Dobro došao nazad")', () => {
    expect(dek(bez(v2Test4(), 'videno')).stanje.videno).toBe(T0)
    expect(dek({ ...bez(v2Test4(), 'videno'), v: 2 }).popravke).toEqual([])
  })

  it('sa stat/poklonDan → preneti (stat spojen preko nula)', () => {
    const d = dek({ ...v2Test4(), stat: { ubrano: 9, zaradjeno: 99 }, poklonDan: '2026-01-01' })
    expect(d.stanje.stat).toEqual({ ubrano: 9, zaradjeno: 99, isporuke: 0 })
    expect(d.stanje.poklonDan).toBe('2026-01-01')
    expect(d.popravke).toEqual([])
  })

  it('bez sadio/mute/poklonDan → false/false/""', () => {
    const d = dek(bez(v2Test4(), 'sadio', 'mute'))
    expect(d.stanje).toMatchObject({ sadio: false, mute: false, poklonDan: '' })
  })

  it('magacin: 6 v2 ključeva preneto, brasno/jaje/mleko = 0, bez popravki', () => {
    const d = dek(v2Test4())
    expect(d.stanje.mag).toEqual({ ...MAG0, psenica: 3, paprika: 2, grozdje: 1, ajvar: 1 })
    expect(d.popravke).toEqual([])
  })
})

describe('M8 — v3 kakav prototip zapiše posle migracije', () => {
  it('v2 narudžbine se spljošte, kazan/kazanT sa vrha odbace, a masine iz v3 ostaju NETAKNUTE', () => {
    const v3 = json(bogatoStanje()) as unknown as JsonObj
    const d = dek({
      ...v3,
      masine: { mlin: { k: false, t: 0 }, kazan: { k: false, t: 0 } },
      kazan: true, // stari v2 ostatak: za v3 ga prototip ignoriše (L566 samo za v===2)
      kazanT: T0 - 1,
      narudzbe: v2Test4().narudzbe ?? [],
    })
    expect(d.izVerzije).toBe(3)
    expect(d.stanje.masine).toEqual({ mlin: { k: false, t: 0 }, kazan: { k: false, t: 0 } })
    expect(Object.keys(d.stanje)).not.toContain('kazan')
    expect(Object.keys(d.stanje)).not.toContain('kazanT')
    expect(d.stanje.narudzbe).toEqual([
      {
        id: 5,
        ime: 'Baka Mira',
        emoji: '👵',
        boja: '#fff',
        msg: 'Za unučiće spremam ručak…',
        stavke: [{ k: 'psenica', kom: 2 }],
        din: 60,
        xp: 5,
      },
      {
        id: 6,
        ime: 'Piljar Pera',
        emoji: '🧢',
        boja: '#fff',
        msg: 'Tezga mi je poluprazna…',
        stavke: [{ k: 'sargarepa', kom: 1 }],
        din: 80,
        xp: 6,
      },
    ])
    // kazan/kazanT u v3 nisu premešteni nigde — to je gubitak, pa ide rezerva (D10).
    expect(d.popravke).toEqual(['kazan: odbaceno', 'kazanT: odbaceno'])
  })

  it('v2 narudžbina sa ko koji nije objekat: ime/emoji/boja prazni, ko odbačen', () => {
    const d = dek({
      ...v2Test4(),
      narudzbe: [{ id: 5, ko: 'Baka', stavke: [{ k: 'psenica', kom: 2 }], din: 60, xp: 5 }],
    })
    expect(d.stanje.narudzbe).toEqual([
      {
        id: 5,
        ime: '',
        emoji: '',
        boja: '',
        msg: '',
        stavke: [{ k: 'psenica', kom: 2 }],
        din: 60,
        xp: 5,
      },
    ])
    expect(d.popravke).toEqual(['narudzbe[0].ko: odbaceno'])
  })

  it('narudžbina i sa poljima na vrhu i sa ko: vrh pobeđuje, različit ko se beleži', () => {
    const d = dek({
      ...v2Test4(),
      narudzbe: [
        {
          id: 5,
          ime: 'Baka Mira',
          emoji: '👵',
          ko: { ime: 'Baka Mira', emoji: '🧓', boja: 5 },
          stavke: [{ k: 'psenica', kom: 2 }],
          din: 60,
          xp: 5,
        },
      ],
    })
    expect(d.stanje.narudzbe[0]).toMatchObject({ ime: 'Baka Mira', emoji: '👵', boja: '' })
    expect(d.popravke.sort()).toEqual([
      'narudzbe[0].ko.boja: odbaceno',
      'narudzbe[0].ko.emoji: odbaceno',
    ])
  })
})
