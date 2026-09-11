/*
 * Katalog stringova bez prototipa: zlatni izlazi parametrizovanih stringova (05 §3.14), usklađenost
 * brojeva u tekstu sa config-om (05 §3.11, ograničenje 3), higijena (latinica, bez <>&, tačni znakovi),
 * porukaTekst za svaki core `Poruka` ID, D9 i D17.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  AUKCIJA_NIVO,
  KULTURE,
  MASINE,
  MASINE_REDOSLED,
  REDOSLED,
  SOFTLOCK_REZERVA_KULTURA,
  SVI_KLJUCEVI,
  ZALIVANJE_UDEO,
  ZIV,
  ZIV_REDOSLED,
  cenaParcele,
  type ZgradaId,
} from '../../src/config'
import type { Poruka } from '../../src/core/dogadjaji'
import {
  fmt,
  nazivArtikla,
  nazivOtkljucavanja,
  nazivZgrade,
  porukaTekst,
  sr,
  t,
} from '../../src/i18n'

const VERZIJA = (
  JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
    version: string
  }
).version

const ZGRADE: readonly ZgradaId[] = [...MASINE_REDOSLED, ...ZIV_REDOSLED]

/** Svaka funkcija u katalogu → pozivi sa reprezentativnim argumentima (svi ID-jevi gde ih prima). */
const POZIVI: Record<string, () => string[]> = {
  din: () => [t.din(0), t.din(1234567)],
  'njive.uberiSve': () => [t.njive.uberiSve(2), t.njive.uberiSve(9)],
  'njive.odbrojavanje': () => [t.njive.odbrojavanje(15), t.njive.odbrojavanje(7080)],
  'zgrade.masinaInfo': () => [t.zgrade.masinaInfo('mlin', 20), t.zgrade.masinaInfo('kazan', 2)],
  'zgrade.gotovoZa': () => [t.zgrade.gotovoZa(60)],
  'zgrade.zivotinjaInfo': () => [
    t.zgrade.zivotinjaInfo('kokosinjac'),
    t.zgrade.zivotinjaInfo('stala'),
  ],
  'list.info': () => REDOSLED.map((k) => t.list.info(k)),
  'list.otkljucavaSe': () => [t.list.otkljucavaSe(2)],
  'list.xp': () => [t.list.xp(110)],
  'narudzbe.poruka': () => [t.narudzbe.poruka('Peć je već vruća!')],
  'narudzbe.stavka': () => [t.narudzbe.stavka(0, 1)],
  'narudzbe.nagradaDin': () => [t.narudzbe.nagradaDin(1355)],
  'narudzbe.nagradaXp': () => [t.narudzbe.nagradaXp(104)],
  'pijaca.kolicina': () => [t.pijaca.kolicina(1234)],
  'radnja.kupi': () => [t.radnja.kupi(2600)],
  'radnja.zakljucano': () => ZGRADE.map((id) => t.radnja.zakljucano(id)),
  'radnja.otkljucavaSe': () => [t.radnja.otkljucavaSe(5)],
  'podesavanja.zvuk': () => [t.podesavanja.zvuk(false), t.podesavanja.zvuk(true)],
  'noviNivo.naslov': () => [t.noviNivo.naslov(3)],
  'noviNivo.nagradaIznos': () => [t.noviNivo.nagradaIznos(120)],
  'dobrodoslica.sazrelo': () => [t.dobrodoslica.sazrelo(1)],
  'dobrodoslica.masina': () => [t.dobrodoslica.masina('mlin'), t.dobrodoslica.masina('kazan')],
  'dobrodoslica.skupljeno': () => [
    t.dobrodoslica.skupljeno('jaje', 2),
    t.dobrodoslica.skupljeno('mleko', 3),
  ],
  'poklon.iznos': () => [t.poklon.iznos(215)],
  'toast.ubranoSve': () => [t.toast.ubranoSve(3)],
  'toast.prodato': () => SVI_KLJUCEVI.map((k) => t.toast.prodato(3, k, 60)),
  'toast.zahvaljuje': () => [t.toast.zahvaljuje('Piljar Pera', 50)],
  'toast.zgradaNaFarmi': () => [t.toast.zgradaNaFarmi('mlin'), t.toast.zgradaNaFarmi('stala')],
  'toast.pokupljeno': () => [t.toast.pokupljeno(2, 'jaje'), t.toast.pokupljeno(1, 'mleko')],
  'fx.plusXp': () => [t.fx.plusXp(8)],
  nazivArtikla: () => SVI_KLJUCEVI.map((k) => t.nazivArtikla(k)),
  nazivZgrade: () => [t.nazivZgrade('kazan'), t.nazivZgrade('kokosinjac')],
}

/** Obilazi katalog: putanje svih funkcija i svi konstantni stringovi. */
function obidji(o: object, pre = ''): { funkcije: string[]; stringovi: [string, string][] } {
  const funkcije: string[] = []
  const stringovi: [string, string][] = []
  for (const [k, v] of Object.entries(o)) {
    const put = pre ? `${pre}.${k}` : k
    if (typeof v === 'function') funkcije.push(put)
    else if (typeof v === 'string') stringovi.push([put, v])
    else if (typeof v === 'object' && v !== null) {
      const r = obidji(v as object, put)
      funkcije.push(...r.funkcije)
      stringovi.push(...r.stringovi)
    } else throw new Error(`neočekivana vrednost na ${put}`)
  }
  return { funkcije, stringovi }
}

const katalog = obidji(sr)
const sviTekstovi: [string, string][] = [
  ...katalog.stringovi,
  ...Object.entries(POZIVI).flatMap(([put, f]) => f().map((s) => [put, s] as [string, string])),
]

describe('zlatni izlazi parametrizovanih stringova (05 §3.14, izmereni na prototipu)', () => {
  it('farma', () => {
    expect(t.njive.uberiSve(2)).toBe('Uberi sve (2)')
    expect(t.njive.odbrojavanje(7080)).toBe('1h 58m')
    expect(t.din(cenaParcele(2))).toBe('150 din')
    expect(t.zgrade.masinaInfo('mlin', 20)).toBe(
      'Imaš 20× pšenica · brašno ide po ~120 din (+8 XP)',
    )
    expect(t.zgrade.masinaInfo('kazan', 2)).toBe('Imaš 2× paprika · ajvar ide po ~780 din (+25 XP)')
    expect(t.zgrade.gotovoZa(60)).toBe('Gotovo za 1:00')
    expect(t.zgrade.zivotinjaInfo('kokosinjac')).toBe('/4 × jaja spremno · novo na 3 min')
    expect(t.zgrade.zivotinjaInfo('stala')).toBe('/3 × mleko spremno · novo na 10 min')
  })

  it('list semena (D16 u šargarepi)', () => {
    expect(REDOSLED.map((k) => t.list.info(k))).toEqual([
      'raste 20 s · prodaja ~18 din',
      'raste 1,5 min · prodaja ~62 din',
      'raste 5 min · prodaja ~185 din',
      'raste 30 min · prodaja ~900 din',
      'raste 2 h · prodaja ~2.300 din',
    ])
    expect(t.list.otkljucavaSe(2)).toBe('Otključava se na nivou 2')
    expect(t.din(KULTURE.grozdje.seme) + t.list.xp(KULTURE.grozdje.xp)).toBe('450 din+110 XP')
  })

  it('narudžbine, pijaca, radnja, statistika', () => {
    expect(t.narudzbe.poruka('Jutarnja tura kreće u pet.')).toBe('„Jutarnja tura kreće u pet.“')
    expect(t.narudzbe.stavka(0, 1)).toBe('0/1')
    expect(t.narudzbe.nagradaDin(1355)).toBe(' 1.355 din')
    expect(t.narudzbe.nagradaXp(104)).toBe('✦ +104 XP')
    expect(t.pijaca.kolicina(1234)).toBe('× 1234 kom')
    expect(t.radnja.kupi(2600)).toBe('Kupi — 2.600 din')
    expect(t.radnja.zakljucano('mlin')).toBe('Mlin 🔒')
    expect(t.radnja.otkljucavaSe(2)).toBe('Otključava se na nivou 2.')
    expect(fmt(12345)).toBe('12.345')
    expect(t.din(1234567)).toBe('1.234.567 din')
    expect(t.podesavanja.zvuk(false)).toBe('Zvuk: uključen')
    expect(t.podesavanja.zvuk(true)).toBe('Zvuk: isključen')
  })

  it('overlay kartice', () => {
    expect(t.noviNivo.naslov(3)).toBe('Nivo 3!')
    expect(t.noviNivo.nagrada + t.noviNivo.nagradaIznos(120)).toBe('Nagrada: +120 din')
    expect(t.dobrodoslica.sazrelo(1)).toBe('Sazrelo useva: 1')
    expect(t.dobrodoslica.skupljeno('jaje', 2)).toBe('Jaja: +2')
    expect(t.dobrodoslica.skupljeno('mleko', 3)).toBe('Mleko: +3')
    expect(t.poklon.pre + t.poklon.iznos(215) + t.poklon.posle).toBe(
      'Dobio si +215 din za vernost farmi. Vidimo se sutra!',
    )
  })

  it('toastovi', () => {
    expect(t.toast.prodato(3, 'psenica', 60)).toBe('Prodato 3 × Pšenica za 60 din')
    expect(t.toast.prodato(1234, 'brasno', 1234 * 107)).toBe('Prodato 1234 × Brašno za 132.038 din')
    expect(t.toast.zahvaljuje('Piljar Pera', 50)).toBe('Piljar Pera ti zahvaljuje! +50 din')
    expect(t.toast.pokupljeno(2, 'jaje')).toBe('+2 × jaja u korpi')
    expect(t.toast.zgradaNaFarmi('mlin')).toBe('Mlin je na farmi! 🎉')
    expect(t.toast.zgradaNaFarmi('kazan')).toBe('Kazan za ajvar je na farmi! 🎉')
    expect(t.toast.ubranoSve(3)).toBe('Ubrano 3 useva 🌾')
    expect(t.fx.plusXp(8)).toBe('+8 XP')
  })
})

describe('porukaTekst: svaki core Poruka ID', () => {
  // Mapirani tip: TS odbija kompajliranje ako core doda Poruka ID koji ovde fali.
  const SLUCAJEVI: { [K in Poruka['id']]: [Extract<Poruka, { id: K }>, string] } = {
    savetZalivanje: [{ id: 'savetZalivanje' }, 'Savet: tapni biljku dok raste da je zaliješ 💧'],
    vecZaliveno: [{ id: 'vecZaliveno' }, 'Već je zaliveno 💧'],
    zaliveno: [{ id: 'zaliveno' }, 'Zaliveno — raste 25% brže 💧'],
    ubranoSve: [{ id: 'ubranoSve', br: 4 }, 'Ubrano 4 useva 🌾'],
    prodato: [
      { id: 'prodato', kom: 12, artikal: 'sargarepa', zarada: 1488 },
      'Prodato 12 × Šargarepa za 1.488 din',
    ],
    zahvaljuje: [
      { id: 'zahvaljuje', ime: 'Kafana „Kod Žike“', din: 1355 },
      'Kafana „Kod Žike“ ti zahvaljuje! +1.355 din',
    ],
    nemasNovca: [{ id: 'nemasNovca' }, 'Nemaš dovoljno dinara'],
    ostaviZaSeme: [{ id: 'ostaviZaSeme' }, 'Ostavi bar za seme pšenice 🙂'],
    novaParcela: [{ id: 'novaParcela' }, 'Nova parcela je tvoja 🎉'],
    zgradaNaFarmi: [{ id: 'zgradaNaFarmi', zgrada: 'kokosinjac' }, 'Kokošinjac je na farmi! 🎉'],
    pokupljeno: [{ id: 'pokupljeno', n: 3, zivotinja: 'stala' }, '+3 × mleko u korpi'],
    masinaGotova: [{ id: 'masinaGotova', masina: 'kazan' }, 'Ajvar je gotov!'],
  }

  it.each(Object.values(SLUCAJEVI))('%j → %j', (poruka, tekst) => {
    expect(porukaTekst(poruka)).toBe(tekst)
  })

  it('pokupljeno imenuje proizvod životinje (kokošinjac → jaja), ne životinju', () => {
    expect(porukaTekst({ id: 'pokupljeno', n: 1, zivotinja: 'kokosinjac' })).toBe(
      '+1 × jaja u korpi',
    )
  })

  it('masinaGotova je poruka `gotovo` te mašine', () => {
    expect(porukaTekst({ id: 'masinaGotova', masina: 'mlin' })).toBe(t.masine.mlin.gotovo)
  })
})

describe('nazivi po ID-ju', () => {
  it('nazivArtikla za svih 9 artikala', () => {
    expect(SVI_KLJUCEVI.map(nazivArtikla)).toEqual([
      'Pšenica',
      'Šargarepa',
      'Paprika',
      'Bundeva',
      'Grožđe',
      'Brašno',
      'Ajvar',
      'Jaja',
      'Mleko',
    ])
  })

  it('nazivZgrade za mašine i životinje', () => {
    expect(ZGRADE.map(nazivZgrade)).toEqual(['Mlin', 'Kazan za ajvar', 'Kokošinjac', 'Štala'])
  })

  it('nazivOtkljucavanja: kultura, mašina, životinja, aukcija', () => {
    expect(nazivOtkljucavanja({ vrsta: 'kultura', id: 'grozdje' })).toBe('Grožđe')
    expect(nazivOtkljucavanja({ vrsta: 'masina', id: 'kazan' })).toBe('Kazan za ajvar')
    expect(nazivOtkljucavanja({ vrsta: 'zivotinja', id: 'stala' })).toBe('Štala')
    expect(nazivOtkljucavanja({ vrsta: 'aukcija' })).toBe('Aukcija uskoro')
  })
})

describe('brojevi u tekstu = config (05 §3.11, ograničenje 3)', () => {
  const broj = (re: RegExp, s: string): number => Number(re.exec(s)?.[1])

  it('mlin: „Melje 4 pšenice u džak brašna" i „4× pšenica → 1 džak"', () => {
    expect(MASINE.mlin.ulazK).toBe('psenica')
    expect(MASINE.mlin.izlaz).toBe('brasno')
    expect(broj(/^Melje (\d+) pšenice u džak brašna\.$/, t.masine.mlin.opis)).toBe(
      MASINE.mlin.ulazN,
    )
    expect(broj(/— (\d+)× pšenica → 1 džak$/, t.masine.mlin.akcija)).toBe(MASINE.mlin.ulazN)
  })

  it('kazan: „Pretvara 3 paprike u teglu ajvara" i „3× paprika → 1 tegla"', () => {
    expect(MASINE.kazan.ulazK).toBe('paprika')
    expect(MASINE.kazan.izlaz).toBe('ajvar')
    expect(broj(/^Pretvara (\d+) paprike u teglu ajvara\.$/, t.masine.kazan.opis)).toBe(
      MASINE.kazan.ulazN,
    )
    expect(broj(/— (\d+)× paprika → 1 tegla$/, t.masine.kazan.akcija)).toBe(MASINE.kazan.ulazN)
  })

  it('štala: „na svakih 10 minuta" = interval/60; kokošinjac nosi jaja', () => {
    expect(ZIV.stala.proizvod).toBe('mleko')
    expect(broj(/na svakih (\d+) minuta\.$/, t.zivotinje.stala.opis)).toBe(ZIV.stala.interval / 60)
    expect(ZIV.kokosinjac.proizvod).toBe('jaje')
    expect(t.zivotinje.kokosinjac.opis).toContain('jaja')
  })

  it('zalivanje: „25%" = ZALIVANJE_UDEO', () => {
    expect(broj(/(\d+)% brže/, t.toast.zaliveno)).toBe(ZALIVANJE_UDEO * 100)
  })

  it('anti-softlock: „seme pšenice" = SOFTLOCK_REZERVA_KULTURA', () => {
    expect(SOFTLOCK_REZERVA_KULTURA).toBe('psenica')
    expect(t.toast.ostaviZaSeme).toContain('seme pšenice')
  })

  it('aukcija se najavljuje na AUKCIJA_NIVO', () => {
    expect(AUKCIJA_NIVO).toBe(6)
  })
})

describe('higijena kataloga', () => {
  it('POZIVI pokrivaju TAČNO sve funkcije u katalogu', () => {
    expect([...katalog.funkcije].sort()).toEqual(Object.keys(POZIVI).sort())
  })

  it('nijedan string nije prazan niti sadrži <, > ili & (umetanje kroz innerHTML je bezbedno)', () => {
    for (const [put, s] of sviTekstovi) {
      expect(s.length, put).toBeGreaterThan(0)
      expect(/[<>&]/.test(s), `${put}: ${s}`).toBe(false)
    }
  })

  it('samo latinica (bez ćirilice) i bez ASCII zamena za —, „“, …', () => {
    for (const [put, s] of sviTekstovi) {
      expect(/[\u0400-\u04FF]/.test(s), put).toBe(false)
      expect(s.includes('"'), put).toBe(false)
      expect(s.includes('...'), put).toBe(false)
      expect(s.includes(' - '), put).toBe(false)
    }
  })

  it('razmak na početku/kraju samo tamo gde prototip seče tekst markapom', () => {
    const dozvoljeno = new Set([
      'hud.nivo',
      'noviNivo.nagrada',
      'poklon.pre',
      'poklon.posle',
      'narudzbe.nagradaDin',
    ])
    const saRazmakom = sviTekstovi.filter(([, s]) => s !== s.trim()).map(([put]) => put)
    expect([...new Set(saRazmakom)].sort()).toEqual([...dozvoljeno].sort())
    expect(t.hud.nivo).toBe('Nv. ')
    expect(t.noviNivo.nagrada).toBe('Nagrada: ')
    expect(t.poklon.pre).toBe('Dobio si ')
    expect(t.poklon.posle.startsWith(' ')).toBe(true)
  })

  it('tačni znakovi (05 §1.5)', () => {
    const cp = (s: string): string[] => [...s].map((c) => (c.codePointAt(0) ?? 0).toString(16))
    expect(cp(t.njive.plus)).toEqual(['ff0b'])
    expect(cp(t.noviNivo.zvezda)).toEqual(['2b50'])
    expect(cp(t.toast.dobrodosao).slice(-3)).toEqual(['1f469', '200d', '1f33e'])
    expect(t.narudzbe.odbij).toBe('Nemam to — daj drugu ↺')
    expect(t.pijaca.smer).toEqual({
      gore: '▲ dobra cena',
      dole: '▼ slaba cena',
      prosek: '— prosek',
    })
    expect(t.radnja.kupljeno).toBe('Kupljeno ✓ — nalazi se na farmi.')
    expect(t.narudzbe.nagradaXp(1)).toBe('✦ +1 XP')
    expect(t.narudzbe.poruka('x')).toBe('„x“')
    expect(t.pijaca.kolicina(1)).toBe('× 1 kom')
  })

  it('valuta u novčaniku je „din" (NBSP ispred stavlja skelet), svuda drugde običan razmak', () => {
    expect(t.hud.valuta).toBe('din')
    for (const [put, s] of sviTekstovi) expect(s.includes('\u00a0'), put).toBe(false)
  })
})

describe('D9 i D17', () => {
  it('D9: poruke kad sejv ne može da se učita (readOnly sesija)', () => {
    expect(t.toast.ucitavanjeNeuspelo).toBe(
      'Napredak ne može da se učita — igra se ovaj put neće čuvati.',
    )
    expect(t.toast.sejvNovijeVerzije).toBe(
      'Napredak je iz novije verzije igre — igra se ovaj put neće čuvati.',
    )
  })

  it('D17: podnaslov nosi verziju iz package.json', () => {
    expect(t.hud.podnaslov).toBe(`prototip v${VERZIJA}`)
    expect(t.hud.podnaslov).not.toContain('0.3')
  })
})
