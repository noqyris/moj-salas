/*
 * DIFFERENTIAL PARITET (07 §d, ugovor §8): svaki trag iz tests/fixtures/parity/ je snimak
 * ZAKRPLJENOG prototipa (odobrena odstupanja, tools/parity/zakrpe.ts) kroz korake koje prst može
 * da dohvati. Ovde se isti niz koraka pušta kroz čist core API i posle SVAKOG koraka se traži:
 *   - stanje: JSON(g.s) === projekcija prototipovog S na poznate ključeve (D11 — ništa više,
 *     ništa manje; dodatni ključ u core-u je greška);
 *   - g.brojacN i g.prosliNivo (sesija, ne čuva se);
 *   - režim čuvanja: `cuvaj` akcije === ono što je prototip tražio od `sacuvaj` u tom koraku,
 *     i `ok` ⇔ prototip je sačuvao (odbijena akcija ne menja ništa i ne čuva).
 * `videno` pravilo (ugovor §4): videno = now tačno kad je `cuvaj !== 'ne'`.
 *
 * Rng core-a je mulberry32(seme traga) — isti tok koji je instrumentovana `novaNarudzba`
 * prototipa trošila, pa narudžbine moraju biti bit-identične (uključujući sort-shuffle).
 *
 * Fiksture se prave sa `npm run parity:gen`; svežinu proverava tests/parity/tragovi.test.ts.
 */
import { isDeepStrictEqual } from 'node:util'
import { describe, expect, it } from 'vitest'
import { MASINE_REDOSLED, SVI_KLJUCEVI, ZIV_REDOSLED } from '../../src/config'
import type { Cuvanje, Igra, Rezultat } from '../../src/core/dogadjaji'
import { igraIzStanja, novaIgra, prebaciZvuk } from '../../src/core/igra'
import { pokreniMasinu, tikMasina } from '../../src/core/masine'
import { isporuci, odbij, osigurajNarudzbe } from '../../src/core/narudzbine'
import { uzmiDnevniPoklon } from '../../src/core/odsustvo'
import { prodaj } from '../../src/core/pijaca'
import { kupiParcelu, posadi, uberi, uberiSve, zalij } from '../../src/core/polja'
import { kupiZgradu } from '../../src/core/radnja'
import { mulberry32 } from '../../src/core/rng'
import { dekodirajSejv, kodirajSejv } from '../../src/core/sejv/dekoder'
import type { Rng, Stanje } from '../../src/core/types'
import { pokupi } from '../../src/core/zivotinje'
import { postojeceFiksture, procitajFiksturu } from '../../tools/parity/fiksture'
import type { Json, Red } from '../../tools/parity/kodek'
import { T0, danKljuc } from '../helpers'

const json = (x: unknown): Json => JSON.parse(JSON.stringify(x)) as Json

/** Prototipov S → samo ključevi koje Stanje poznaje (v2 `kazan`/`kazanT`, `ko`… otpadaju). */
function normalizuj(S: Json): Json {
  const s = S as unknown as Stanje
  return json({
    v: s.v,
    novac: s.novac,
    xp: s.xp,
    parcele: s.parcele.map((p) => ({ c: p.c, t: p.t, z: p.z })),
    mag: Object.fromEntries(SVI_KLJUCEVI.map((k) => [k, s.mag[k]])),
    masine: Object.fromEntries(
      MASINE_REDOSLED.map((id) => [id, { k: s.masine[id].k, t: s.masine[id].t }]),
    ),
    ziv: Object.fromEntries(ZIV_REDOSLED.map((id) => [id, { k: s.ziv[id].k, t: s.ziv[id].t }])),
    narudzbe: s.narudzbe.map((o) => ({
      id: o.id,
      ime: o.ime,
      emoji: o.emoji,
      boja: o.boja,
      msg: o.msg,
      stavke: o.stavke.map((x) => ({ k: x.k, kom: x.kom })),
      din: o.din,
      xp: o.xp,
    })),
    mute: s.mute,
    sadio: s.sadio,
    stat: { ubrano: s.stat.ubrano, zaradjeno: s.stat.zaradjeno, isporuke: s.stat.isporuke },
    poklonDan: s.poklonDan,
    videno: s.videno,
  })
}

interface Provera {
  opis: string
  dobijeno: unknown
  ocekivano: unknown
}

interface Ishod {
  g: Igra
  cuvaj: Cuvanje
  /** Samo za akcije koje vraćaju Rezultat. */
  ok?: boolean
  provere?: Provera[]
}

/** Hladan start (03 §12 „UI boot"): dekodiraj → igraIzStanja → osigurajNarudzbe → poklon →
 *  sacuvaj (odmah ako je poklon dat, inače odloženo), što pečatira videno = now. */
function hladanStart(raw: string | null, now: number, rng: Rng): Ishod & { popravke: unknown } {
  const d = dekodirajSejv(raw, now)
  const g = igraIzStanja(d.stanje)
  osigurajNarudzbe(g, rng)
  const dar = uzmiDnevniPoklon(g, danKljuc(now))
  g.s.videno = now
  return {
    g,
    cuvaj: dar === null ? 'odlozeno' : 'odmah',
    popravke: { vrsta: d.vrsta, popravke: d.vrsta === 'ok' ? d.popravke : null },
    provere: [
      {
        opis: 'vrsta dekodiranog sejva',
        dobijeno: d.vrsta,
        ocekivano: raw === null ? 'prazan' : 'ok',
      },
    ],
  }
}

/** Jedan red traga → poziv(i) core API-ja (07 §d.6, imena iz ugovora §4). */
function izvedi(g: Igra | null, r: Red, rng: Rng): Ishod {
  const now = T0 + r.now
  const a = r.a
  if (a.k === 'boot') return hladanStart(a.raw, now, rng)
  if (g === null) throw new Error('trag ne počinje boot-om')
  const rez = (x: Rezultat): Ishod => {
    if (x.cuvaj !== 'ne') g.s.videno = now
    return { g, cuvaj: x.cuvaj, ok: x.ok }
  }
  switch (a.k) {
    case 'reload': {
      // Igra se gasi i pali; sejv je ono što je core sam zapisao, pa krug kodiranje →
      // dekodiranje mora da prođe bez ijedne popravke (inače bi svaki start pisao rezervu, D10).
      const i = hladanStart(kodirajSejv(g.s), now, rng)
      const sopstveni: Provera = {
        opis: 'sopstveni sejv se dekodira kao ok, bez popravki',
        dobijeno: i.popravke,
        ocekivano: { vrsta: 'ok', popravke: [] },
      }
      return { ...i, provere: [sopstveni] }
    }
    case 'plant':
      return rez(posadi(g, a.i, a.crop, now))
    case 'water':
      return rez(zalij(g, a.i, now))
    case 'harvest':
      return rez(uberi(g, a.i, now))
    case 'harvestAll':
      return rez(uberiSve(g, now))
    case 'sell':
      return rez(prodaj(g, a.item, now))
    case 'deliver':
      return rez(isporuci(g, a.id, now, rng))
    case 'reject':
      return rez(odbij(g, a.id, rng))
    case 'buyPlot':
      return rez(kupiParcelu(g, now))
    case 'buy':
      return rez(kupiZgradu(g, a.id, now))
    case 'startMachine':
      return rez(pokreniMasinu(g, a.id, now))
    case 'collect':
      return rez(pokupi(g, a.id, now))
    case 'toggleMute':
      return rez(prebaciZvuk(g))
    case 'wait': {
      // Skok sata pa JEDAN tick: mašine se završavaju samo ovde.
      const t = tikMasina(g, now)
      if (t.cuvaj !== 'ne') g.s.videno = now
      const strukturno: Provera = {
        opis: 'tikMasina.strukturno ⇔ prototip je u ticku sačuvao (neka mašina je završila)',
        dobijeno: t.strukturno,
        ocekivano: r.cuvaj !== 'ne',
      }
      return { g, cuvaj: t.cuvaj, provere: [strukturno] }
    }
    case 'reset': {
      // UI: confirm → novaIgra (D6: zvuk i današnji poklon ostaju) → sacuvaj(true).
      const n = novaIgra(now, rng, { mute: g.s.mute, poklonDan: g.s.poklonDan })
      n.s.videno = now
      return { g: n, cuvaj: 'odmah' }
    }
    case 'tab':
      // Prototip pri ulasku u tab crta narudžbine, a crtanje zove osigurajNarudzbe (no-op kad ih je 2).
      if (a.tab === 'narudzbe') osigurajNarudzbe(g, rng)
      return { g, cuvaj: 'ne' }
    case 'openList':
    case 'closeList':
    case 'overlayOk':
    case 'jump':
      return { g, cuvaj: 'ne' }
  }
}

/** Posle ovoliko neslaganja u jednom tragu dalji koraci su samo posledica raskoraka. */
const MAX_NESLAGANJA = 3

describe('paritet: tragovi zakrpljenog prototipa kroz core API', () => {
  const imena = postojeceFiksture()

  it('fiksture postoje (npm run parity:gen)', () => {
    expect(imena.length).toBeGreaterThan(0)
  })

  it.each(imena)('%s', (ime) => {
    const trag = procitajFiksturu(ime)
    const rng = mulberry32(trag.zaglavlje.seme)
    let g: Igra | null = null
    let neslaganja = 0
    for (const r of trag.redovi) {
      const oznaka = `${ime} · korak ${r.i} ${JSON.stringify(r.a).slice(0, 80)}`
      let ishod: Ishod
      try {
        ishod = izvedi(g, r, rng)
      } catch (e) {
        throw new Error(`${oznaka}: core je bacio izuzetak: ${String(e)}`, { cause: e })
      }
      g = ishod.g
      const provere: Provera[] = [
        {
          opis: 'stanje, sesija i čuvanje',
          dobijeno: {
            S: json(g.s),
            brojacN: g.brojacN,
            prosliNivo: g.prosliNivo,
            cuvaj: ishod.cuvaj,
            ok: ishod.ok ?? null,
          },
          ocekivano: {
            S: normalizuj(r.S),
            brojacN: r.brojacN,
            prosliNivo: r.prosliNivo,
            cuvaj: r.cuvaj,
            ok: ishod.ok === undefined ? null : r.cuvaj !== 'ne',
          },
        },
        ...(ishod.provere ?? []),
      ]
      let slaze = true
      for (const p of provere) {
        if (isDeepStrictEqual(p.dobijeno, p.ocekivano)) continue
        slaze = false
        expect.soft(p.dobijeno, `${oznaka} — ${p.opis}`).toEqual(p.ocekivano)
      }
      if (!slaze && ++neslaganja >= MAX_NESLAGANJA) break
    }
  })
})
