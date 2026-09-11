/*
 * README.md ne sme da odstupi od src/config (CLAUDE.md: „config + testovi + tabela u README u istom
 * komitu"). Tri nivoa:
 *   1. deo između oznaka je TAČNO izlaz generatora (tools/readme/balans.ts) u Prettier obliku;
 *   2. tabele se parsiraju iz README-a i nezavisno porede sa config-om (i sa core `nivoIzXp`), pa ni
 *      pogrešna kolona u generatoru ne prolazi;
 *   3. formule iz README-a se IZRAČUNAJU i porede sa config funkcijama, pa tekst formule ne može da
 *      zastari kad se promeni oblik formule.
 * Komande iz tabele komandi moraju postojati u package.json.
 * Posle promene balansa: `node tools/readme/generisi.mjs`.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as prettier from 'prettier'
import { describe, expect, it } from 'vitest'
import {
  KULTURE,
  MASINE,
  MASINE_REDOSLED,
  MAX_NIVO,
  MAX_PARCELA,
  POCETNE_PARCELE,
  PROIZVODI,
  PROIZVODI_REDOSLED,
  REDOSLED,
  SVI_KLJUCEVI,
  ZIV,
  ZIV_REDOSLED,
  baznaCena,
  cenaParcele,
  ciljNarudzbine,
  dnevniPoklon,
  nagradaDin,
  nagradaXp,
  nivoBonus,
  xpZaNivo,
} from '../../src/config'
import { trzisnaCena } from '../../src/core/pijaca'
import { nivoIzXp } from '../../src/core/xp'
import { t } from '../../src/i18n'
import { fmt, trajanjeTxt } from '../../src/i18n/format'
import { izReadmea, tabelaBalansa } from '../../tools/readme/balans'

const PUTANJA = fileURLToPath(new URL('../../README.md', import.meta.url))
const README = readFileSync(PUTANJA, 'utf8')
const BALANS = izReadmea(README)
const din = (n: number) => fmt(n) + ' din'

/** Redovi (ćelije) tabele ispod naslova `### <naslov>` u delu sa balansom, bez reda poravnanja. */
function tabela(naslov: string): string[][] {
  const deo = BALANS.split(/^### /m).find((d) => d.startsWith(naslov + '\n'))
  if (!deo) throw new Error(`README: nema sekcije „${naslov}“`)
  return deo
    .split('\n')
    .filter((l) => l.startsWith('|') && !/^\|[\s:|-]+\|$/.test(l))
    .map((l) =>
      l
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim()),
    )
}

/** i-ti isečak koda (između backtick-ova) u stavci „Formule i pravila“ koja počinje sa `**oznaka`. */
function kod(oznaka: string, i = 0): string {
  const linija = BALANS.split('\n').find((l) => l.startsWith(`- **${oznaka}`))
  const x = linija?.split('`').filter((_, j) => j % 2 === 1)[i]
  if (x === undefined) throw new Error(`README: nema formule „${oznaka}“ [${i}]`)
  return x
}

/** Formula iz README-a kao JS funkcija (·, ^, −, 2π, round/ceil/max/min/sin). */
function formula(izraz: string, ...promenljive: string[]): (...a: number[]) => number {
  const js = izraz
    .replaceAll('·', '*')
    .replaceAll('^', '**')
    .replaceAll('−', '-')
    .replaceAll('2π', '(2 * Math.PI)')
    .replaceAll(' ms', '')
    .replace(/(?<![.\w])(round|ceil|max|min|sin)\(/g, 'Math.$1(')
  return new Function(...promenljive, `return ${js}`) as (...a: number[]) => number
}

describe('README.md — tabela balansa', () => {
  it('deo između oznaka je tačno izlaz generatora (pokreni `node tools/readme/generisi.mjs`)', async () => {
    const opcije = (await prettier.resolveConfig(PUTANJA)) ?? {}
    const ocekivano = await prettier.format(tabelaBalansa(), { ...opcije, parser: 'markdown' })
    expect(BALANS, 'README zaostaje za src/config').toBe(ocekivano.trim())
  })

  it('kulture, proizvodi, mašine, životinje = config (nezavisno od generatora)', () => {
    expect(tabela('Kulture').slice(1)).toEqual(
      REDOSLED.map((k) => {
        const K = KULTURE[k]
        return [
          t.kulture[k].naziv,
          din(K.seme),
          trajanjeTxt(K.vreme),
          din(K.cena),
          String(K.xp),
          String(K.nivo),
        ]
      }),
    )
    const pr = tabela('Proizvodi').slice(1)
    expect(pr.map((r) => r.slice(0, 2))).toEqual(
      PROIZVODI_REDOSLED.map((p) => [t.proizvodi[p].naziv, din(PROIZVODI[p].cena)]),
    )
    const ma = tabela('Mašine').slice(1)
    expect(ma.map((r) => [r[0], r[1], r[2], r[4], r[5]])).toEqual(
      MASINE_REDOSLED.map((id) => {
        const M = MASINE[id]
        return [t.masine[id].naziv, din(M.cena), String(M.nivo), trajanjeTxt(M.vreme), String(M.xp)]
      }),
    )
    for (const [i, id] of MASINE_REDOSLED.entries()) {
      expect(ma[i]?.[3]).toMatch(new RegExp(`^${MASINE[id].ulazN} × .+ → 1 × .+$`))
    }
    expect(tabela('Životinje').slice(1)).toEqual(
      ZIV_REDOSLED.map((id) => {
        const Z = ZIV[id]
        return [
          t.zivotinje[id].naziv,
          din(Z.cena),
          String(Z.nivo),
          t.proizvodi[Z.proizvod].naziv.toLowerCase(),
          trajanjeTxt(Z.interval),
          String(Z.kap),
          String(Z.xpPo),
        ]
      }),
    )
  })

  it('parcele i nivoi = config; „Ukupno XP“ je tačno prag nivoa po core nivoIzXp', () => {
    const pa = tabela('Parcele').slice(1)
    expect(pa).toHaveLength(MAX_PARCELA - POCETNE_PARCELE)
    for (const [i, r] of pa.entries()) {
      const n = POCETNE_PARCELE + i
      expect(r).toEqual([`${n + 1}.`, din(cenaParcele(n))])
    }
    const ni = tabela('Nivoi').slice(1)
    expect(ni).toHaveLength(MAX_NIVO)
    for (const [i, r] of ni.entries()) {
      const l = i + 1
      expect(r[0]).toBe(String(l))
      if (l < MAX_NIVO) expect(r[1]).toBe(fmt(xpZaNivo(l)))
      const ukupno = Number((r[2] ?? '').replaceAll('.', ''))
      expect(nivoIzXp(ukupno).lvl).toBe(l)
      if (l > 1) expect(nivoIzXp(ukupno - 1).lvl).toBe(l - 1)
      expect(r[3]).toBe(l > 1 ? din(nivoBonus(l)) : '—')
      expect(r[4]).toBe(din(dnevniPoklon(l)))
    }
  })

  it('formule iz README-a računaju isto što i config/core', () => {
    const parcela = formula(kod('Cena sledeće parcele'), 'n')
    for (let n = POCETNE_PARCELE; n <= MAX_PARCELA; n++) expect(parcela(n)).toBe(cenaParcele(n))

    const xp = formula(kod('XP za nivo l'), 'l')
    const bonus = formula(kod('XP za nivo l', 1), 'l')
    const poklon = formula(kod('Dnevni poklon'), 'l')
    for (let l = 1; l <= MAX_NIVO + 5; l++) {
      expect(xp(l)).toBe(xpZaNivo(l))
      expect(bonus(l)).toBe(nivoBonus(l))
      expect(poklon(l)).toBe(dnevniPoklon(l))
    }

    const cilj = formula(kod('Cilj narudžbine'), 'lvl', 'r')
    const nagDin = formula(kod('Nagrada narudžbine'), 'vrednost')
    const nagXp = formula(kod('Nagrada narudžbine', 1), 'vrednost')
    for (let lvl = 1; lvl <= MAX_NIVO; lvl++) {
      for (const r of [0, 0.25, 0.5, 0.999]) expect(cilj(lvl, r)).toBe(ciljNarudzbine(lvl, r))
    }
    for (let v = 0; v <= 5000; v += 7) {
      expect(nagDin(v)).toBe(nagradaDin(v))
      expect(nagXp(v)).toBe(nagradaXp(v))
    }

    const cena = formula(kod('Tržišna cena'), 'baza', 't', 'idx')
    for (const [idx, k] of SVI_KLJUCEVI.entries()) {
      for (let tt = 0; tt < 600_000; tt += 4_999) {
        expect(cena(baznaCena(k), tt, idx), `${k} @${tt}`).toBe(trzisnaCena(k, tt).cena)
      }
    }
  })
})

describe('README.md — komande', () => {
  it('svaka `npm run …` komanda iz tabele postoji u package.json', () => {
    const pkg = JSON.parse(
      readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
    ) as { scripts: Record<string, string> }
    const komande = [...README.matchAll(/`npm run ([\w:-]+)`/g)].map((m) => m[1] ?? '')
    expect(komande.length).toBeGreaterThan(5)
    for (const k of komande) expect(Object.keys(pkg.scripts), k).toContain(k)
  })
})
