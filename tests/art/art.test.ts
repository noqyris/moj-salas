/*
 * Art bez prototipa: dužina i sha256 svakog sprajta i statičkog SVG-a (tabele iz 05 §7.2 i §7.6,
 * izračunate nad živim prototipom), plus strukturna pravila koja UI/CSS podrazumevaju. Hvata svaku
 * izmenu bajta u art/ čak i kad se prototip jednog dana ukloni iz repoa.
 */
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  ART,
  AMBAR,
  DRVO1,
  DRVO2,
  KLICA,
  KOKA_G,
  KRAVA_G,
  NAV_IKONE,
  NOVCIC_PILULA,
  SEN,
  SV,
  biljka,
  grozd,
  ikonica,
  ikonicaOtkljucavanja,
  klas,
  type ArtKljuc,
} from '../../src/art'
import { PROIZVODI_REDOSLED, REDOSLED, SVI_KLJUCEVI } from '../../src/config'

const sha = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex')

/** 05 §7.2: [dužina, sha256] za svaki ključ ART-a, redosledom iz prototipa. */
const ART_OTISCI: Record<ArtKljuc, readonly [number, string]> = {
  psenica2: [379, '14a3e1d48f784a74a142fcbc1a990b533c208537215f6ec27a8277e1321ec34f'],
  psenica3: [1118, 'd8a22476e11ba2b0108baa93178edc6320691385033d9be60b1a0972b44bfcb8'],
  sargarepa2: [384, 'e7f6ea5235810a7b79d3be00dd5386601544cd7732d1ea1849faea66743bc4c2'],
  sargarepa3: [616, 'edc102b898b4377a35b31fc6db3beb3fe8d377c1b118c409a4289ebca4a1e2ae'],
  paprika2: [382, '161f5817a5d427ee6ef2d85d5b762200c3c30678a7d41693094a239448caa306'],
  paprika3: [789, '0395d7422a5b395b09b0692e36a5a123d4a65ed0817ff8dfe1c5ad8ed705edd0'],
  bundeva2: [396, '434f9c5d598c8f93fef1b2058bc6b0780bb75cc6c2cb25b4158464c47b980e8e'],
  bundeva3: [600, '8fc23f5ccdda5b0c4b4f0ea2932afbf0e8850718d3b1ed9a0c41817d42e99565'],
  grozdje2: [505, 'e885741be1a4fb47d752994e184b6c658f212b398d55c6bea3d0bc49e81a3f24'],
  grozdje3: [1578, '3e30549e99d558af87d3229b25515387ca52dac3e849fa9e2e6ec05e3801be75'],
  ajvar: [360, '03aca84ec1fb31d376e6cd42c6821aff5fe7185d35c3a9f82724bbc5b728d4ab'],
  brasno: [501, '4d4766bba9900e8303cc08309db0668b80976bb521c8b26dd6882e813878ea39'],
  jaje: [256, 'e13ca01f25672286937bd5be1ed48dbbfc5645966be029901dd4602f880f0ac6'],
  mleko: [550, 'fabb220108168f030b5fd2319489bfea6474738c98215c85bde0398be8864a4e'],
  kazan: [654, 'a4735d32554108da643fbd871abde5b531c55133d013ca90aa15aae578c965cc'],
  mlin: [755, 'be3da04e598f8f2155e7d5140edeba539d61d17e1d7d0718398c64350e25c95a'],
  kokosinjac: [1081, 'd0bb087a2c47c1c8c5f1d704ba93cac6eaaf8b662db43282f8a4fb13f2521a3f'],
  stala: [1145, '4cda70c084a2dce072464652c4922a68b76ba79d808b8a1ae82a65a09ce69c0c'],
  kap: [236, '0563bfc2bd5c3f907f5dfc76405a1444667dcd7a61f2f0a09c0cba5646210a10'],
  novcic: [241, '04a9ea9e9cb29250c21ca07315449605d2895d5619cba837ee3f7d5cc798dc3d'],
  katanac: [321, 'b25b79cbea7f6be8c5d99611d5f1cf797deecb7f255812052dfaca46b1bcc5c6'],
  poklon: [449, 'a67b18b42c44c8e89e9d8a3fe22069e16aaba86f104f9a969b84f6a7e4cc83d7'],
  leptir: [607, 'e0af9687b2d390c48e2af243240300ae64ff9661210a7d262c4b44036a02980d'],
  koka: [603, '8e69532f96531aecc986af6ee94aa6a1b008aa4965090a96319617279aeee677'],
  krava: [1111, '38679c95116d51173e9ef4d9df8caba94f4bc5dfe9ed962e7faaa31245467c04'],
}

/** 05 §7.2 (gradivni blokovi) i §7.6 (statički SVG iz HTML-a). */
const OSTALI_OTISCI: readonly (readonly [string, string, number, string])[] = [
  ['SV', SV, 60, 'b8620877ae94c05150fcec7bb63e3c2a236dc8e28b32ad41464ce0ddf12b33ae'],
  ['SEN', SEN, 66, 'cd0f5c5b08f10b0a2c8950d4a8affc1f5b45935ab3590cee1f0267809f259104'],
  ['KLICA', KLICA, 372, '410adbab57fe8425c6457b07aa455ce609c6ec4f6e3788cb897d3a82586f2b5a'],
  ['KOKA_G', KOKA_G, 537, '9c6b6a1657850cccbd3f0ef2d5881bd5eb5c008814f86ea17a86c75544ab891b'],
  ['KRAVA_G', KRAVA_G, 1045, '880a5651bc46401d3c0b5b7103fb40733b4a1484716228c35a9e715bbbbfaca1'],
  [
    'klas(20,22)',
    klas(20, 22),
    264,
    '61fa43e2e4ee78914bc31e83617f9e68b8913587d160e38e5bcb74d47b34222c',
  ],
  [
    'klas(32,14)',
    klas(32, 14),
    263,
    '43fd568fab098417ba57bc74122a914816fe26423f37fb32bf59065c6ad33868',
  ],
  [
    'klas(44,22)',
    klas(44, 22),
    264,
    'e83abffa3ecfadc20404ba72a8fdfbb1d6410baf7f81b44df815d34c40166296',
  ],
  [
    'grozd(25,42)',
    grozd(25, 42),
    498,
    'e912d395eab88b64667a15754168dbddf0ef192c98a9e508ad52e3da55a203a6',
  ],
  [
    'grozd(41,36)',
    grozd(41, 36),
    498,
    '9c1ffd169930926d5352311398204c47382a39b56dc8700efaefd1b6bd8f874d',
  ],
  ['DRVO2', DRVO2, 257, '51d2f73d00d68e64ed467afef385769a913a83262f14b70a114e11910f4e4d3f'],
  ['DRVO1', DRVO1, 257, 'aa60b394d66e126d8c21ad30c87a8dd27072d4cf2014a391929cf8e842f7be3e'],
  ['AMBAR', AMBAR, 537, '7d608c36b1f6cc5a725af03c7134d8505219e2a8e58f2c35f862d4975890d937'],
  [
    'NOVCIC_PILULA',
    NOVCIC_PILULA,
    206,
    '93baf2ec6e5553cea9b98082d6228c44bfa54264401c8f44e8aeed50a154219a',
  ],
  [
    'NAV_IKONE.farma',
    NAV_IKONE.farma,
    238,
    'ec25df9abb4570c8320ab54b56577843df3067f803c3d40b7365c4a867570469',
  ],
  [
    'NAV_IKONE.narudzbe',
    NAV_IKONE.narudzbe,
    214,
    'e2f492e1634040249bd8ecc358e987eb61507377e61cf0153bb8283fb9681718',
  ],
  [
    'NAV_IKONE.pijaca',
    NAV_IKONE.pijaca,
    263,
    'ccab3c16c02ea146b83b6349629f80ff0c8fa2c5ca07cb01a1efc1779e390c90',
  ],
  [
    'NAV_IKONE.radnja',
    NAV_IKONE.radnja,
    286,
    '50f27f503b2b209b2fa5ef60a88b3641107c86c28a1d5e3b289d527c1fd4d2a6',
  ],
]

const kljuceviArt = Object.keys(ART) as ArtKljuc[]

describe('ART — otisci iz 05 §7.2', () => {
  it('ima tačno 25 ključeva, redom kao prototip', () => {
    expect(kljuceviArt).toEqual(Object.keys(ART_OTISCI))
  })

  it.each(kljuceviArt)('ART.%s: dužina i sha256', (k) => {
    const [duzina, otisak] = ART_OTISCI[k]
    expect(ART[k].length).toBe(duzina)
    expect(sha(ART[k])).toBe(otisak)
  })

  it.each(OSTALI_OTISCI.map((r) => [r[0], r] as const))('%s: dužina i sha256', (_ime, red) => {
    const [, s, duzina, otisak] = red
    expect(s.length).toBe(duzina)
    expect(sha(s)).toBe(otisak)
  })
})

describe('ART — pravila na koja se oslanjaju CSS i UI', () => {
  it('svaki sprajt je jedan <svg> sa xmlns i viewBox, bez width/height (veličinu daje slot)', () => {
    for (const k of kljuceviArt) {
      const s = ART[k]
      expect(s.startsWith('<svg viewBox="'), k).toBe(true)
      expect(s.includes(' xmlns="http://www.w3.org/2000/svg"'), k).toBe(true)
      expect(s.endsWith('</svg>'), k).toBe(true)
      expect(s.split('<svg').length - 1, k).toBe(1)
      expect(/\s(width|height)=/.test(s.slice(0, s.indexOf('>'))), k).toBe(false)
    }
  })

  it('viewBox po sprajtu (05 §7.2)', () => {
    const vb = (s: string): string | undefined => /viewBox="([^"]+)"/.exec(s)?.[1]
    const ocekivano: Record<string, readonly ArtKljuc[]> = {
      '0 0 64 64': [...REDOSLED.flatMap((k) => [`${k}2` as const, `${k}3` as const]), 'mlin'],
      '0 0 48 48': ['ajvar', 'brasno', 'jaje', 'mleko', 'katanac', 'poklon', 'koka'],
      '0 0 72 64': ['kazan', 'kokosinjac', 'stala'],
      '0 0 24 24': ['kap', 'novcic'],
      '0 0 32 32': ['leptir'],
      '0 0 66 56': ['krava'],
    }
    const nadjeno: Record<string, ArtKljuc[]> = {}
    for (const k of kljuceviArt) (nadjeno[vb(ART[k]) ?? '?'] ??= []).push(k)
    for (const [v, lista] of Object.entries(ocekivano)) {
      expect([...(nadjeno[v] ?? [])].sort(), v).toEqual([...lista].sort())
    }
    expect(Object.keys(nadjeno).sort()).toEqual(Object.keys(ocekivano).sort())
  })

  it('CSS kuke: .krila samo u mlinu, .krL/.krD samo u leptiru (po jednom)', () => {
    for (const k of kljuceviArt) {
      const s = ART[k]
      expect(s.split('class="krila"').length - 1, k).toBe(k === 'mlin' ? 1 : 0)
      expect(s.split('class="krL"').length - 1, k).toBe(k === 'leptir' ? 1 : 0)
      expect(s.split('class="krD"').length - 1, k).toBe(k === 'leptir' ? 1 : 0)
      if (k !== 'mlin' && k !== 'leptir') expect(s.includes('class='), k).toBe(false)
    }
  })

  it('sastav: faze kultura počinju sa SV+SEN; koka/kokošinjac nose KOKA_G, krava/štala KRAVA_G', () => {
    for (const k of REDOSLED) {
      expect(ART[`${k}2`].startsWith(SV + SEN)).toBe(true)
      expect(ART[`${k}3`].startsWith(SV + SEN)).toBe(true)
    }
    expect(KLICA.startsWith(SV + SEN)).toBe(true)
    expect(ART.koka).toContain(KOKA_G)
    expect(ART.kokosinjac).toContain(
      '<g transform="translate(46,16) scale(.56)">' + KOKA_G + '</g>',
    )
    expect(ART.krava).toContain(KRAVA_G)
    expect(ART.stala).toContain('<g transform="translate(4,6)">' + KRAVA_G + '</g>')
    expect(ART.psenica3).toContain(klas(20, 22) + klas(32, 14) + klas(44, 22))
    expect(ART.grozdje3).toContain(grozd(25, 42) + grozd(41, 36) + '</svg>')
  })

  it('klas: 6 elipsi bez fill-a na tačnim pomacima', () => {
    expect(klas(0, 0)).toBe(
      '<ellipse cx="0" cy="8" rx="3.1" ry="4.8"/><ellipse cx="-4" cy="4" rx="3.1" ry="4.8"/>' +
        '<ellipse cx="4" cy="4" rx="3.1" ry="4.8"/><ellipse cx="-4" cy="-2" rx="3.1" ry="4.8"/>' +
        '<ellipse cx="4" cy="-2" rx="3.1" ry="4.8"/><ellipse cx="0" cy="-6" rx="3.1" ry="4.8"/>',
    )
  })

  it('grozd: 6 bobica, svetle su tačno indeksi 1 i 4', () => {
    const bobice = grozd(10, 20).split('/>').filter(Boolean)
    expect(bobice).toHaveLength(6)
    const pozicije = bobice.map((b) => /cx="(-?\d+)" cy="(-?\d+)"/.exec(b)?.slice(1).join(','))
    expect(pozicije).toEqual(['10,20', '6,25', '14,25', '8,30', '12,30', '10,35'])
    const svetle = bobice.map((b) => b.includes('fill="#9b6fc4"'))
    expect(svetle).toEqual([false, true, false, false, true, false])
    expect(bobice.every((b) => b.includes('stroke="#5e3a80" stroke-width=".8"'))).toBe(true)
  })

  it('novčić u novčaniku je ART.novcic bez xmlns (05 §7.6)', () => {
    expect(NOVCIC_PILULA).toBe(ART.novcic.replace(' xmlns="http://www.w3.org/2000/svg"', ''))
  })

  it('drvo1 i drvo2 se razlikuju samo po klasi', () => {
    expect(DRVO1).toBe(DRVO2.replace('ukras drvo2', 'ukras drvo1'))
    expect(DRVO2.startsWith('<svg class="ukras drvo2" viewBox="0 0 60 80">')).toBe(true)
  })

  it('ikonice tabova prate currentColor (boja dugmeta)', () => {
    for (const s of Object.values(NAV_IKONE)) {
      expect(s.startsWith('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"')).toBe(true)
    }
  })
})

describe('pomoćnici', () => {
  it('ikonica: kultura → zrela biljka, proizvod → sopstveni sprajt', () => {
    for (const k of REDOSLED) expect(ikonica(k)).toBe(ART[`${k}3`])
    for (const k of PROIZVODI_REDOSLED) expect(ikonica(k)).toBe(ART[k])
    // Svaki artikal ima ikonicu i sve su različite.
    expect(new Set(SVI_KLJUCEVI.map(ikonica)).size).toBe(SVI_KLJUCEVI.length)
  })

  it('biljka: faza 1 je ista KLICA za sve kulture, 2 i 3 su sprajtovi kulture', () => {
    for (const c of REDOSLED) {
      expect(biljka(c, 1)).toBe(KLICA)
      expect(biljka(c, 2)).toBe(ART[`${c}2`])
      expect(biljka(c, 3)).toBe(ART[`${c}3`])
    }
  })

  it('ikonicaOtkljucavanja: kultura → ikonica, zgrada → ART[id], aukcija → katanac', () => {
    expect(ikonicaOtkljucavanja({ vrsta: 'kultura', id: 'paprika' })).toBe(ART.paprika3)
    expect(ikonicaOtkljucavanja({ vrsta: 'masina', id: 'mlin' })).toBe(ART.mlin)
    expect(ikonicaOtkljucavanja({ vrsta: 'masina', id: 'kazan' })).toBe(ART.kazan)
    expect(ikonicaOtkljucavanja({ vrsta: 'zivotinja', id: 'kokosinjac' })).toBe(ART.kokosinjac)
    expect(ikonicaOtkljucavanja({ vrsta: 'zivotinja', id: 'stala' })).toBe(ART.stala)
    expect(ikonicaOtkljucavanja({ vrsta: 'aukcija' })).toBe(ART.katanac)
  })
})
