/*
 * CLAUDE.md regresija 4 — anti-softlock: kupovina ne sme da ostavi igrača bez para za seme kad
 * ništa ne raste i magacin je prazan (07 R4, svaki red izmeren na prototipu, exp4-regressions).
 *
 * Mutacije koje hvata (svaka obara imenovani red):
 *  - `<` → `<=` u `novac − cena < 10`         → red „610"
 *  - bez `!nestoRaste()`                       → red „usev raste"
 *  - bez `magPrazan()`                         → red „1 pšenica u magacinu"
 *  - `m.k` umesto `m.t > 0` u nestoRaste       → red „kupljena mašina miruje"
 */
import { describe, expect, it } from 'vitest'
import type { Rezultat } from '../../src/core/dogadjaji'
import { kupiParcelu } from '../../src/core/polja'
import { kupiZgradu, pametnaKupovina } from '../../src/core/radnja'
import type { Stanje } from '../../src/core/types'
import { MAG0, T0, stanje } from '../helpers'
import { igra } from '../core/pomocnici'
import type { Igra } from '../../src/core/dogadjaji'

type Ishod = 'ok' | 'nemasNovca' | 'ostaviZaSeme'

const raste = { c: 'psenica' as const, t: T0, z: false }
const prazna = { c: null, t: 0, z: false }

/** TEST 5: novac 600, xp 200 (nivo 4), prazan magacin, ništa posađeno ni kupljeno. */
const T5 = (o: Partial<Stanje> = {}) => ({ novac: 600, xp: 200, ...o })

const REDOVI: [string, Partial<Stanje>, (g: Igra) => Rezultat, Ishod, number][] = [
  ['tačna cena, ništa ne raste, prazno', T5(), (g) => kupiZgradu(g, 'kazan', T0), 'ostaviZaSeme', 600],
  ['609', T5({ novac: 609 }), (g) => kupiZgradu(g, 'kazan', T0), 'ostaviZaSeme', 609],
  ['610', T5({ novac: 610 }), (g) => kupiZgradu(g, 'kazan', T0), 'ok', 10],
  ['599', T5({ novac: 599 }), (g) => kupiZgradu(g, 'kazan', T0), 'nemasNovca', 599],
  ['1 pšenica u magacinu', T5({ mag: { ...MAG0, psenica: 1 } }), (g) => kupiZgradu(g, 'kazan', T0), 'ok', 0],
  ['usev raste', T5({ parcele: [raste, prazna] }), (g) => kupiZgradu(g, 'kazan', T0), 'ok', 0],
  ['kupljena mašina miruje', T5({ masine: { mlin: { k: true, t: 0 }, kazan: { k: false, t: 0 } } }), (g) => kupiZgradu(g, 'kazan', T0), 'ostaviZaSeme', 600],
  ['mašina radi', T5({ masine: { mlin: { k: true, t: T0 }, kazan: { k: false, t: 0 } } }), (g) => kupiZgradu(g, 'kazan', T0), 'ok', 0],
  ['kupljena životinja (0 spremnih)', T5({ novac: 350, ziv: { kokosinjac: { k: true, t: T0 }, stala: { k: false, t: 0 } } }), (g) => kupiZgradu(g, 'mlin', T0), 'ok', 0],
  ['kokošinjac 900, kazan kupljen i miruje', T5({ novac: 900, masine: { mlin: { k: false, t: 0 }, kazan: { k: true, t: 0 } } }), (g) => kupiZgradu(g, 'kokosinjac', T0), 'ostaviZaSeme', 900],
  ['parcela 150 tačno (xp 0)', { novac: 150 }, (g) => kupiParcelu(g, T0), 'ostaviZaSeme', 150],
  ['parcela 159', { novac: 159 }, (g) => kupiParcelu(g, T0), 'ostaviZaSeme', 159],
  ['parcela 160', { novac: 160 }, (g) => kupiParcelu(g, T0), 'ok', 10],
  ['parcela 149', { novac: 149 }, (g) => kupiParcelu(g, T0), 'nemasNovca', 149],
  ['parcela 150 + usev raste', { novac: 150, parcele: [raste, prazna] }, (g) => kupiParcelu(g, T0), 'ok', 0],
] // prettier-ignore

describe('R4: anti-softlock', () => {
  it.each(REDOVI)('%s', (_opis, o, akcija, ishod, novacPosle) => {
    const g = igra(o)
    const pre = structuredClone(g)
    const r = akcija(g)
    expect(g.s.novac).toBe(novacPosle)
    if (ishod === 'ok') {
      expect(r.ok).toBe(true)
      expect(r.cuvaj).toBe('odlozeno')
      return
    }
    expect(r).toEqual({
      ok: false,
      dogadjaji: [
        { tip: 'zvuk', id: 'greska' },
        { tip: 'poruka', poruka: { id: ishod } },
      ],
      cuvaj: 'ne',
    })
    expect(g).toEqual(pre) // duboko, uključujući videno
  })

  it('610: kazan kupljen, poruka „Kazan za ajvar je na farmi"', () => {
    const g = igra(T5({ novac: 610 }))
    expect(kupiZgradu(g, 'kazan', T0).dogadjaji).toContainEqual({
      tip: 'poruka',
      poruka: { id: 'zgradaNaFarmi', zgrada: 'kazan' },
    })
    expect(g.s.masine.kazan.k).toBe(true)
  })

  it('parcela 160: 3 parcele, „Nova parcela je tvoja", sledeća cena 330', () => {
    const g = igra({ novac: 160 })
    expect(kupiParcelu(g, T0).dogadjaji).toContainEqual({
      tip: 'poruka',
      poruka: { id: 'novaParcela' },
    })
    expect(g.s.parcele).toHaveLength(3)
    g.s.novac = 339
    expect(kupiParcelu(g, T0).ok).toBe(false) // 339 − 330 = 9 < 10
    g.s.novac = 340
    expect(kupiParcelu(g, T0).ok).toBe(true)
  })

  it('pametnaKupovina(TEST 5, 600) === ostaviZaSeme; kazan ostaje nekupljen', () => {
    expect(pametnaKupovina(stanje(T5()), 600)).toBe('ostaviZaSeme')
    const g = igra(T5())
    kupiZgradu(g, 'kazan', T0)
    expect(g.s.masine.kazan.k).toBe(false)
  })
})
