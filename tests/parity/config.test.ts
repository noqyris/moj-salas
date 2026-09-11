import { beforeAll, describe, expect, it } from 'vitest'
import {
  KULTURE,
  MASINE,
  MAX_PARCELA,
  MUSTERIJE,
  POCETNI_NOVAC,
  POCETNE_PARCELE,
  PROIZVODI,
  REDOSLED,
  SVI_KLJUCEVI,
  ZIV,
  KLJUC_SEJVA,
  baznaCena,
  cenaParcele,
  xpZaNivo,
} from '../../src/config'
import { T0 } from '../helpers'
import { ucitajPrototip, type Prototip } from '../helpers/prototip'

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
})
