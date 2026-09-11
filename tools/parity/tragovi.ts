/*
 * Drajver prototipa za DIFFERENTIAL PARITET (port `diff-proto.cjs` iz revizije, 07 §d).
 *
 * Učitava ZAKRPLJEN prototip (ZAKRPE, ugovor §3) u jsdom sa potpuno virtuelnim satom
 * (`Date.now()` i `new Date()` = T0 + pomak), `Math.random` iz `novaNarudzba` preusmerenim na
 * poseban tok (`window.__rngN` = mulberry32(seme)), FX na drugom toku, uhvaćenim tickom i
 * trenutnim `setTimeout`-om. Zatim izvodi korake koje prst može da dohvati i posle svakog beleži
 * `{i, a, now, S, brojacN, prosliNivo, cuvaj}` — dovoljno da čist core ponovi isti niz poziva.
 *
 * Dva režima: nasumični (`dostupno()` + ponderisan izbor, identično revizijinom drajveru) i
 * skriptovani (semantičke akcije; razrešivač sam zatvara overlay/list i menja tab, pa te korake
 * upisuje u trag kao prave dodire). Skripta može i da „zatvori i ponovo otvori" igru (`reload`):
 * nova jsdom instanca bootuje iz sačuvanog sejva kasnije (ili ranije) na satu.
 */
import { createHash } from 'node:crypto'
import {
  KLJUC_SEJVA,
  jeArtikal,
  jeKultura,
  type ArtikalId,
  type KulturaId,
  type MasinaId,
  type ZgradaId,
  type ZivotinjaId,
} from '../../src/config'
import type { Cuvanje } from '../../src/core/dogadjaji'
import { mulberry32 } from '../../src/core/rng'
import {
  PROTOTIP_HTML,
  instrumentujNarudzbine,
  primeniZakrpe,
  ucitajPrototip,
  type Prototip,
} from '../../tests/helpers/prototip'
import { FORMAT_TRAGA, VERZIJA_TRAGA, type Json, type Red, type Trag } from './kodek'
import { INSTRUMENT_CUVANJE, ZAKRPE } from './zakrpe'

/** 15. 1. 2026. u 10:00 po beogradskom vremenu (isto kao tests/helpers T0). */
export const T0 = Date.UTC(2026, 0, 15, 9, 0, 0)

export type Tab = 'farma' | 'narudzbe' | 'pijaca' | 'radnja'

/** Semantička akcija reda traga (rečnik iz 07 §d.3 + `reload` i `jump`). */
export type Akcija =
  | { k: 'boot'; start: string; raw: string | null }
  /** Hladan start: igra zatvorena, sat pomeren za ms (može i unazad), boot iz sačuvanog sejva. */
  | { k: 'reload'; ms: number }
  /** Sat pomeren BEZ ticka (promena sata na uređaju pa tap pre sledećeg otkucaja). */
  | { k: 'jump'; ms: number }
  | { k: 'openList'; i: number }
  | { k: 'plant'; i: number; crop: KulturaId }
  | { k: 'closeList' }
  | { k: 'water'; i: number }
  | { k: 'harvest'; i: number }
  | { k: 'harvestAll' }
  | { k: 'sell'; item: ArtikalId }
  | { k: 'deliver'; id: number }
  | { k: 'reject'; id: number }
  | { k: 'buyPlot' }
  | { k: 'buy'; id: ZgradaId }
  | { k: 'startMachine'; id: MasinaId }
  | { k: 'collect'; id: ZivotinjaId }
  | { k: 'wait'; ms: number }
  | { k: 'tab'; tab: Tab }
  | { k: 'toggleMute' }
  | { k: 'reset' }
  | { k: 'overlayOk' }

/** Korak skripte: kao Akcija, ali `deliver`/`reject` bez `id` gađaju prvu dostupnu narudžbinu.
 *  `dupliTap` ponovo klikne ISTI element kao prethodni korak — samo posle `plant` (list se još
 *  zatvara, D2) ili `harvest` (pločica sa zastarelim handlerom pre crtanja posle 180 ms, D1);
 *  u trag se upisuje ista semantička akcija. */
export type KorakSkripte =
  | Exclude<Akcija, { k: 'boot' } | { k: 'deliver' } | { k: 'reject' }>
  | { k: 'deliver'; id?: number }
  | { k: 'reject'; id?: number }
  | { k: 'dupliTap' }

export interface Start {
  ime: string
  /** Sirov sadržaj skladišta pod KLJUC_SEJVA, ili null (nova igra). */
  raw: string | null
}

export interface OpcijeTraga {
  ime: string
  seme: number
  start: Start
  /** Nasumični režim: broj koraka. */
  koraka?: number
  /** Skriptovani režim: niz koraka (tada se `koraka` ignoriše). */
  skripta?: readonly KorakSkripte[]
}

// ── Orakl ───────────────────────────────────────────────────────────────────────

/** Prototip + odobrena odstupanja + instrumentacija (narudžbine na svom toku, beleženje čuvanja). */
export function oraklHtml(html: string = PROTOTIP_HTML): string {
  return primeniZakrpe(instrumentujNarudzbine(primeniZakrpe(html, ZAKRPE)), [INSTRUMENT_CUVANJE])
}

export function otisak(html: string): string {
  return createHash('sha256').update(html).digest('hex').slice(0, 16)
}

// ── Dostupne akcije ─────────────────────────────────────────────────────────────

interface Opcija {
  a: Akcija
  el: HTMLElement | null
  tezina: number
}

const TABOVI: readonly Tab[] = ['farma', 'narudzbe', 'pijaca', 'radnja']

function tab(x: string | undefined): Tab {
  const t = TABOVI.find((v) => v === x)
  if (t === undefined) throw new Error(`nepoznat tab ${String(x)}`)
  return t
}
function kultura(x: string | undefined): KulturaId {
  if (!jeKultura(x)) throw new Error(`nepoznata kultura ${String(x)}`)
  return x
}
function artikal(x: string | undefined): ArtikalId {
  if (!jeArtikal(x)) throw new Error(`nepoznat artikal ${String(x)}`)
  return x
}
function zgrada(x: string | undefined): ZgradaId {
  if (x === 'mlin' || x === 'kazan' || x === 'kokosinjac' || x === 'stala') return x
  throw new Error(`nepoznata zgrada ${String(x)}`)
}
function masina(x: string | undefined): MasinaId {
  if (x === 'mlin' || x === 'kazan') return x
  throw new Error(`nepoznata mašina ${String(x)}`)
}
function zivotinja(x: string | undefined): ZivotinjaId {
  if (x === 'kokosinjac' || x === 'stala') return x
  throw new Error(`nepoznata životinja ${String(x)}`)
}
function broj(x: string | undefined): number {
  const n = Number(x)
  if (x === undefined || !Number.isFinite(n)) throw new Error(`nije broj: ${String(x)}`)
  return n
}

/** Ono što prst može da pogodi: z-redosled (#nivoVeo 80 > #list 41 > #veo 40 > nav 30), samo
 *  aktivni tab, bez disabled dugmadi. Redosled i težine su IDENTIČNI revizijinom drajveru. */
export function dostupno(p: Prototip): Opcija[] {
  if (p.q('#nivoVeo.otvoren')) return [{ a: { k: 'overlayOk' }, el: p.q('#nivoOk'), tezina: 1 }]
  if (p.q('#list.otvoren')) {
    const semena = p.qa('#semena [data-seme]:not([disabled])')
    const iz = p.ev<number>('izabrana')
    const op: Opcija[] = semena.map((el) => ({
      a: { k: 'plant', i: iz, crop: kultura(el.dataset.seme) },
      el,
      tezina: 6 / Math.max(1, semena.length),
    }))
    op.push({ a: { k: 'closeList' }, el: p.q('#veo'), tezina: 1 })
    return op
  }
  const aktivan = tab(p.q('nav button.aktivan')?.dataset.tab)
  const op: Opcija[] = []
  for (const b of p.qa('nav [data-tab]')) {
    op.push({ a: { k: 'tab', tab: tab(b.dataset.tab) }, el: b, tezina: 0.3 })
  }
  op.push({ a: { k: 'wait', ms: 0 }, el: null, tezina: 1.2 })
  if (aktivan === 'farma') {
    for (const el of p.qa('#njive .parcela')) {
      let a: Akcija
      if (el.classList.contains('zakljucana')) a = { k: 'buyPlot' }
      else if (el.classList.contains('prazna')) a = { k: 'openList', i: broj(el.dataset.i) }
      else if (el.classList.contains('zrelo')) a = { k: 'harvest', i: broj(el.dataset.i) }
      // parcela koja raste: onclick = zalijBiljku (no-op ako je u međuvremenu sazrela)
      else a = { k: 'water', i: broj(el.dataset.i) }
      op.push({ a, el, tezina: a.k === 'buyPlot' ? 0.5 : 1.5 })
    }
    const us = p.q('#uberiSve')
    if (us) op.push({ a: { k: 'harvestAll' }, el: us, tezina: 1 })
    for (const el of p.qa('[data-kuvaj]:not([disabled])')) {
      op.push({ a: { k: 'startMachine', id: masina(el.dataset.kuvaj) }, el, tezina: 1 })
    }
    for (const el of p.qa('[data-pokupi]:not([disabled])')) {
      op.push({ a: { k: 'collect', id: zivotinja(el.dataset.pokupi) }, el, tezina: 1 })
    }
  } else if (aktivan === 'narudzbe') {
    for (const el of p.qa('[data-isporuci]:not([disabled])')) {
      op.push({ a: { k: 'deliver', id: broj(el.dataset.isporuci) }, el, tezina: 2 })
    }
    for (const el of p.qa('[data-odbij]')) {
      op.push({ a: { k: 'reject', id: broj(el.dataset.odbij) }, el, tezina: 1 })
    }
  } else if (aktivan === 'pijaca') {
    for (const el of p.qa('[data-prodaj]')) {
      op.push({ a: { k: 'sell', item: artikal(el.dataset.prodaj) }, el, tezina: 1 })
    }
  } else {
    for (const el of p.qa('[data-kupi]:not([disabled])')) {
      op.push({ a: { k: 'buy', id: zgrada(el.dataset.kupi) }, el, tezina: 2 })
    }
    op.push({ a: { k: 'toggleMute' }, el: p.q('#zvukDugme'), tezina: 0.2 })
    op.push({ a: { k: 'reset' }, el: p.q('#resetDugme'), tezina: 0.02 })
  }
  return op
}

function izaberi(op: readonly Opcija[], drv: () => number): Opcija {
  const tot = op.reduce((s, x) => s + (x.tezina || 1), 0)
  let r = drv() * tot
  for (const x of op) {
    r -= x.tezina || 1
    if (r <= 0) return x
  }
  const poslednja = op[op.length - 1]
  if (poslednja === undefined) throw new Error('nema dostupnih akcija')
  return poslednja
}

/** 50 %: 1 s · 35 %: 5–60 s · 15 %: 1–15 min (kao revizija). */
function trajanjeCekanja(drv: () => number): number {
  const r = drv()
  if (r < 0.5) return 1000
  if (r < 0.85) return 5000 + Math.floor(drv() * 55000)
  return 60000 + Math.floor(drv() * 840000)
}

// ── Skriptovani razrešivač ──────────────────────────────────────────────────────

const TAB_AKCIJE: Partial<Record<KorakSkripte['k'], Tab>> = {
  openList: 'farma',
  plant: 'farma',
  water: 'farma',
  harvest: 'farma',
  harvestAll: 'farma',
  buyPlot: 'farma',
  startMachine: 'farma',
  collect: 'farma',
  deliver: 'narudzbe',
  reject: 'narudzbe',
  sell: 'pijaca',
  buy: 'radnja',
  toggleMute: 'radnja',
  reset: 'radnja',
}

function odgovara(o: Akcija, k: KorakSkripte): boolean {
  if (o.k !== k.k) return false
  switch (k.k) {
    case 'openList':
    case 'water':
    case 'harvest':
      return 'i' in o && o.i === k.i
    case 'plant':
      return o.k === 'plant' && o.i === k.i && o.crop === k.crop
    case 'sell':
      return o.k === 'sell' && o.item === k.item
    case 'deliver':
    case 'reject':
      return k.id === undefined || ('id' in o && o.id === k.id)
    case 'buy':
    case 'startMachine':
    case 'collect':
      return 'id' in o && o.id === k.id
    case 'tab':
      return o.k === 'tab' && o.tab === k.tab
    default:
      return true
  }
}

// ── Generator ───────────────────────────────────────────────────────────────────

type ProzorOrakla = Prototip['w'] & { __cuvanja?: string[] }

function uzmiCuvanja(p: Prototip): Cuvanje {
  const w = p.w as ProzorOrakla
  const c = w.__cuvanja ?? []
  w.__cuvanja = []
  return c.includes('odmah') ? 'odmah' : c.length > 0 ? 'odlozeno' : 'ne'
}

export async function generisiTrag(o: OpcijeTraga): Promise<Trag> {
  const html = oraklHtml()
  const seme = o.seme >>> 0
  const fxRng = mulberry32(seme ^ 0x9e3779b9)
  const ordRng = mulberry32(seme)
  const drv = mulberry32(seme ^ 0xa5a5a5a5)
  const greske: string[] = []

  const pokreni = (t0: number, raw: string | null | undefined) =>
    ucitajPrototip({
      html,
      t0,
      tajmeri: 'odmah',
      random: fxRng,
      rngNarudzbina: ordRng,
      skladiste: raw == null ? undefined : { [KLJUC_SEJVA]: raw },
    })

  let p = await pokreni(T0, o.start.raw)
  const redovi: Red[] = []
  const snimi = (a: Akcija): void => {
    redovi.push({
      i: redovi.length,
      a,
      now: p.w.Date.now() - T0,
      S: p.S() as Json,
      brojacN: p.ev<number>('brojacN'),
      prosliNivo: p.ev<number>('prosliNivo'),
      cuvaj: uzmiCuvanja(p),
    })
  }
  let poslednji: Opcija | null = null
  const izvedi = (x: Opcija): void => {
    if (x.a.k === 'wait') throw new Error('wait se ne klikće')
    if (!p.klik(x.el)) throw new Error(`nema elementa za ${JSON.stringify(x.a)}`)
    poslednji = x
    snimi(x.a)
  }
  const nadji = (k: KorakSkripte): Opcija | undefined => dostupno(p).find((x) => odgovara(x.a, k))
  const moraj = (k: KorakSkripte, n: number): Opcija => {
    const x = nadji(k)
    if (x) return x
    const ima = dostupno(p).map((y) => JSON.stringify(y.a))
    throw new Error(
      `skripta ${o.ime}, korak ${n}: ${JSON.stringify(k)} nije dostupno; dostupno: ${ima.join(' ')}`,
    )
  }

  snimi({ k: 'boot', start: o.start.ime, raw: o.start.raw })

  if (o.skripta === undefined) {
    const koraka = o.koraka ?? 50
    for (let n = 1; n <= koraka; n++) {
      const x = izaberi(dostupno(p), drv)
      if (x.a.k === 'wait') {
        const ms = trajanjeCekanja(drv)
        p.skok(ms)
        p.tik(1)
        snimi({ k: 'wait', ms })
      } else izvedi(x)
    }
  } else {
    let n = 0
    for (const k of o.skripta) {
      n++
      if (k.k === 'wait') {
        p.skok(k.ms)
        p.tik(1)
        snimi({ k: 'wait', ms: k.ms })
        continue
      }
      if (k.k === 'jump') {
        p.skok(k.ms)
        snimi({ k: 'jump', ms: k.ms })
        continue
      }
      if (k.k === 'reload') {
        const raw = p.w.__mem[KLJUC_SEJVA]
        const sada = p.w.Date.now()
        greske.push(...p.greske)
        p.w.close()
        poslednji = null
        p = await pokreni(sada + k.ms, raw)
        snimi({ k: 'reload', ms: k.ms })
        continue
      }
      if (k.k === 'dupliTap') {
        const x = poslednji as Opcija | null
        if (x === null || (x.a.k !== 'plant' && x.a.k !== 'harvest')) {
          throw new Error(`skripta ${o.ime}, korak ${n}: dupliTap samo posle plant/harvest`)
        }
        izvedi(x)
        continue
      }
      // Navigacija kao prst: zatvori overlay kartice, pa list, pa pređi na pravi tab.
      if (k.k !== 'overlayOk') {
        while (p.q('#nivoVeo.otvoren')) izvedi(moraj({ k: 'overlayOk' }, n))
      }
      if (k.k !== 'plant' && k.k !== 'closeList' && p.q('#list.otvoren')) {
        izvedi(moraj({ k: 'closeList' }, n))
      }
      const potreban = TAB_AKCIJE[k.k]
      if (potreban !== undefined && !(k.k === 'plant' && p.q('#list.otvoren'))) {
        if (p.q('nav button.aktivan')?.dataset.tab !== potreban) {
          izvedi(moraj({ k: 'tab', tab: potreban }, n))
        }
      }
      if (k.k === 'plant') {
        if (p.q('#list.otvoren') && p.ev<number>('izabrana') !== k.i) {
          izvedi(moraj({ k: 'closeList' }, n))
        }
        if (!p.q('#list.otvoren')) {
          if (p.q('nav button.aktivan')?.dataset.tab !== 'farma') {
            izvedi(moraj({ k: 'tab', tab: 'farma' }, n))
          }
          izvedi(moraj({ k: 'openList', i: k.i }, n))
        }
      }
      izvedi(moraj(k, n))
    }
  }

  greske.push(...p.greske)
  p.w.close()
  if (greske.length > 0) throw new Error(`trag ${o.ime}: greške u prototipu:\n${greske.join('\n')}`)
  return {
    zaglavlje: {
      format: FORMAT_TRAGA,
      verzija: VERZIJA_TRAGA,
      ime: o.ime,
      seme: seme,
      start: o.start.ime,
      koraka: redovi.length - 1,
      orakl: otisak(html),
    },
    redovi,
  }
}
