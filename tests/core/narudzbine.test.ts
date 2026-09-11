import { describe, expect, it } from 'vitest'
import type { ZgradaId } from '../../src/config'
import type { Igra } from '../../src/core/dogadjaji'
import { novaIgra } from '../../src/core/igra'
import {
  isporuci,
  mozeIsporuka,
  narPool,
  novaNarudzba,
  odbij,
  osigurajNarudzbe,
} from '../../src/core/narudzbine'
import type { Narudzba } from '../../src/core/types'
import { MAG0, T0, mulberry32, narudzba, niz } from '../helpers'
import { brojac, igra, nivoi, odbijeno } from './pomocnici'

/** Igra sa datim XP-om, kupljenim zgradama i sledećim ID-jem. */
function igraZa(xp: number, kupljeno: readonly ZgradaId[], brojacN: number): Igra {
  const g = igra({ xp })
  for (const id of kupljeno) {
    if (id === 'mlin' || id === 'kazan') g.s.masine[id] = { k: true, t: 0 }
    else g.s.ziv[id] = { k: true, t: T0 }
  }
  g.brojacN = brojacN
  return g
}

const SVE: ZgradaId[] = ['mlin', 'kazan', 'kokosinjac', 'stala']

describe('narPool (02 §5.2)', () => {
  it('kulture po nivou (grožđe nikad), redosledom REDOSLED', () => {
    expect(narPool(igraZa(0, [], 1).s)).toEqual(['psenica', 'sargarepa'])
    expect(narPool(igraZa(30, [], 1).s)).toEqual(['psenica', 'sargarepa', 'paprika'])
    expect(narPool(igraZa(87, [], 1).s)).toEqual(['psenica', 'sargarepa', 'paprika', 'bundeva'])
    expect(narPool(igraZa(6_594_699, [], 1).s)).toEqual([
      'psenica',
      'sargarepa',
      'paprika',
      'bundeva',
    ])
  })

  it('proizvodi samo KUPLJENIH zgrada, uvek redom brašno, ajvar, jaja, mleko, bez obzira na nivo', () => {
    expect(narPool(igraZa(0, ['stala', 'mlin'], 1).s)).toEqual([
      'psenica',
      'sargarepa',
      'brasno',
      'mleko',
    ])
    expect(narPool(igraZa(401, [...SVE].reverse(), 1).s)).toEqual([
      'psenica',
      'sargarepa',
      'paprika',
      'bundeva',
      'brasno',
      'ajvar',
      'jaje',
      'mleko',
    ])
  })
})

/** 02 §5.7 — izlaz prototipa za `rng = mulberry32(seed)`, sa brojem izvlačenja. */
const ZLATNI: [number, ZgradaId[], number, number, number, Narudzba][] = [
  [0, [], 1, 1, 5, {
    id: 1, ime: 'Resto „Šumadija“', emoji: '🍽️', boja: '#e4f5d8', msg: 'Samo sveže, molim.',
    stavke: [{ k: 'sargarepa', kom: 1 }, { k: 'psenica', kom: 2 }], din: 130, xp: 10 }],
  [0, [], 2, 2, 5, {
    id: 2, ime: 'Kafana „Kod Žike“', emoji: '🍺', boja: '#fff3c4', msg: 'Gosti traže domaće!',
    stavke: [{ k: 'sargarepa', kom: 1 }, { k: 'psenica', kom: 1 }], din: 105, xp: 8 }],
  [30, [], 10, 3, 6, {
    id: 10, ime: 'Piljar Pera', emoji: '🧢', boja: '#d9f0ff', msg: 'Tezga mi je poluprazna…',
    stavke: [{ k: 'paprika', kom: 1 }, { k: 'sargarepa', kom: 1 }], din: 325, xp: 25 }],
  [30, ['mlin'], 11, 4, 7, {
    id: 11, ime: 'Kafana „Kod Žike“', emoji: '🍺', boja: '#fff3c4', msg: 'Večeras je puna kafana.',
    stavke: [{ k: 'brasno', kom: 1 }, { k: 'paprika', kom: 1 }], din: 400, xp: 31 }],
  [87, ['mlin', 'kazan', 'kokosinjac'], 12, 5, 16, {
    id: 12, ime: 'Kafana „Kod Žike“', emoji: '🍺', boja: '#fff3c4', msg: 'Večeras je puna kafana.',
    stavke: [{ k: 'psenica', kom: 5 }, { k: 'bundeva', kom: 1 }], din: 1290, xp: 99 }],
  [401, SVE, 13, 6, 20, {
    id: 13, ime: 'Kafana „Kod Žike“', emoji: '🍺', boja: '#fff3c4', msg: 'Večeras je puna kafana.',
    stavke: [{ k: 'jaje', kom: 9 }], din: 530, xp: 41 }],
  [5628, ['kokosinjac'], 14, 7, 12, {
    id: 14, ime: 'Pekara „Zrno“', emoji: '🥖', boja: '#ffeccc', msg: 'Peć je već vruća!',
    stavke: [{ k: 'sargarepa', kom: 12 }], din: 970, xp: 75 }],
  [6_594_699, SVE, 99, 8, 20, {
    id: 99, ime: 'Baka Mira', emoji: '👵', boja: '#ffe0e6', msg: 'Za unučiće spremam ručak…',
    stavke: [{ k: 'psenica', kom: 12 }], din: 285, xp: 22 }],
] // prettier-ignore

describe('novaNarudzba — zlatni vektori (02 §5.7)', () => {
  it.each(ZLATNI)(
    'xp %i, zgrade %j, brojacN %i, mulberry32(%i) → %i izvlačenja',
    (xp, kupljeno, brojacN, seed, izvlacenja, ocekivano) => {
      const g = igraZa(xp, kupljeno, brojacN)
      const rng = brojac(mulberry32(seed))
      expect(novaNarudzba(g, rng)).toEqual(ocekivano)
      expect(rng.pozivi()).toBe(izvlacenja)
      expect(g.brojacN).toBe(brojacN + 1)
    },
  )

  it('nova igra sa mulberry32(2024): tačno ovaj par, 10 izvlačenja', () => {
    const rng = brojac(mulberry32(2024))
    const g = novaIgra(T0, rng)
    expect(g.s.narudzbe).toEqual([
      {
        id: 1,
        ime: 'Piljar Pera',
        emoji: '🧢',
        boja: '#d9f0ff',
        msg: 'Plaćam odmah, kao i uvek.',
        stavke: [
          { k: 'psenica', kom: 2 },
          { k: 'sargarepa', kom: 1 },
        ],
        din: 130,
        xp: 10,
      },
      {
        id: 2,
        ime: 'Kafana „Kod Žike“',
        emoji: '🍺',
        boja: '#fff3c4',
        msg: 'Gosti traže domaće!',
        stavke: [
          { k: 'sargarepa', kom: 1 },
          { k: 'psenica', kom: 1 },
        ],
        din: 105,
        xp: 8,
      },
    ])
    expect(rng.pozivi()).toBe(10)
    expect(g.brojacN).toBe(3)
  })
})

describe('novaNarudzba — skriptovani rng zakucava broj i redosled izvlačenja', () => {
  it('nivo 1, niz(0.9, 0.2, 0, 0, 0.99): 2 vrste, Baka Mira / druga poruka', () => {
    const rng = niz(0.9, 0.2, 0, 0, 0.99)
    expect(novaNarudzba(igraZa(0, [], 1), rng)).toEqual({
      id: 1,
      ime: 'Baka Mira',
      emoji: '👵',
      boja: '#ffe0e6',
      msg: 'Treba mi za zimnicu, sine.',
      stavke: [
        { k: 'sargarepa', kom: 1 },
        { k: 'psenica', kom: 1 },
      ],
      din: 105,
      xp: 8,
    })
    expect(rng.pozivi()).toBe(5)
  })

  it('nivo 1, niz(0.1, 0.8, 0.5, 0.99, 0): 1 vrsta (ceo pool se ipak meša), Resto', () => {
    const rng = niz(0.1, 0.8, 0.5, 0.99, 0)
    expect(novaNarudzba(igraZa(0, [], 1), rng)).toMatchObject({
      ime: 'Resto „Šumadija“',
      msg: 'Šef kuhinje je izričit.',
      stavke: [{ k: 'psenica', kom: 3 }],
      din: 75,
      xp: 6,
    })
    expect(rng.pozivi()).toBe(5)
  })

  it('xp 1e9 (pool od 4), niz(0.1, 0.4 ×6): 7 izvlačenja, bundeva ×3', () => {
    const rng = niz(0.1, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4)
    expect(novaNarudzba(igraZa(1e9, [], 1), rng)).toMatchObject({
      stavke: [{ k: 'bundeva', kom: 3 }],
      din: 3510,
      xp: 270,
    })
    expect(rng.pozivi()).toBe(7)
  })

  it('02 §5.4: nivo 3 + mlin, 11 izvlačenja (C = 7), Kafana, pšenica ×6 + bundeva ×1', () => {
    const rng = niz(0.6, 0.9, 0.1, 0.8, 0.2, 0.7, 0.3, 0.6, 0.4, 0.5, 0.45)
    const g = igraZa(87, ['mlin'], 7)
    expect(narPool(g.s)).toEqual(['psenica', 'sargarepa', 'paprika', 'bundeva', 'brasno'])
    expect(novaNarudzba(g, rng)).toEqual({
      id: 7,
      ime: 'Kafana „Kod Žike“',
      emoji: '🍺',
      boja: '#fff3c4',
      msg: 'Večeras je puna kafana.',
      stavke: [
        { k: 'psenica', kom: 6 },
        { k: 'bundeva', kom: 1 },
      ],
      din: 1315,
      xp: 101,
    })
    expect(rng.pozivi()).toBe(11)
  })

  it('rng van [0, 1) je greška pozivaoca (jasna poruka, ne tihi undefined)', () => {
    expect(() => novaNarudzba(igraZa(0, [], 1), () => 1)).toThrow(RangeError)
  })
})

describe('osigurajNarudzbe', () => {
  it('dopunjava do 2, nove na kraj; puna tabla ne troši rng', () => {
    const g = igra({ narudzbe: [narudzba(8, 'psenica', 1, 25, 3)] })
    g.brojacN = 9
    osigurajNarudzbe(g, mulberry32(1))
    expect(g.s.narudzbe.map((o) => o.id)).toEqual([8, 9])
    expect(g.brojacN).toBe(10)
    osigurajNarudzbe(g, niz()) // niz() baca na prvo izvlačenje
    expect(g.s.narudzbe).toHaveLength(2)
  })
})

describe('mozeIsporuka', () => {
  it('sve stavke moraju biti pokrivene', () => {
    const o: Narudzba = {
      ...narudzba(1, 'psenica', 2, 60, 5),
      stavke: [
        { k: 'psenica', kom: 2 },
        { k: 'jaje', kom: 1 },
      ],
    }
    expect(mozeIsporuka(igra({ mag: { ...MAG0, psenica: 2, jaje: 1 } }).s, o)).toBe(true)
    expect(mozeIsporuka(igra({ mag: { ...MAG0, psenica: 2 } }).s, o)).toBe(false)
    expect(mozeIsporuka(igra({ mag: { ...MAG0, psenica: 1, jaje: 5 } }).s, o)).toBe(false)
  })
})

describe('isporuci', () => {
  const tabla = () =>
    igra({
      novac: 50,
      mag: { ...MAG0, psenica: 5, sargarepa: 1 },
      narudzbe: [narudzba(5, 'sargarepa', 1, 80, 6), narudzba(6, 'psenica', 2, 60, 5)],
    })

  it('C39/C40: stavke skinute, novac/zarađeno/isporuke, XP, zamena na kraju; događaji redom', () => {
    const g = tabla()
    g.brojacN = 7
    const r = isporuci(g, 6, T0, mulberry32(1))
    expect(r).toEqual({
      ok: true,
      dogadjaji: [
        { tip: 'novcici', sidro: { vrsta: 'narudzba', id: 6 }, broj: 6 },
        { tip: 'vibracija', obrazac: [15, 30, 15] },
        { tip: 'xp', iznos: 5, sidro: { vrsta: 'narudzba', id: 6 } },
        { tip: 'poruka', poruka: { id: 'zahvaljuje', ime: 'Baka Mira', din: 60 } },
      ],
      cuvaj: 'odlozeno',
    })
    expect(g.s.mag).toEqual({ ...MAG0, psenica: 3, sargarepa: 1 })
    expect(g.s.novac).toBe(110)
    expect(g.s.stat).toEqual({ ubrano: 0, zaradjeno: 60, isporuke: 1 })
    expect(g.s.xp).toBe(5)
    expect(g.s.narudzbe.map((o) => o.id)).toEqual([5, 7])
    expect(g.brojacN).toBe(8)
  })

  it('zamena nastaje POSLE dodajXp: xp 29 → 33 daje pool nivoa 2 (sa paprikom)', () => {
    const pripremi = () => {
      const g = igra({ xp: 29, mag: { ...MAG0, psenica: 1 } })
      g.s.narudzbe = [narudzba(1, 'psenica', 1, 25, 4), narudzba(2, 'bundeva', 9, 9999, 999)]
      g.brojacN = 3
      return g
    }
    const g = pripremi()
    isporuci(g, 1, T0, mulberry32(3))
    const nova = g.s.narudzbe[1]
    // Isti tok nad stanjem POSLE XP-a (nivo 2) i PRE (nivo 1): mora da bude prvo, a razlikuju se.
    const posle = pripremi()
    posle.s.xp = 33
    const pre = pripremi()
    expect(nova).toEqual(novaNarudzba(posle, mulberry32(3)))
    expect(nova).not.toEqual(novaNarudzba(pre, mulberry32(3)))
    expect(nova?.stavke.some((st) => st.k === 'paprika')).toBe(true)
  })

  it('isporuka koja diže nivo: zahvalnica posle svih level-up-ova', () => {
    const g = igra({ novac: 0, mag: { ...MAG0, psenica: 1 } })
    g.s.narudzbe = [narudzba(1, 'psenica', 1, 25, 100), narudzba(2, 'psenica', 50, 5, 3)]
    g.brojacN = 3
    const d = isporuci(g, 1, T0, mulberry32(1)).dogadjaji
    expect(d.map((e) => e.tip)).toEqual(['novcici', 'vibracija', 'xp', 'nivo', 'nivo', 'poruka'])
    expect(nivoi(d)).toEqual([
      [2, 80],
      [3, 120],
    ])
    expect(g.s.novac).toBe(25 + 80 + 120)
  })

  it('nepoznat ID: tiho; nedovoljno robe: samo zvuk greške; stanje netaknuto', () => {
    const g = tabla()
    expect(odbijeno(g, () => isporuci(g, 999_999, T0, niz()))).toEqual([])
    g.s.mag.psenica = 1
    expect(odbijeno(g, () => isporuci(g, 6, T0, niz()))).toEqual([{ tip: 'zvuk', id: 'greska' }])
  })
})

describe('odbij', () => {
  it('C19/C20: [1,2] → odbij 1 → [2,3], brojacN 4; samo „tap"', () => {
    const g = novaIgra(T0, mulberry32(2024))
    const druga = structuredClone(g.s.narudzbe[1])
    const r = odbij(g, 1, mulberry32(5))
    expect(r).toEqual({ ok: true, dogadjaji: [{ tip: 'zvuk', id: 'tap' }], cuvaj: 'odlozeno' })
    expect(g.s.narudzbe.map((o) => o.id)).toEqual([2, 3])
    expect(g.s.narudzbe[0]).toEqual(druga)
    expect(g.brojacN).toBe(4)
  })

  it('nepoznat ID: odbijeno, bez nove narudžbine', () => {
    const g = novaIgra(T0, mulberry32(2024))
    expect(odbijeno(g, () => odbij(g, 3, niz()))).toEqual([])
  })
})
