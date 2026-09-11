// @vitest-environment jsdom
/*
 * UI smoke fuzz (07 §c.4; pokriva C55–C59): prava aplikacija (mountApp) sa fiksturom referenca-sim
 * TEST 5, 400 akcija po semenu sa mešavinom akcija iz referenca-sim-a (R-L295–313), ali SEEDOVANO.
 *
 * Dva režima biranja:
 *   - 'svi'      = originalna lista (R-L300): i dugmad skrivenih tabova i zastarela `.seme` dugmad
 *                  zatvorenog lista (06#2), jsdom isporučuje klik i odvojenim elementima;
 *   - 'dostupni' = samo ono što prst može da pogodi (overlay > list > aktivan tab + nav; tests/ui/dostupno.ts).
 * Pre svakog tapa protekne nasumično 0–1300 ms perf vremena, pa se D15 zaključavanja i otpuštaju i
 * pogađaju. Tajmeri: 'odmah' (07 §c.4) i dodatno 'red' (180 ms prozor posle žetve ostaje otvoren dok
 * fuzz tapka — tu živi 06#1).
 *
 * Posle SVAKOG koraka: I1–I4 (07 §c.3) nad `h.stanje()`, plus UI invarijante: tačno 2 `[data-isporuci]`
 * sa ID-jevima iz stanja, `nav` postoji, HUD (`#novac`, `#nivoBr`) prati stanje. Na kraju C55–C59 nad
 * sačuvanim sejvom (posle smirivanja), sejv = stanje, i nijedna neuhvaćena greška (window 'error',
 * process 'uncaughtException'/'unhandledRejection', izuzeci iz ticka i tajmera).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  MAX_PARCELA,
  NARUDZBINA_AKTIVNIH,
  NARUDZBINA_KOM_MAX,
  NARUDZBINA_KOM_MIN,
  REDOSLED,
  SEJV_ODLAGANJE_MS,
  SVI_KLJUCEVI,
} from '../../src/config'
import { narPool, nivoIzXp } from '../../src/core'
import { fmt, t } from '../../src/i18n'
import { DAN_T0, MAG0, T0, mulberry32, stanje } from '../helpers'
import { mountApp, type Montirana } from '../helpers/mountApp'
import { dostupniTapovi, izaberi } from './dostupno'

type Biranje = 'svi' | 'dostupni'
type Tajmeri = 'odmah' | 'red'

/** referenca-sim TEST 5 (R-L270): 600 din, xp 200 (nivo 4), ništa ne raste, poklon danas već uzet. */
const TEST5 = stanje({
  novac: 600,
  xp: 200,
  mute: true,
  sadio: true,
  poklonDan: DAN_T0,
  videno: T0,
  mag: { ...MAG0 },
})

/** Dodatni start za dostupni režim: nivo 8, bogat magacin, poklon na startu (kartica pre svega). */
const BOGAT = stanje({
  novac: 20_000,
  xp: 5000,
  mute: false,
  poklonDan: '',
  mag: { ...MAG0, psenica: 20, sargarepa: 10, paprika: 9, bundeva: 2 },
})

/** referenca-sim R-L300, doslovno. */
const SVI_SEL =
  '.parcela, .seme:not([disabled]), [data-prodaj], [data-isporuci]:not([disabled]), [data-odbij],' +
  ' [data-kuvaj]:not([disabled]), [data-pokupi]:not([disabled]), [data-kupi]:not([disabled]),' +
  ' #uberiSve, #nivoOk'

const PAUZE = [0, 0, 100, 299, 300, 700, 1300] as const

function opisEl(el: HTMLElement | undefined): string {
  if (!el) return '∅'
  const d = Object.entries(el.dataset)
    .map(([k, v]) => `${k}=${v ?? ''}`)
    .join(',')
  return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}.${el.className}[${d}]`
}

/** I1–I4 (07 §c.3) + UI invarijante; vraća spisak prekršaja. `dar` = iznos dnevnog poklona sa starta:
 *  dok je njegova kartica otvorena HUD sme da pokazuje novac BEZ poklona (04 §2.10 — sustiže na „Hvala!"). */
function invarijante(h: Montirana, dar: number): string[] {
  const s = h.stanje()
  const g = h.igra()
  const now = h.sad()
  const f: string[] = []
  const u = (ok: boolean, inv: string, d: string) => {
    if (!ok) f.push(`${inv}: ${d}`)
  }
  u(Number.isInteger(s.novac) && s.novac >= 0, 'I1', `novac ${s.novac}`)
  u(
    JSON.stringify(Object.keys(s.mag).sort()) === JSON.stringify([...SVI_KLJUCEVI].sort()),
    'I2',
    `ključevi magacina ${Object.keys(s.mag).join(',')}`,
  )
  for (const k of SVI_KLJUCEVI) {
    u(Number.isInteger(s.mag[k]) && s.mag[k] >= 0, 'I2', `mag.${k} = ${s.mag[k]}`)
  }
  u(s.parcele.length >= 2 && s.parcele.length <= MAX_PARCELA, 'I3', `${s.parcele.length} parcela`)
  s.parcele.forEach((p, i) => {
    if (p.c === null) u(p.t === 0 && !p.z, 'I3', `prazna parcela ${i} ${JSON.stringify(p)}`)
    else {
      u((REDOSLED as readonly string[]).includes(p.c), 'I3', `kultura ${String(p.c)}`)
      u(Number.isInteger(p.t) && p.t > 0 && p.t <= now, 'I3', `parcela ${i} t ${p.t} (now ${now})`)
    }
  })
  u(s.narudzbe.length === NARUDZBINA_AKTIVNIH, 'I4', `${s.narudzbe.length} narudžbina`)
  const ids = s.narudzbe.map((o) => o.id)
  u(new Set(ids).size === ids.length, 'I4', `duplikat ID ${ids.join(',')}`)
  u(
    ids.every((id) => Number.isInteger(id) && id > 0 && id < g.brojacN),
    'I4',
    `ID ${ids.join(',')} / brojacN ${g.brojacN}`,
  )
  const pool = narPool(s)
  for (const o of s.narudzbe) {
    const k = o.stavke.map((st) => st.k)
    u(o.stavke.length >= 1 && o.stavke.length <= 2, 'I4', `narudžbina ${o.id}: ${k.length} stavki`)
    u(new Set(k).size === k.length, 'I4', `narudžbina ${o.id}: iste stavke`)
    for (const st of o.stavke) {
      u(pool.includes(st.k), 'I4', `${st.k} nije u pool-u`)
      u(
        Number.isInteger(st.kom) && st.kom >= NARUDZBINA_KOM_MIN && st.kom <= NARUDZBINA_KOM_MAX,
        'I4',
        `kom ${st.kom}`,
      )
    }
    u(o.din > 0 && o.din % 5 === 0, 'I4', `din ${o.din}`)
    u(Number.isInteger(o.xp) && o.xp >= 3, 'I4', `xp ${o.xp}`)
  }
  // UI: tabla narudžbina je uvek nacrtana iz stanja; HUD je dostignut (rAF u harnesu je trenutan).
  const dugmad = h.qa('[data-isporuci]').map((b) => Number(b.dataset.isporuci))
  u(JSON.stringify(dugmad) === JSON.stringify(ids), 'UI', `[data-isporuci] ${dugmad} ≠ ${ids}`)
  u(h.q('nav') !== null, 'UI', 'nav ne postoji')
  const hud = h.q('#novac')?.textContent
  const poklonOtvoren =
    h.q('#nivoVeo.otvoren') !== null && h.q('#nivoKartica h3')?.textContent === t.poklon.naslov
  u(
    hud === fmt(s.novac) || (poklonOtvoren && hud === fmt(s.novac - dar)),
    'UI',
    `#novac ${hud} (stanje ${s.novac}, poklon ${dar})`,
  )
  const n = nivoIzXp(s.xp)
  u(h.q('#nivoBr')?.textContent === String(n.lvl), 'UI', `#nivoBr ${h.q('#nivoBr')?.textContent}`)
  // XP traka posle SVAKOG dobitka XP-a (i u ticku): ista vrednost kao prototipov crtajNivo (L768),
  // serijalizovana kroz isti CSSOM.
  const ocekivano = h.q('#xpTraka')?.cloneNode() as HTMLElement | undefined
  if (ocekivano) ocekivano.style.width = Math.min(100, (n.u / n.do) * 100) + '%'
  u(
    h.q('#xpTraka')?.style.width === ocekivano?.style.width,
    'UI',
    `#xpTraka ${h.q('#xpTraka')?.style.width} ≠ ${ocekivano?.style.width} (xp ${s.xp})`,
  )
  return f
}

let neuhvaceno: string[] = []
const naIzuzetak = (e: unknown) => {
  neuhvaceno.push('uncaughtException: ' + String(e instanceof Error ? e.stack : e))
}
const naOdbijanje = (e: unknown) => {
  neuhvaceno.push('unhandledRejection: ' + String(e instanceof Error ? e.stack : e))
}
beforeEach(() => {
  neuhvaceno = []
  process.on('uncaughtException', naIzuzetak)
  process.on('unhandledRejection', naOdbijanje)
})
afterEach(() => {
  process.off('uncaughtException', naIzuzetak)
  process.off('unhandledRejection', naOdbijanje)
})

async function fuzz(
  sejv: object,
  biranje: Biranje,
  tajmeri: Tajmeri,
  seme: number,
  koraka = 400,
): Promise<{ h: Montirana; tapova: number }> {
  const h = await mountApp({
    sejv,
    tajmeri,
    random: mulberry32(seme),
    fxRandom: mulberry32(seme ^ 0x9e3779b9),
  })
  const pocetni = (sejv as { novac: number }).novac
  const dar =
    h.q('#nivoKartica h3')?.textContent === t.poklon.naslov ? h.stanje().novac - pocetni : 0
  const r = mulberry32(seme ^ 0xa5a5a5a5)
  const rnd = <T>(a: readonly T[]): T | undefined => a[Math.floor(r() * a.length)]
  const istorija: string[] = []
  const greske: string[] = []
  let tapova = 0
  for (let i = 0; i < koraka; i++) {
    const a = r()
    let opis = ''
    try {
      if (a < 0.55) {
        h.pauza(rnd(PAUZE) ?? 0)
        let el: HTMLElement | undefined
        if (biranje === 'svi') el = rnd(h.qa(a < 0.3 ? SVI_SEL : 'nav [data-tab]'))
        else {
          const tap = izaberi(dostupniTapovi(h), r)
          el = h.qa(tap.sel)[tap.i]
        }
        opis = 'tap ' + opisEl(el)
        if (h.klik(el)) tapova++
        await h.mikro() // reset čeka `await dialog.confirm`
      } else if (a < 0.75) {
        const ms = Math.floor(5000 + r() * 600_000)
        opis = `skok ${ms} + tik`
        h.skok(ms)
        h.tik()
      } else if (a < 0.9) {
        opis = 'tik ×2'
        h.tik(2)
      } else {
        opis = 'zatvori list i kartice'
        if (biranje === 'svi') {
          if (h.q('#list.otvoren')) h.klik('#veo')
          h.zatvoriOverlaye()
        } else {
          // Prst: kartica je iznad lista, pa prvo kartice, pa pozadina lista.
          h.zatvoriOverlaye()
          if (h.q('#list.otvoren')) {
            h.pauza(300)
            h.klik('#veo')
          }
        }
      }
    } catch (e) {
      greske.push(
        `korak ${i} (${opis}): ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`,
      )
    }
    istorija.push(opis)
    if (istorija.length > 12) istorija.shift()
    const f = invarijante(h, dar)
    if (f.length > 0 || greske.length > 0 || h.greske.length > 0) {
      expect(
        { invarijante: f, greske, greskeProzora: h.greske },
        `seme ${seme} (${biranje}/${tajmeri}), korak ${i}; poslednje akcije: ${istorija.join(' → ')}`,
      ).toEqual({ invarijante: [], greske: [], greskeProzora: [] })
    }
  }
  // Smiri: odloženi upis (i 'red' tajmeri) stižu na disk.
  h.pauza(SEJV_ODLAGANJE_MS + 100)
  return { h, tapova }
}

function zavrsneProvere(h: Montirana): void {
  expect(h.q('nav'), 'C55 UI živ posle fuzz testa').not.toBeNull()
  expect(h.qa('[data-isporuci]'), 'C56 i dalje tačno 2 narudžbine').toHaveLength(2)
  const sacuvano = h.sacuvano() as {
    novac: unknown
    mag: Record<string, unknown>
    parcele: unknown[]
  } | null
  expect(sacuvano, 'sejv postoji').not.toBeNull()
  if (!sacuvano) return
  expect(typeof sacuvano.novac === 'number' && sacuvano.novac >= 0, 'C57 novac').toBe(true)
  expect(Object.keys(sacuvano.mag).sort(), 'C58 ključevi magacina').toEqual(
    [...SVI_KLJUCEVI].sort(),
  )
  expect(
    Object.values(sacuvano.mag).every((v) => Number.isInteger(v) && (v as number) >= 0),
    'C58 magacin bez negativnih/razlomljenih količina',
  ).toBe(true)
  expect(sacuvano.parcele.length, 'C59 broj parcela').toBeLessThanOrEqual(MAX_PARCELA)
  // Posle smirivanja sejv je TAČNO tekuće stanje (nijedan upis nije ostao na čekanju).
  expect(sacuvano).toEqual(JSON.parse(JSON.stringify(h.stanje())))
  expect(h.greske, 'greške u handlerima').toEqual([])
  expect(neuhvaceno, 'neuhvaćene greške').toEqual([])
}

describe('UI smoke fuzz (07 §c.4) — TEST 5 fikstura, 400 akcija', () => {
  const SLUCAJEVI: { biranje: Biranje; tajmeri: Tajmeri; seme: number }[] = [
    ...[1, 2].map((seme) => ({ biranje: 'svi' as const, tajmeri: 'odmah' as const, seme })),
    ...[4, 5].map((seme) => ({ biranje: 'dostupni' as const, tajmeri: 'odmah' as const, seme })),
    { biranje: 'svi', tajmeri: 'red', seme: 7 },
    { biranje: 'dostupni', tajmeri: 'red', seme: 9 },
  ]
  it.each(SLUCAJEVI)(
    '$biranje / tajmeri $tajmeri / seme $seme',
    async ({ biranje, tajmeri, seme }) => {
      const { h, tapova } = await fuzz(TEST5, biranje, tajmeri, seme)
      expect(tapova, 'fuzz stvarno tapka').toBeGreaterThan(150)
      zavrsneProvere(h)
    },
    30_000,
  )
})

describe('UI smoke fuzz — bogat start (poklon na startu, sve zgrade dostupne)', () => {
  it.each([11])(
    'dostupni / tajmeri red / seme %i',
    async (seme) => {
      const { h } = await fuzz(BOGAT, 'dostupni', 'red', seme)
      zavrsneProvere(h)
      // Hod je stigao do zgrada (inače bogat start ništa ne dodaje).
      const s = h.stanje()
      expect(s.masine.mlin.k || s.masine.kazan.k || s.ziv.kokosinjac.k || s.ziv.stala.k).toBe(true)
    },
    30_000,
  )
})
