/*
 * Tekst = prototip. Svaki string koji postoji u prototipu mora biti identičan: statički HTML se čita
 * iz DOM-a prototipa, a stringovi koje gradi JS iz onoga što ŽIVI prototip nacrta (textContent) posle
 * stvarnih klikova i tick-ova. Jedine razlike su odobrene i ovde su eksplicitno potvrđene:
 *   D16 — trajanjeTxt sa decimalnim zarezom; „Dobro došao nazad" navodi svaku završenu mašinu;
 *   D17 — podnaslov na tabli nosi verziju iz package.json.
 */
import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'
import { beforeAll, describe, expect, it } from 'vitest'
import { ART } from '../../src/art'
import {
  KULTURE,
  MASINE,
  MASINE_REDOSLED,
  PROIZVODI,
  REDOSLED,
  SVI_KLJUCEVI,
  ZIV,
  ZIV_REDOSLED,
  cenaParcele,
  dnevniPoklon,
  nivoBonus,
  type ArtikalId,
  type KulturaId,
} from '../../src/config'
import type { Otkljucavanje } from '../../src/core/dogadjaji'
import type { Stanje } from '../../src/core/types'
import {
  fmt,
  nazivArtikla,
  nazivOtkljucavanja,
  porukaTekst,
  sr,
  t,
  trajanjeTxt,
  vremeTxt,
} from '../../src/i18n'
import { MAG0, T0, stanje } from '../helpers'
import { PROTOTIP_HTML, ucitajPrototip, type Prototip } from '../helpers/prototip'

const VERZIJA = (
  JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
    version: string
  }
).version

const sejv = (s: Stanje): Record<string, string> => ({ 'moja-farma-v2': JSON.stringify(s) })

/** Tekst svih direktnih tekst-čvorova elementa (bez dece-elemenata). */
function tekstCvorovi(el: Element | null): string[] {
  if (!el) return []
  return [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent ?? '')
}

function tekst(p: Prototip, selektor: string): string | undefined {
  return p.q(selektor)?.textContent ?? undefined
}

function tekstovi(p: Prototip, selektor: string): string[] {
  return p.qa(selektor).map((e) => e.textContent ?? '')
}

/** Svi konstantni stringovi kataloga (za proveru da nijedan ne ponavlja stari tekst). */
function sviStringovi(o: object): string[] {
  return Object.values(o).flatMap((v: unknown) =>
    typeof v === 'string' ? [v] : typeof v === 'object' && v !== null ? sviStringovi(v) : [],
  )
}

// ── Statički HTML ─────────────────────────────────────────────────────────────

describe('statički HTML (DOM prototipa pre skripte)', () => {
  const d = new JSDOM(PROTOTIP_HTML).window.document
  const q = (s: string): Element | null => d.querySelector(s)

  it('naslov dokumenta', () => {
    expect(d.title).toBe(t.naslov)
  })

  it('tabla: „Moj Salaš"; D17 podnaslov', () => {
    expect(tekstCvorovi(q('.tabla'))).toEqual([t.hud.tabla])
    const proto = q('.tabla small')?.textContent
    expect(proto).toBe('prototip v0.3')
    // D17: jedina razlika je broj verzije.
    expect(t.hud.podnaslov).toBe(`prototip v${VERZIJA}`)
    expect(t.hud.podnaslov.replace(VERZIJA, '0.3')).toBe(proto)
  })

  it('novčanik: NBSP + „din"; nivo: „Nv. "', () => {
    expect(tekstCvorovi(q('#novacPilula'))).toEqual(['\u00a0' + t.hud.valuta])
    expect(tekstCvorovi(q('#nivoPilula'))).toEqual([t.hud.nivo])
  })

  it('naslovi tabova i napomene', () => {
    expect([...d.querySelectorAll('h2')].map((e) => e.textContent)).toEqual([
      t.narudzbe.naslov,
      t.pijaca.naslov,
      t.radnja.naslov,
      t.statistika.naslov,
      t.podesavanja.naslov,
    ])
    expect([...d.querySelectorAll('section > p')].map((e) => e.textContent)).toEqual([
      t.narudzbe.napomena,
      t.pijaca.napomena,
    ])
  })

  it('podešavanja i list semena', () => {
    expect(q('#zvukDugme')?.textContent).toBe(t.podesavanja.zvuk(false))
    expect(q('#resetDugme')?.textContent).toBe(t.podesavanja.reset)
    expect(q('#list h3')?.textContent).toBe(t.list.naslov)
  })

  it('navigacija', () => {
    const dugmad = [...d.querySelectorAll('nav [data-tab]')]
    expect(dugmad.map((b) => b.getAttribute('data-tab'))).toEqual([
      'farma',
      'narudzbe',
      'pijaca',
      'radnja',
    ])
    expect(dugmad.map((b) => tekstCvorovi(b))).toEqual([
      [t.nav.farma],
      [t.nav.narudzbe],
      [t.nav.pijaca],
      [t.nav.radnja],
    ])
  })
})

// ── Katalog i formateri ───────────────────────────────────────────────────────

describe('katalog i formateri = prototipovi', () => {
  let p: Prototip
  beforeAll(async () => {
    p = await ucitajPrototip({ t0: T0 })
  })

  it('nazivi kultura i proizvoda (i SVE_CENE)', () => {
    for (const k of REDOSLED) expect(t.kulture[k].naziv).toBe(p.ev(`KULTURE.${k}.naziv`))
    for (const k of Object.keys(PROIZVODI) as (keyof typeof PROIZVODI)[]) {
      expect(t.proizvodi[k].naziv).toBe(p.ev(`PROIZVODI.${k}.naziv`))
    }
    for (const k of SVI_KLJUCEVI) expect(nazivArtikla(k)).toBe(p.ev(`SVE_CENE.${k}.naziv`))
  })

  it('mašine: naziv, opis, akcija, gotovo', () => {
    for (const id of MASINE_REDOSLED) {
      const proto = p.ev<Record<string, unknown>>(`MASINE.${id}`)
      expect(t.masine[id]).toEqual({
        naziv: proto.naziv,
        opis: proto.opis,
        akcija: proto.akcija,
        gotovo: proto.gotovo,
      })
    }
  })

  it('životinje: naziv, opis', () => {
    for (const id of ZIV_REDOSLED) {
      const proto = p.ev<Record<string, unknown>>(`ZIV.${id}`)
      expect(t.zivotinje[id]).toEqual({ naziv: proto.naziv, opis: proto.opis })
    }
  })

  it('fmt === prototipov fmt (mreža vrednosti, uključujući -0 i NaN)', () => {
    const vrednosti = [-1234.5, -0.4, 0, 0.49, 0.5, 1.5, 2.5, 12.5, 999, 999.5, 1000, 1e9, 2 ** 31]
    for (let x = 0; x < 3e6; x = x * 1.37 + 7) vrednosti.push(x)
    const proto = JSON.parse(
      p.ev<string>(`JSON.stringify(${JSON.stringify(vrednosti)}.map(fmt))`),
    ) as string[]
    expect(vrednosti.map(fmt)).toEqual(proto)
    expect(fmt(NaN)).toBe(p.ev('fmt(NaN)'))
  })

  it('vremeTxt === prototipov vremeTxt (−10 … 90 000 s, i razlomci)', () => {
    const vrednosti: number[] = []
    for (let s = -10; s <= 7400; s += 0.7) vrednosti.push(Math.round(s * 10) / 10)
    for (let s = 7400; s <= 90000; s += 61) vrednosti.push(s)
    const proto = JSON.parse(
      p.ev<string>(`JSON.stringify(${JSON.stringify(vrednosti)}.map(s=>vremeTxt(s)))`),
    ) as string[]
    expect(vrednosti.map(vremeTxt)).toEqual(proto)
  })

  it('trajanjeTxt: celi brojevi identični prototipu (0 … 20 000 s)', () => {
    const vrednosti: number[] = []
    for (let s = 0; s <= 20000; s++) vrednosti.push(s)
    const proto = JSON.parse(
      p.ev<string>(`JSON.stringify(${JSON.stringify(vrednosti)}.map(s=>trajanjeTxt(s)))`),
    ) as string[]
    let celih = 0
    vrednosti.forEach((s, i) => {
      const pr = proto[i] ?? ''
      if (!pr.includes('.')) {
        celih++
        expect(trajanjeTxt(s), String(s)).toBe(pr)
      }
    })
    // 0–59 s (60), pune minute 1–59 (59), puni sati 1–5 (5).
    expect(celih).toBe(124)
  })

  it('D16: razlomljeno trajanje ima zarez umesto tačke', () => {
    const slucajevi: [number, string, string][] = [
      [90, '1.5 min', '1,5 min'],
      [5400, '1.5 h', '1,5 h'],
      [59.2, '59.2 s', '59,2 s'],
      [150, '2.5 min', '2,5 min'],
    ]
    for (const [s, proto, nase] of slucajevi) {
      expect(p.ev(`trajanjeTxt(${s})`)).toBe(proto)
      expect(trajanjeTxt(s)).toBe(nase)
      expect(nase).toBe(proto.replace('.', ','))
    }
    // Svako config trajanje: isto kao prototip, osim decimalnog znaka.
    for (const s of [
      ...REDOSLED.map((k) => KULTURE[k].vreme),
      ZIV.kokosinjac.interval,
      ZIV.stala.interval,
    ]) {
      expect(trajanjeTxt(s)).toBe(p.ev<string>(`trajanjeTxt(${s})`).replace('.', ','))
    }
  })
})

// ── Farma: parcele i kartice zgrada ───────────────────────────────────────────

describe('farma: parcele, zgrade, list semena (živi prototip)', () => {
  let p: Prototip
  beforeAll(async () => {
    p = await ucitajPrototip({
      t0: T0,
      skladiste: sejv(
        stanje({
          sadio: false, // hint na parceli 0 i pozdravni toast
          xp: 40, // nivo 2
          novac: 260,
          parcele: [
            { c: null, t: 0, z: false },
            { c: 'psenica', t: T0 - 5000, z: false }, // 5 od 20 s
            { c: 'psenica', t: T0 - 25000, z: false }, // zrela
            { c: 'sargarepa', t: T0 - 100000, z: true }, // zrela
            { c: 'grozdje', t: T0 - 60000, z: false }, // još 7140 s
          ],
          mag: { ...MAG0, psenica: 20, paprika: 2 },
          masine: { mlin: { k: true, t: T0 - 30000 }, kazan: { k: true, t: 0 } },
          ziv: { kokosinjac: { k: true, t: T0 - 200000 }, stala: { k: true, t: T0 - 9999000 } },
        }),
      ),
    })
  })

  it('pozdravni toast na startu (igrač još nije sadio)', () => {
    expect(tekst(p, '#toast')).toBe(t.toast.dobrodosao)
  })

  it('prazna parcela: ＋ i hint', () => {
    expect(tekst(p, '.parcela.prazna .plus')).toBe(t.njive.plus)
    expect(tekst(p, '.parcela.prazna .hint')).toBe(t.njive.hint)
  })

  it('zrele parcele i „Uberi sve (2)"', () => {
    expect(tekstovi(p, '.parcela.zrelo .uberi')).toEqual([t.njive.uberi, t.njive.uberi])
    expect(tekst(p, '#uberiSve')).toBe(t.njive.uberiSve(2))
  })

  it('odbrojavanje na parcelama koje rastu (render i tick)', () => {
    expect(tekst(p, '.parcela[data-i="1"] .cd')).toBe(t.njive.odbrojavanje(15))
    expect(tekst(p, '.parcela[data-i="4"] .cd')).toBe(t.njive.odbrojavanje(7140))
    expect(t.njive.odbrojavanje(7140)).toBe('1h 59m')
  })

  it('zaključana parcela: 🔒 i cena', () => {
    expect(tekst(p, '.parcela.zakljucana .katanac')).toBe(t.njive.katanac)
    expect(tekst(p, '.parcela.zakljucana .znak')).toBe(t.din(cenaParcele(5)))
  })

  it('kartica mašine koja radi i koja miruje', () => {
    expect(tekst(p, '[data-masina="mlin"] h3')).toBe(t.masine.mlin.naziv)
    expect(tekst(p, '[data-masina="mlin"] .red p')).toBe(t.zgrade.masinaInfo('mlin', 20))
    expect(tekst(p, '[data-mcd="mlin"]')).toBe(t.zgrade.gotovoZa(60))
    expect(tekst(p, '[data-masina="kazan"] h3')).toBe(t.masine.kazan.naziv)
    expect(tekst(p, '[data-masina="kazan"] .red p')).toBe(t.zgrade.masinaInfo('kazan', 2))
    expect(tekst(p, '[data-kuvaj="kazan"]')).toBe(t.masine.kazan.akcija)
  })

  it('kartice životinja', () => {
    expect(tekst(p, '[data-zgz="kokosinjac"] h3')).toBe(t.zivotinje.kokosinjac.naziv)
    expect(tekstCvorovi(p.q('[data-zgz="kokosinjac"] .red p'))).toEqual([
      t.zgrade.zivotinjaInfo('kokosinjac'),
    ])
    expect(tekst(p, '[data-zgz="kokosinjac"] .red p')).toBe(
      '1' + t.zgrade.zivotinjaInfo('kokosinjac'),
    )
    expect(tekst(p, '[data-zgz="stala"] h3')).toBe(t.zivotinje.stala.naziv)
    expect(tekst(p, '[data-zgz="stala"] .red p')).toBe('3' + t.zgrade.zivotinjaInfo('stala'))
    expect(tekstovi(p, '[data-pokupi]')).toEqual([t.zgrade.pokupi, t.zgrade.pokupi])
  })

  it('tick prepisuje odbrojavanja istim tekstom', () => {
    p.skok(10000)
    p.tik()
    expect(tekst(p, '[data-mcd="mlin"]')).toBe(t.zgrade.gotovoZa(50))
    expect(tekst(p, '.parcela[data-i="4"] .cd')).toBe(t.njive.odbrojavanje(7130))
    p.skok(-10000)
    p.tik()
  })

  it('mašina koja miruje: dugme sa akcijom', () => {
    p.ev('S.masine.mlin.t = 0; crtajZgrade()')
    expect(tekst(p, '[data-kuvaj="mlin"]')).toBe(t.masine.mlin.akcija)
  })

  it('list semena na nivou 2: otključane, zaključane, cene; D16 u šargarepi', () => {
    p.klik(p.q('.parcela.prazna'))
    expect(p.q('#list.otvoren')).not.toBeNull()
    for (const k of REDOSLED) {
      const sel = `[data-seme="${k}"]`
      const K = KULTURE[k]
      expect(tekst(p, `${sel} .info b`), k).toBe(t.kulture[k].naziv)
      if (K.nivo > 2) {
        expect(tekst(p, `${sel} .info span`), k).toBe(t.list.otkljucavaSe(K.nivo))
        expect(tekst(p, `${sel} .kosta`), k).toBe(t.list.katanac)
      } else {
        const proto = tekst(p, `${sel} .info span`) ?? ''
        if (k === 'sargarepa') {
          expect(proto).toBe('raste 1.5 min · prodaja ~62 din')
          expect(t.list.info(k)).toBe('raste 1,5 min · prodaja ~62 din') // D16
        } else {
          expect(t.list.info(k), k).toBe(proto)
        }
        expect(tekst(p, `${sel} .kosta`), k).toBe(t.din(K.seme) + t.list.xp(K.xp))
        expect(tekst(p, `${sel} .kosta small`), k).toBe(t.list.xp(K.xp))
      }
    }
  })

  it('list semena na visokom nivou: info svih kultura (osim D16) = prototip', () => {
    p.ev('S.xp = 100000; otvoriList(0)')
    for (const k of REDOSLED) {
      const proto = tekst(p, `[data-seme="${k}"] .info span`) ?? ''
      expect(t.list.info(k), k).toBe(proto.replace('1.5 min', '1,5 min'))
    }
    expect(p.greske).toEqual([])
  })
})

// ── Narudžbine ────────────────────────────────────────────────────────────────

describe('narudžbine (živi prototip)', () => {
  const narudzbe = [
    {
      id: 7,
      ime: 'Baka Mira',
      emoji: '👵',
      boja: '#ffe0e6',
      msg: 'Za unučiće spremam ručak…',
      stavke: [
        { k: 'psenica' as const, kom: 2 },
        { k: 'brasno' as const, kom: 1 },
      ],
      din: 95,
      xp: 6,
    },
    {
      id: 8,
      ime: 'Pekara „Zrno“',
      emoji: '🥖',
      boja: '#ffeccc',
      msg: 'Jutarnja tura kreće u pet.',
      stavke: [{ k: 'sargarepa' as const, kom: 3 }],
      din: 1355,
      xp: 104,
    },
  ]
  const mag = { ...MAG0, psenica: 3, brasno: 2, sargarepa: 1 }
  let p: Prototip
  beforeAll(async () => {
    p = await ucitajPrototip({ t0: T0, skladiste: sejv(stanje({ narudzbe, mag })) })
  })

  it('kartice: ime, poruka, stavke, nagrada, dugmad', () => {
    const kartice = p.qa('#narudzbeKuca .kartica')
    expect(kartice).toHaveLength(2)
    narudzbe.forEach((o, i) => {
      const k = kartice[i]
      expect(k?.querySelector('.musterija b')?.textContent).toBe(o.ime)
      expect(k?.querySelector('.musterija span')?.textContent).toBe(t.narudzbe.poruka(o.msg))
      expect([...(k?.querySelectorAll('.stavka') ?? [])].map((e) => e.textContent)).toEqual(
        o.stavke.map((s) => t.narudzbe.stavka(mag[s.k], s.kom)),
      )
      expect(k?.querySelector('.nagrada span')?.textContent).toBe(t.narudzbe.nagradaDin(o.din))
      expect(k?.querySelector('.xpp')?.textContent).toBe(t.narudzbe.nagradaXp(o.xp))
      expect(k?.querySelector('[data-isporuci]')?.textContent).toBe(t.narudzbe.isporuci)
      expect(k?.querySelector('[data-odbij]')?.textContent).toBe(t.narudzbe.odbij)
    })
  })

  it('isporuka: toast „… ti zahvaljuje! +95 din"', () => {
    p.klik(p.q('[data-isporuci="7"]'))
    expect(tekst(p, '#toast')).toBe(porukaTekst({ id: 'zahvaljuje', ime: 'Baka Mira', din: 95 }))
    expect(p.greske).toEqual([])
  })
})

// ── Pijaca ────────────────────────────────────────────────────────────────────

describe('pijaca (živi prototip)', () => {
  const mag = { ...MAG0, psenica: 20, brasno: 1234, jaje: 1 }
  let p: Prototip
  beforeAll(async () => {
    p = await ucitajPrototip({ t0: T0, skladiste: sejv(stanje({ mag })) })
  })

  const smerTekst = (smer: number): string =>
    smer > 0 ? t.pijaca.smer.gore : smer < 0 ? t.pijaca.smer.dole : t.pijaca.smer.prosek

  it('redovi: naziv, količina (bez fmt), cena, trend, dugme', () => {
    const redovi = p.qa('#tezga .roba')
    const kljucevi: ArtikalId[] = ['psenica', 'brasno', 'jaje']
    expect(redovi).toHaveLength(3)
    kljucevi.forEach((k, i) => {
      const r = redovi[i]
      const { cena, smer } = p.ev<{ cena: number; smer: number }>(`trzisnaCena('${k}')`)
      expect(r?.querySelector('.info b')?.textContent).toBe(nazivArtikla(k))
      expect(r?.querySelector('.info span')?.textContent).toBe(t.pijaca.kolicina(mag[k]))
      expect(r?.querySelector(`[data-cena="${k}"]`)?.textContent).toBe(t.din(cena))
      expect(r?.querySelector('.smer')?.textContent).toBe(smerTekst(smer))
      expect(r?.querySelector('[data-prodaj]')?.textContent).toBe(t.pijaca.prodajSve)
    })
    expect(t.pijaca.kolicina(1234)).toBe('× 1234 kom')
  })

  it('sva tri trenda (▲/▼/—) kroz 10-minutni ciklus', () => {
    const vidjeno = new Set<number>()
    for (let i = 0; i < 130 && vidjeno.size < 3; i++) {
      p.skok(5000)
      p.ev('crtajTezgu()')
      const smer = p.ev<number>(`trzisnaCena('psenica').smer`)
      vidjeno.add(smer)
      expect(tekst(p, '#tezga .roba .smer')).toBe(smerTekst(smer))
    }
    expect([...vidjeno].sort()).toEqual([-1, 0, 1])
  })

  it('tick prepisuje cenu istim formatom', () => {
    p.skok(7000)
    p.tik()
    const cena = p.ev<number>(`trzisnaCena('brasno').cena`)
    expect(tekst(p, '[data-cena="brasno"]')).toBe(t.din(cena))
  })

  it('prodaja: toast „Prodato 1234 × Brašno za … din"', () => {
    const pre = p.ev<number>('S.novac')
    p.klik(p.q('[data-prodaj="brasno"]'))
    const zarada = p.ev<number>('S.novac') - pre
    expect(zarada).toBeGreaterThan(0)
    expect(tekst(p, '#toast')).toBe(
      porukaTekst({ id: 'prodato', kom: 1234, artikal: 'brasno', zarada }),
    )
  })

  it('prazna tezga', () => {
    p.ev('Object.keys(S.mag).forEach(k => S.mag[k] = 0); crtajTezgu()')
    expect(tekst(p, '#tezga p')).toBe(t.pijaca.prazna)
    expect(p.greske).toEqual([])
  })
})

// ── Radnja, statistika, podešavanja, reset ─────────────────────────────────────

describe('radnja, statistika, podešavanja (živi prototip)', () => {
  let p: Prototip
  beforeAll(async () => {
    p = await ucitajPrototip({ t0: T0, skladiste: sejv(stanje({ xp: 100, novac: 700 })) })
  })

  const kartice = (): Element[] => p.qa('#radnjaKuca .kartica')

  it('nivo 3, 700 din: dostupne zgrade (opis, „Kupi — …"), zaključana štala, aukcija', () => {
    const k = kartice()
    expect(k).toHaveLength(5)
    const dostupne = [
      ['mlin', t.masine.mlin.naziv, t.masine.mlin.opis, MASINE.mlin.cena],
      ['kazan', t.masine.kazan.naziv, t.masine.kazan.opis, MASINE.kazan.cena],
      [
        'kokosinjac',
        t.zivotinje.kokosinjac.naziv,
        t.zivotinje.kokosinjac.opis,
        ZIV.kokosinjac.cena,
      ],
    ] as const
    dostupne.forEach(([id, naziv, opis, cena], i) => {
      expect(k[i]?.querySelector('h3')?.textContent, id).toBe(naziv)
      expect(k[i]?.querySelector('p')?.textContent, id).toBe(opis)
      expect(k[i]?.querySelector(`[data-kupi="${id}"]`)?.textContent, id).toBe(t.radnja.kupi(cena))
    })
    expect(k[3]?.querySelector('h3')?.textContent).toBe(t.radnja.zakljucano('stala'))
    expect(k[3]?.querySelector('p')?.textContent).toBe(t.radnja.otkljucavaSe(ZIV.stala.nivo))
    expect(k[4]?.querySelector('h3')?.textContent).toBe(t.radnja.aukcijaNaslov)
    expect(k[4]?.querySelector('p')?.textContent).toBe(t.radnja.aukcijaOpis)
  })

  it('nivo 1: sve zaključano („Mlin 🔒", „Otključava se na nivou 2.")', () => {
    p.ev('S.xp = 0; crtajRadnju()')
    const k = kartice()
    const zgrade = [...MASINE_REDOSLED, ...ZIV_REDOSLED]
    zgrade.forEach((id, i) => {
      const nivo = id === 'mlin' || id === 'kazan' ? MASINE[id].nivo : ZIV[id].nivo
      expect(k[i]?.querySelector('h3')?.textContent, id).toBe(t.radnja.zakljucano(id))
      expect(k[i]?.querySelector('p')?.textContent, id).toBe(t.radnja.otkljucavaSe(nivo))
    })
  })

  it('sve kupljeno: „Kupljeno ✓ — nalazi se na farmi."', () => {
    p.ev(
      'S.masine.mlin.k = S.masine.kazan.k = S.ziv.kokosinjac.k = S.ziv.stala.k = true; crtajRadnju()',
    )
    const k = kartice()
    const nazivi = [
      t.masine.mlin.naziv,
      t.masine.kazan.naziv,
      t.zivotinje.kokosinjac.naziv,
      t.zivotinje.stala.naziv,
    ]
    nazivi.forEach((naziv, i) => {
      expect(k[i]?.querySelector('h3')?.textContent).toBe(naziv)
      expect(k[i]?.querySelector('p')?.textContent).toBe(t.radnja.kupljeno)
    })
  })

  it('statistika: oznake i vrednosti (fmt, din, fmt)', () => {
    p.ev('S.stat = {ubrano: 12345, zaradjeno: 1234567, isporuke: 7}; crtajRadnju()')
    expect(tekstovi(p, '#statKuca .statRed span')).toEqual([
      t.statistika.ubrano,
      t.statistika.zaradjeno,
      t.statistika.isporuke,
    ])
    expect(tekstovi(p, '#statKuca .statRed b')).toEqual([fmt(12345), t.din(1234567), fmt(7)])
  })

  it('zvuk: uključen / isključen', () => {
    p.ev('S.mute = true; crtajRadnju()')
    expect(tekst(p, '#zvukDugme')).toBe(t.podesavanja.zvuk(true))
    p.ev('S.mute = false; crtajRadnju()')
    expect(tekst(p, '#zvukDugme')).toBe(t.podesavanja.zvuk(false))
  })

  it('kupovina zgrade: toast „<naziv> je na farmi! 🎉"', () => {
    p.ev(
      'S.xp = 1000; S.novac = 100000; S.masine.mlin.k = false; S.ziv.kokosinjac.k = false; crtajRadnju()',
    )
    p.klik(p.q('[data-kupi="mlin"]'))
    p.zatvoriOverlaye()
    expect(tekst(p, '#toast')).toBe(porukaTekst({ id: 'zgradaNaFarmi', zgrada: 'mlin' }))
    p.klik(p.q('nav [data-tab="radnja"]'))
    p.klik(p.q('[data-kupi="kokosinjac"]'))
    expect(tekst(p, '#toast')).toBe(porukaTekst({ id: 'zgradaNaFarmi', zgrada: 'kokosinjac' }))
  })

  it('reset: tekst potvrde, pa toast „Nova igra. Srećno! 🌱"', () => {
    let uhvaceno: string | undefined
    p.w.confirm = (poruka?: string) => {
      uhvaceno = poruka
      return false
    }
    p.klik(p.q('#resetDugme'))
    expect(uhvaceno).toBe(t.reset.potvrda)
    p.w.confirm = () => true
    p.klik(p.q('#resetDugme'))
    expect(tekst(p, '#toast')).toBe(t.toast.novaIgra)
    expect(p.greske).toEqual([])
  })
})

// ── Overlay kartice ───────────────────────────────────────────────────────────

describe('level-up kartica (živi prototip)', () => {
  let p: Prototip
  beforeAll(async () => {
    p = await ucitajPrototip({ t0: T0 })
  })

  const OTKLJUCANO: Record<number, Otkljucavanje[]> = {
    2: [
      { vrsta: 'kultura', id: 'paprika' },
      { vrsta: 'masina', id: 'mlin' },
    ],
    3: [
      { vrsta: 'kultura', id: 'bundeva' },
      { vrsta: 'masina', id: 'kazan' },
      { vrsta: 'zivotinja', id: 'kokosinjac' },
    ],
    4: [{ vrsta: 'kultura', id: 'grozdje' }],
    5: [{ vrsta: 'zivotinja', id: 'stala' }],
    6: [{ vrsta: 'aukcija' }],
    7: [],
    20: [],
  }

  it.each(Object.keys(OTKLJUCANO).map(Number))('nivo %i', (nivo) => {
    p.ev(`prikaziNivo(${nivo})`)
    const kartica = p.q('#nivoKartica')
    expect(tekst(p, '#nivoKartica .zvezda')).toBe(t.noviNivo.zvezda)
    expect(tekst(p, '#nivoKartica h3')).toBe(t.noviNivo.naslov(nivo))
    const pasusi = [...(kartica?.querySelectorAll(':scope > p') ?? [])]
    expect(tekstCvorovi(pasusi[0] ?? null)).toEqual([t.noviNivo.nagrada])
    expect(pasusi[0]?.querySelector('b')?.textContent).toBe(
      t.noviNivo.nagradaIznos(nivoBonus(nivo)),
    )
    const lista = OTKLJUCANO[nivo] ?? []
    if (lista.length) {
      expect(pasusi).toHaveLength(2)
      expect(pasusi[1]?.textContent).toBe(t.noviNivo.otkljucano)
      expect(tekstovi(p, '#nivoKartica .kockica')).toEqual(lista.map(nazivOtkljucavanja))
    } else {
      expect(pasusi).toHaveLength(1)
      expect(p.q('#nivoKartica .kockica')).toBeNull()
    }
    expect(tekst(p, '#nivoOk')).toBe(t.noviNivo.ok)
    p.zatvoriOverlaye()
  })
})

describe('„Dobro došao nazad" i dnevni poklon (živi prototip, boot posle 1 h)', () => {
  const ODSUSTVO = 3_600_000
  let p: Prototip
  beforeAll(async () => {
    p = await ucitajPrototip({
      t0: T0,
      skladiste: sejv(
        stanje({
          xp: 100, // nivo 3 → poklon 145
          novac: 500,
          poklonDan: '',
          videno: T0 - ODSUSTVO,
          parcele: [
            { c: 'psenica', t: T0 - ODSUSTVO + 1000, z: false },
            { c: null, t: 0, z: false },
          ],
          masine: { mlin: { k: true, t: T0 - ODSUSTVO }, kazan: { k: true, t: T0 - ODSUSTVO } },
          ziv: {
            kokosinjac: { k: true, t: T0 - ODSUSTVO },
            stala: { k: true, t: T0 - ODSUSTVO },
          },
        }),
      ),
    })
  })

  it('kartica: naslov, podnaslov, redovi, dugme; D16 za mašine', () => {
    expect(tekst(p, '#nivoKartica .zvezda')).toBe(t.dobrodoslica.zvezda)
    expect(tekst(p, '#nivoKartica h3')).toBe(t.dobrodoslica.naslov)
    expect(tekst(p, '#nivoKartica > p')).toBe(t.dobrodoslica.podnaslov)
    expect(tekst(p, '#nivoOk')).toBe(t.dobrodoslica.ok)
    const redovi = tekstovi(p, '#nivoKartica .spisak > div')
    expect(redovi).toEqual([
      t.dobrodoslica.sazrelo(1),
      'Mašine su završile posao', // prototip (D16 menja ovaj red)
      t.dobrodoslica.skupljeno('jaje', 4),
      t.dobrodoslica.skupljeno('mleko', 3),
    ])
    // D16: prototip ima jedan red uvek sa ikonicom kazana; port daje po red za svaku završenu
    // mašinu, sa njenom ikonicom i njenom porukom `gotovo`.
    const ikonicaReda = p.qa('#nivoKartica .spisak > div')[1]?.querySelector('.slicica')
    const kazan = p.d.createElement('span')
    kazan.innerHTML = ART.kazan
    expect(ikonicaReda?.innerHTML).toBe(kazan.innerHTML)
    expect(MASINE_REDOSLED.map((id) => t.dobrodoslica.masina(id))).toEqual([
      p.ev('MASINE.mlin.gotovo'),
      p.ev('MASINE.kazan.gotovo'),
    ])
    expect(sviStringovi(sr)).not.toContain('Mašine su završile posao')
    expect(ART.kazan).toBe(p.ev('ART.kazan'))
  })

  it('dnevni poklon posle „Idemo!"', () => {
    p.klik(p.q('#nivoOk'))
    expect(tekst(p, '#nivoKartica h3')).toBe(t.poklon.naslov)
    const pasus = p.q('#nivoKartica p')
    expect(tekstCvorovi(pasus)).toEqual([t.poklon.pre, t.poklon.posle])
    expect(pasus?.querySelector('b')?.textContent).toBe(t.poklon.iznos(dnevniPoklon(3)))
    expect(pasus?.textContent).toBe(t.poklon.pre + t.poklon.iznos(145) + t.poklon.posle)
    expect(tekst(p, '#nivoOk')).toBe(t.poklon.ok)
    expect(p.greske).toEqual([])
  })
})

// ── Toastovi iz akcija → porukaTekst ──────────────────────────────────────────

describe('toastovi iz akcija = porukaTekst (živi prototip)', () => {
  it('prva sadnja → savet; zalivanje; već zaliveno; nema novca za parcelu; nova parcela', async () => {
    const p = await ucitajPrototip({ t0: T0 })
    expect(tekst(p, '#toast')).toBe(t.toast.dobrodosao)
    p.klik(p.q('.parcela.prazna'))
    p.klik(p.q('[data-seme="psenica"]'))
    // tajmeri 'odmah': savet od 700 ms se pojavljuje odmah
    expect(tekst(p, '#toast')).toBe(porukaTekst({ id: 'savetZalivanje' }))
    p.klik(p.q('.parcela[data-i="0"]'))
    expect(tekst(p, '#toast')).toBe(porukaTekst({ id: 'zaliveno' }))
    p.klik(p.q('.parcela[data-i="0"]'))
    expect(tekst(p, '#toast')).toBe(porukaTekst({ id: 'vecZaliveno' }))
    p.klik(p.q('.parcela.zakljucana')) // 40 din < 150
    expect(tekst(p, '#toast')).toBe(porukaTekst({ id: 'nemasNovca' }))
    p.ev('S.novac = 1000; crtajNjive()')
    p.klik(p.q('.parcela.zakljucana'))
    expect(tekst(p, '#toast')).toBe(porukaTekst({ id: 'novaParcela' }))
    expect(p.greske).toEqual([])
  })

  it('anti-softlock → „Ostavi bar za seme pšenice 🙂"', async () => {
    const p = await ucitajPrototip({ t0: T0, skladiste: sejv(stanje({ novac: 150 })) })
    p.klik(p.q('.parcela.zakljucana'))
    expect(tekst(p, '#toast')).toBe(porukaTekst({ id: 'ostaviZaSeme' }))
  })

  it('„Uberi sve", pokupi (jaja, mleko), mašine gotove u ticku', async () => {
    const zrela = (): { c: KulturaId; t: number; z: boolean } => ({
      c: 'psenica',
      t: T0 - 30000,
      z: false,
    })
    const p = await ucitajPrototip({
      t0: T0,
      skladiste: sejv(
        stanje({
          xp: 5000,
          parcele: [zrela(), zrela(), zrela()],
          ziv: {
            kokosinjac: { k: true, t: T0 - 2 * ZIV.kokosinjac.interval * 1000 },
            stala: { k: true, t: T0 - ZIV.stala.interval * 1000 },
          },
          masine: { mlin: { k: true, t: T0 - 1000 }, kazan: { k: true, t: 0 } },
        }),
      ),
    })
    p.klik(p.q('#uberiSve'))
    expect(tekst(p, '#toast')).toBe(porukaTekst({ id: 'ubranoSve', br: 3 }))
    p.klik(p.q('[data-pokupi="kokosinjac"]'))
    expect(tekst(p, '#toast')).toBe(
      porukaTekst({ id: 'pokupljeno', n: 2, zivotinja: 'kokosinjac' }),
    )
    p.klik(p.q('[data-pokupi="stala"]'))
    expect(tekst(p, '#toast')).toBe(porukaTekst({ id: 'pokupljeno', n: 1, zivotinja: 'stala' }))
    p.skok(MASINE.mlin.vreme * 1000)
    p.tik()
    expect(tekst(p, '#toast')).toBe(porukaTekst({ id: 'masinaGotova', masina: 'mlin' }))
    p.ev(`S.masine.kazan.t = Date.now() - ${MASINE.kazan.vreme * 1000}`)
    p.tik()
    expect(tekst(p, '#toast')).toBe(porukaTekst({ id: 'masinaGotova', masina: 'kazan' }))
    expect(p.greske).toEqual([])
  })

  it('+N XP iznad parcele posle žetve', async () => {
    const p = await ucitajPrototip({
      t0: T0,
      tajmeri: 'red', // da efekat ne nestane odmah
      skladiste: sejv(stanje({ parcele: [{ c: 'sargarepa', t: T0 - 100000, z: false }] })),
    })
    p.klik(p.q('.parcela.zrelo'))
    expect(tekstovi(p, '.plusxp')).toEqual([t.fx.plusXp(KULTURE.sargarepa.xp)])
  })
})
