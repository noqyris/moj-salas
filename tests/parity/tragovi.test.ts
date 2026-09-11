/*
 * SVEŽINA FIKSTURA PARITETA (tools/parity/upis.ts se poziva na ovaj test): tragovi u
 * tests/fixtures/parity/ moraju biti upravo ono što `npm run parity:gen` danas pravi. Inače bi
 * replay.test.ts poredio port sa zastarelim oraklom (npr. posle promene ZAKRPA ili drajvera).
 *
 *  - svaka fikstura: format i verzija traga, otisak orakla (prototip + ZAKRPE + instrumentacija)
 *    === današnji, seme/start/broj koraka === scenario;
 *  - skup fikstura === skup scenarija (nema zaostalih ni nedostajućih);
 *  - uzorak tragova se generiše ponovo i poredi BAJT ZA BAJT (determinizam: virtuelni sat, seedovani
 *    tokovi) — svi skriptovani i po jedan nasumični za oba starta.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { postojeceFiksture, procitajFiksturu, putanjaFiksture } from '../../tools/parity/fiksture'
import { FORMAT_TRAGA, VERZIJA_TRAGA } from '../../tools/parity/kodek'
import { SKRIPTOVANI, SLUCAJNI, SVI_TRAGOVI } from '../../tools/parity/scenariji'
import { oraklHtml, otisak } from '../../tools/parity/tragovi'
import { generisiFiksturu } from '../../tools/parity/upis'

const OTISAK = otisak(oraklHtml())
const PO_IMENU = new Map(SVI_TRAGOVI.map((o) => [o.ime, o]))

describe('fiksture pariteta su sveže (npm run parity:gen)', () => {
  it('skup fikstura === skup scenarija', () => {
    expect(postojeceFiksture()).toEqual([...PO_IMENU.keys()].sort())
  })

  it.each(postojeceFiksture())('%s: zaglavlje odgovara scenariju i današnjem oraklu', (ime) => {
    const { zaglavlje, redovi } = procitajFiksturu(ime)
    const o = PO_IMENU.get(ime)
    expect(o).toBeDefined()
    expect(zaglavlje).toEqual({
      format: FORMAT_TRAGA,
      verzija: VERZIJA_TRAGA,
      ime,
      seme: o?.seme,
      start: o?.start.ime,
      koraka: redovi.length - 1,
      orakl: OTISAK,
    })
    expect(redovi[0]?.a).toEqual({ k: 'boot', start: o?.start.ime, raw: o?.start.raw })
    redovi.forEach((r, i) => expect(r.i).toBe(i))
    if (o?.skripta === undefined) expect(redovi.length - 1).toBe(o?.koraka)
    else expect(redovi.length - 1).toBeGreaterThanOrEqual(o.skripta.length)
  })

  const UZORAK = [
    ...SKRIPTOVANI,
    ...SLUCAJNI.filter((o) => o.ime === 'fresh-s3' || o.ime === 'rich-s5'),
  ]

  it.each(UZORAK.map((o) => [o.ime, o] as const))(
    '%s: ponovno generisanje je bajt-identično fiksturi',
    async (_ime, o) => {
      const sada = await generisiFiksturu(o)
      expect(sada === readFileSync(putanjaFiksture(o.ime), 'utf8')).toBe(true)
    },
    30_000,
  )
})
