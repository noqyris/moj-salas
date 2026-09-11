import { beforeAll, describe, expect, it } from 'vitest'
import {
  KULTURE,
  MASINE,
  MAX_PARCELA,
  MUSTERIJE,
  NARUDZBINA_MAX_VRSTA,
  NOVCICA_MAX,
  POCETNI_NOVAC,
  POCETNE_PARCELE,
  PROIZVODI,
  REDOSLED,
  SVI_KLJUCEVI,
  UBERI_SVE_MIN,
  VIBRACIJA,
  ZIV,
  KLJUC_SEJVA,
  baznaCena,
  cenaParcele,
  xpZaNivo,
} from '../../src/config'
import { T0 } from '../helpers'
import { PROTOTIP_HTML, ucitajPrototip, type Prototip } from '../helpers/prototip'

/** Config sme da se razlikuje od prototipa samo po tome što su tekstovi (naziv, opis…) u i18n. */
function bezTeksta<T extends object>(o: Record<string, T>): Record<string, Partial<T>> {
  const TEKST = new Set(['naziv', 'opis', 'akcija', 'gotovo'])
  return Object.fromEntries(
    Object.entries(o).map(([k, v]) => [
      k,
      Object.fromEntries(Object.entries(v).filter(([p]) => !TEKST.has(p))) as Partial<T>,
    ]),
  )
}

describe('config = prototip (bit za bit)', () => {
  let p: Prototip
  beforeAll(async () => {
    p = await ucitajPrototip({ t0: T0 })
  })

  it('kulture, proizvodi, mašine, životinje', () => {
    expect(KULTURE).toEqual(bezTeksta(p.ev<Record<string, object>>('KULTURE')))
    expect(PROIZVODI).toEqual(bezTeksta(p.ev<Record<string, object>>('PROIZVODI')))
    expect(MASINE).toEqual(bezTeksta(p.ev<Record<string, object>>('MASINE')))
    expect(ZIV).toEqual(bezTeksta(p.ev<Record<string, object>>('ZIV')))
  })

  it('redosledi (određuju fazni pomak na pijaci i redosled prikaza)', () => {
    expect([...REDOSLED]).toEqual(p.ev('REDOSLED'))
    expect([...SVI_KLJUCEVI]).toEqual(p.ev('SVI_KLJUCEVI'))
    expect(Object.keys(MASINE)).toEqual(Object.keys(p.ev<object>('MASINE')))
    expect(Object.keys(ZIV)).toEqual(Object.keys(p.ev<object>('ZIV')))
  })

  it('mušterije, uključujući tačne znakove („“, …, emoji sa VS16)', () => {
    expect(MUSTERIJE).toEqual(p.ev('MUSTERIJE'))
  })

  it('skalari i ključ sejva', () => {
    expect(MAX_PARCELA).toBe(p.ev('MAX_PARCELA'))
    expect(KLJUC_SEJVA).toBe(p.ev('KLJUC'))
    const pocetno = p.ev<{ novac: number; parcele: unknown[] }>('POCETNO()')
    expect(POCETNI_NOVAC).toBe(pocetno.novac)
    expect(POCETNE_PARCELE).toBe(pocetno.parcele.length)
  })

  it('formule: cena parcele, XP kriva, bazne cene', () => {
    for (let n = 0; n <= 12; n++) expect(cenaParcele(n)).toBe(p.ev(`cenaParcele(${n})`))
    for (let l = 1; l <= 25; l++) expect(xpZaNivo(l)).toBe(p.ev(`xpZaNivo(${l})`))
    for (const k of SVI_KLJUCEVI) expect(baznaCena(k)).toBe(p.ev(`SVE_CENE['${k}'].cena`))
  })

  // config/prikaz.ts: u prototipu su to literali unutar funkcija — traže se u telu funkcije koja ih
  // koristi (`fn.toString()`), pa pomeren ili izmenjen literal obara test.
  it('konstante prikaza: obrasci vibracije, broj novčića, prag „Uberi sve“', () => {
    const telo = (fn: string) => p.ev<string>(`${fn}.toString()`).replace(/\s+/g, '')
    const vibro = (v: number | readonly number[]) => `vibro(${JSON.stringify(v)})`
    const gde: Record<keyof typeof VIBRACIJA, readonly string[]> = {
      sadnja: ['posadi'],
      zalivanje: ['zalijBiljku'],
      zetva: ['uberi'],
      uberiSve: ['uberiSve'],
      isporuka: ['isporuci'],
      kupovina: ['kupiParcelu', 'kupiZgradu'],
      pokupi: ['pokupi'],
      nivo: ['prikaziNivo'],
    }
    for (const [k, fns] of Object.entries(gde) as [keyof typeof VIBRACIJA, readonly string[]][]) {
      for (const fn of fns) expect(telo(fn), `${k} u ${fn}`).toContain(vibro(VIBRACIJA[k]))
    }
    // Svaki `vibro(…)` poziv prototipa je pokriven (definicija `vibro(ms)` se ne broji).
    const pozivi = PROTOTIP_HTML.replace(/\s+/g, '').match(/vibro\((?!ms\))[^)]*\)/g) ?? []
    const ocekivano = Object.entries(gde).flatMap(([k, fns]) =>
      fns.map(() => vibro(VIBRACIJA[k as keyof typeof VIBRACIJA])),
    )
    expect(pozivi.sort()).toEqual(ocekivano.sort())

    expect(telo('letiNovcic')).toContain(`Math.min(broj,${NOVCICA_MAX})`)
    expect(telo('prodaj')).toContain(`letiNovcic(dugme,Math.min(kom,${NOVCICA_MAX}))`)
    expect(telo('isporuci')).toContain(`letiNovcic(dugme,${NOVCICA_MAX})`)
    expect(telo('crtajNjive')).toContain(`zr>=${UBERI_SVE_MIN}?`)
    expect(telo('novaNarudzba')).toContain(`pool.length<${NARUDZBINA_MAX_VRSTA})?1:2`)
    expect(NARUDZBINA_MAX_VRSTA).toBe(2)
  })
})
