// @vitest-environment jsdom
/*
 * referenca-sim.jsdom.js → vitest, 1:1 (07 §a): isti scenariji, isti selektori, iste provere. Svaki
 * `ok(uslov, poruka)` iz referenca-sim-a je `expect.soft` sa oznakom „Cnn <tekst provere>", pa se svih
 * 59 provera prijavljuje pojedinačno.
 *
 * Razlike prema originalu (sve namerne):
 * - fiksture su relativne prema T0 (07 §0.3), a „današnji" poklonDan iz TEST 5 je DAN_T0;
 * - rng igre, efekata i fuzz-a je seedovan (07 §c.4) — original koristi nesedovan Math.random;
 * - D15 (zaštita od duplog tapa): posle „Uberi sve", prodaje, isporuke/odbijanja i otvaranja lista ta
 *   oblast ignoriše tapove ZAKLJUCAVANJE_TAPA_MS po perfNow-u. U mountApp-u perfNow stoji dok ga
 *   `h.pauza` ne pomeri, pa je `h.pauza(350)` ubačen TAČNO tamo gde bi drugi tap pao u zaključanu
 *   oblast (svako mesto je komentarisano). `h.zatvoriOverlaye` sam pauzira pre svakog OK (vidi helper),
 *   a fuzz u TEST 5 pauzira ZAKLJUCAVANJE_TAPA_MS pre svake akcije (prototip nema zaključavanje);
 * - C41 je pojačan po 07: original `includes('1')` pogađa i cifre iz „Ubrano"/„Zarađeno".
 */
import { describe, expect, it } from 'vitest'
import { ZAKLJUCAVANJE_TAPA_MS } from '../../src/config'
import { DAN_T0, MAG0, T0, mulberry32 } from '../helpers'
import { mountApp, type Montirana } from '../helpers/mountApp'

function ok(uslov: unknown, poruka: string): void {
  expect.soft(Boolean(uslov), poruka).toBe(true)
}

const broj = (h: Montirana, s: string): number => parseInt(h.q(s)?.textContent ?? '', 10)
const cifre = (h: Montirana, s: string): string => (h.q(s)?.textContent ?? '').replace(/\D/g, '')

interface SacuvanSejv {
  v: number
  novac: number
  parcele: unknown[]
  mag: Record<string, number>
  masine: { kazan: { k: boolean } }
  ziv: { kokosinjac: { k: boolean } }
}
function sejv(h: Montirana): SacuvanSejv {
  return h.sacuvano() as SacuvanSejv
}

const PRAZNE = [
  { c: null, t: 0, z: false },
  { c: null, t: 0, z: false },
]
const BEZ_ZGRADA = {
  masine: { mlin: { k: false, t: 0 }, kazan: { k: false, t: 0 } },
  ziv: { kokosinjac: { k: false, t: 0 }, stala: { k: false, t: 0 } },
}

describe('referenca-sim (59 provera) nad portom', () => {
  it('TEST 1: nova igra — sadnja, zalivanje, žetva, prodaja', async () => {
    const h = await mountApp()
    h.zatvoriOverlaye()

    ok(h.qa('.parcela').length === 3, 'C01 na startu 2 prazne parcele + 1 zaključana')
    ok(h.q('#novac')?.textContent?.trim() === '50', 'C02 početni novac je 50')

    // sadnja pšenice
    h.klik(h.qa('.parcela.prazna')[0])
    ok(h.q('#list.otvoren'), 'C03 donji list za izbor semena se otvara')
    h.klik('[data-seme="psenica"]')
    ok(!h.q('#list.otvoren'), 'C04 list se zatvara posle sadnje')
    ok(h.q('.parcela .traka'), 'C05 posađena parcela ima traku napretka')
    ok(h.q('#novac')?.textContent?.trim() === '40', 'C06 novac umanjen za seme (40)')

    // zalivanje
    ok(h.q('.parcela .zalij'), 'C07 ikonica kapljice vidljiva pre zalivanja')
    h.klik('.parcela[data-i="0"]')
    ok(h.q('#toast')?.textContent?.includes('Zaliveno'), 'C08 zalivanje daje potvrdu')
    ok(!h.q('.parcela .zalij'), 'C09 kapljica nestaje posle zalivanja')
    h.klik('.parcela[data-i="0"]')
    ok(h.q('#toast')?.textContent?.includes('Već'), 'C10 duplo zalivanje blokirano')

    // rast (20 s · 0,75 = 15 s posle zalivanja)
    h.skok(16000)
    h.tik()
    ok(h.q('.parcela.zrelo'), 'C11 pšenica zrela posle ubrzanog rasta')
    h.klik('.parcela.zrelo')
    ok(!h.q('.parcela.zrelo'), 'C12 žetva prazni parcelu')

    // prodaja
    h.klik('nav [data-tab="pijaca"]')
    ok(h.q('[data-prodaj="psenica"]'), 'C13 pšenica na tezgi posle žetve')
    h.klik('[data-prodaj="psenica"]')
    const n1 = parseInt(cifre(h, '#novac'), 10)
    ok(n1 > 40, 'C14 prodaja povećava novac')
    ok(!h.q('[data-prodaj="psenica"]'), 'C15 tezga prazna posle prodaje svega')

    expect(h.greske).toEqual([])
  })

  it('TEST 2: level-up petlja i narudžbine', async () => {
    const h = await mountApp()
    h.zatvoriOverlaye()

    let nivoOverlayVidjen = false
    for (let c = 0; c < 22; c++) {
      const prazne = h.qa('.parcela.prazna')
      for (const p of prazne) {
        h.klik(p)
        const s = h.q('[data-seme="psenica"]:not([disabled])')
        if (s) h.klik(s)
        else {
          // D15: pozadina lista (#veo) ignoriše tapove odmah posle otvaranja lista.
          h.pauza(350)
          h.klik('#veo')
          break
        }
      }
      h.skok(21000)
      h.tik()
      const sve = h.q('#uberiSve')
      if (sve) {
        h.klik(sve)
        // D15: posle „Uberi sve" njiva ignoriše tapove; sledeća tura tapka prazne parcele.
        h.pauza(350)
      } else {
        let z: HTMLElement | null
        while ((z = h.q('.parcela.zrelo'))) h.klik(z)
      }
      if (h.q('#nivoVeo.otvoren')) {
        nivoOverlayVidjen = true
        h.zatvoriOverlaye()
      }
      // povremeno prodaj
      if (c % 4 === 3) {
        h.klik('nav [data-tab="pijaca"]')
        const pr = h.q('[data-prodaj]')
        if (pr) h.klik(pr)
        h.klik('nav [data-tab="farma"]')
      }
    }
    ok(nivoOverlayVidjen, 'C16 level-up overlay se pojavio tokom grinda')
    ok(broj(h, '#nivoBr') >= 2, 'C17 dostignut bar nivo 2')

    // narudžbine
    h.klik('nav [data-tab="narudzbe"]')
    ok(h.qa('[data-isporuci]').length === 2, 'C18 uvek postoje tačno 2 narudžbine')
    const idPre = h
      .qa('[data-isporuci]')
      .map((b) => b.dataset.isporuci)
      .join(',')
    h.klik('[data-odbij]')
    const idPosle = h
      .qa('[data-isporuci]')
      .map((b) => b.dataset.isporuci)
      .join(',')
    ok(idPre !== idPosle, 'C19 odbijanje menja narudžbinu')
    ok(h.qa('[data-isporuci]').length === 2, 'C20 posle odbijanja i dalje 2 narudžbine')
    const ids = h.qa('[data-isporuci]').map((b) => b.dataset.isporuci)
    ok(new Set(ids).size === ids.length, 'C21 ID-jevi narudžbina su jedinstveni')

    expect(h.greske).toEqual([])
  })

  it('TEST 3: mašine, životinje, isporuka narudžbine', async () => {
    const h = await mountApp({
      sejv: {
        v: 3,
        novac: 100000,
        xp: 5000,
        parcele: PRAZNE,
        mag: { ...MAG0, psenica: 20, sargarepa: 10, paprika: 9, bundeva: 2 },
        ...BEZ_ZGRADA,
        narudzbe: [],
        mute: true,
        sadio: true,
        stat: { ubrano: 0, zaradjeno: 0, isporuke: 0 },
        poklonDan: '',
        videno: T0,
      },
    })
    h.zatvoriOverlaye() // dnevni poklon

    ok(broj(h, '#nivoBr') >= 5, 'C22 xp 5000 daje bar nivo 5')

    // kupovina svega u radnji
    h.klik('nav [data-tab="radnja"]')
    const provere = { mlin: 'C23', kazan: 'C24', kokosinjac: 'C25', stala: 'C26' } as const
    for (const id of ['mlin', 'kazan', 'kokosinjac', 'stala'] as const) {
      const b = h.q('[data-kupi="' + id + '"]')
      ok(!!b, provere[id] + ' radnja nudi kupovinu: ' + id)
      h.klik(b)
    }
    ok(h.qa('[data-kupi]').length === 0, 'C27 sve zgrade kupljene, nema više dugmadi za kupovinu')

    // farma: mašine rade
    h.klik('nav [data-tab="farma"]')
    ok(h.q('[data-masina="kazan"]'), 'C28 kazan kartica na farmi')
    ok(h.q('#scenaKoka')?.style.display === 'block', 'C29 kokoška se pojavila u sceni')
    ok(h.q('#scenaKrava')?.style.display === 'block', 'C30 krava se pojavila u sceni')

    h.klik('[data-kuvaj="kazan"]')
    ok(h.q('[data-mbar="kazan"]'), 'C31 kazan kuva (traka vidljiva)')
    h.klik('[data-kuvaj="mlin"]')
    h.skok(241000)
    h.tik()
    ok(!h.q('[data-mbar="kazan"]'), 'C32 kazan završio posle 4 min')

    // životinje
    h.skok(9 * 180000)
    h.tik()
    const pok = h.q<HTMLButtonElement>('[data-pokupi="kokosinjac"]')
    ok(pok && !pok.disabled, 'C33 jaja spremna za kupljenje')
    h.klik(pok)
    ok(h.q('#toast')?.textContent?.includes('jaja'), 'C34 kupljenje jaja daje potvrdu')
    const pokM = h.q<HTMLButtonElement>('[data-pokupi="stala"]')
    ok(pokM && !pokM.disabled, 'C35 mleko spremno posle preskoka vremena')
    h.klik(pokM)

    // pijaca sadrži proizvode
    h.klik('nav [data-tab="pijaca"]')
    ok(h.q('[data-prodaj="ajvar"]'), 'C36 ajvar na tezgi')
    ok(h.q('[data-prodaj="brasno"]'), 'C37 brašno na tezgi')
    ok(h.q('[data-prodaj="jaje"]'), 'C38 jaja na tezgi')

    // isporuka: odbijaj dok ne dođe isporučiva (mag je bogat)
    h.klik('nav [data-tab="narudzbe"]')
    let isporuceno = false
    for (let i = 0; i < 25 && !isporuceno; i++) {
      const b = h.q('[data-isporuci]:not([disabled])')
      if (b) {
        h.klik(b)
        isporuceno = true
        h.zatvoriOverlaye()
      } else {
        h.klik('[data-odbij]')
        // D15: posle odbijanja tabla ignoriše tapove (red se pomerio) — sledeći tap je u toj oblasti.
        h.pauza(350)
      }
    }
    ok(isporuceno, 'C39 narudžbina uspešno isporučena')
    ok(h.qa('[data-isporuci]').length === 2, 'C40 posle isporuke opet 2 narudžbine')

    // statistika zabeležena — pojačano (07 C41): tačna vrednost reda „Isporučenih narudžbina".
    h.klik('nav [data-tab="radnja"]')
    const redIsporuka = h
      .qa('#statKuca .statRed')
      .find((r) => r.querySelector('span')?.textContent === 'Isporučenih narudžbina')
    ok(
      h.stanje().stat.isporuke === 1 && redIsporuka?.querySelector('b')?.textContent === '1',
      'C41 statistika isporuka upisana',
    )

    // perzistencija: sejv postoji i validan je JSON v3
    const sacuvano = sejv(h)
    ok(sacuvano.v === 3, 'C42 sejv upisan kao v3')
    ok(sacuvano.masine.kazan.k === true, 'C43 sejv pamti kupljen kazan')
    ok(sacuvano.ziv.kokosinjac.k === true, 'C44 sejv pamti kokošinjac')

    expect(h.greske).toEqual([])
  })

  it('TEST 4: migracija v2 → v3 (stari igrači ne gube napredak)', async () => {
    const h = await mountApp({
      sejv: {
        v: 2,
        novac: 777,
        xp: 150,
        parcele: [
          { c: 'paprika', t: T0 - 60000 },
          { c: null, t: 0 },
        ],
        mag: { psenica: 3, sargarepa: 0, paprika: 2, bundeva: 0, grozdje: 1, ajvar: 1 },
        kazan: true,
        kazanT: 0,
        narudzbe: [
          {
            id: 5,
            ko: { ime: 'Baka Mira', emoji: '👵', boja: '#fff' },
            stavke: [{ k: 'psenica', kom: 2 }],
            din: 60,
            xp: 5,
          },
          {
            id: 6,
            ko: { ime: 'Piljar Pera', emoji: '🧢', boja: '#fff' },
            stavke: [{ k: 'sargarepa', kom: 1 }],
            din: 80,
            xp: 6,
          },
        ],
        mute: false,
        sadio: true,
        videno: T0,
      },
    })
    h.zatvoriOverlaye()

    ok(
      cifre(h, '#novac') === '777' || parseInt(cifre(h, '#novac'), 10) > 777,
      'C45 novac prenet iz v2 (777, ili više uz dnevni poklon)',
    )
    ok(h.q('[data-masina="kazan"]'), 'C46 kazan iz v2 sejva prenet kao vlasništvo')
    ok(h.q('.parcela .traka'), 'C47 zasađena paprika iz v2 i dalje raste')

    // fix kolizije ID-jeva: nova narudžbina ne sme dobiti id 5 ili 6
    h.klik('nav [data-tab="narudzbe"]')
    h.klik('[data-odbij]') // uklanja jednu, generiše novu
    const ids = h.qa('[data-isporuci]').map((b) => Number(b.dataset.isporuci))
    ok(new Set(ids).size === ids.length, 'C48 nema kolizije ID-jeva posle migracije')
    ok(Math.max(...ids) >= 7, 'C49 novi ID nastavlja od najvećeg starog')

    const sacuvano = sejv(h)
    ok(sacuvano.v === 3, 'C50 v2 sejv pretvoren u v3')
    ok(
      sacuvano.mag.jaje === 0 && sacuvano.mag.brasno === 0,
      'C51 nova polja magacina dodata u migraciji',
    )

    expect(h.greske).toEqual([])
  })

  it('TEST 5: anti-softlock i fuzz (400 nasumičnih akcija)', async () => {
    const fuzz = mulberry32(5)
    const h = await mountApp({
      sejv: {
        v: 3,
        novac: 600,
        xp: 200,
        parcele: PRAZNE,
        mag: { ...MAG0 },
        ...BEZ_ZGRADA,
        narudzbe: [],
        mute: true,
        sadio: true,
        stat: { ubrano: 0, zaradjeno: 0, isporuke: 0 },
        poklonDan: DAN_T0,
        videno: T0,
      },
      random: mulberry32(55),
      fxRandom: mulberry32(555),
    })
    h.zatvoriOverlaye()

    // 600 din, ništa ne raste, magacin prazan → kupovina kazana (600) mora biti odbijena
    h.klik('nav [data-tab="radnja"]')
    const kb = h.q<HTMLButtonElement>('[data-kupi="kazan"]')
    ok(kb && !kb.disabled, 'C52 kazan deluje kupljivo sa tačno 600 din')
    h.klik(kb)
    ok(
      h.q('#toast')?.textContent?.includes('Ostavi bar'),
      'C53 anti-softlock blokira trošenje zadnjeg dinara',
    )
    ok(cifre(h, '#novac') === '600', 'C54 novac netaknut posle blokade')

    // fuzz (seedovan; ista mešavina akcija kao referenca-sim R-L295–313). Pre svake akcije protekne
    // ZAKLJUCAVANJE_TAPA_MS igračevog vremena: prototip nema D15, pa bi bez pauze zaključana oblast
    // (npr. tezga posle prve prodaje) gutala sve kasnije tapove i fuzz bi dosezao manje igre.
    const rnd = <T>(a: readonly T[]): T | undefined => a[Math.floor(fuzz() * a.length)]
    const greske: string[] = []
    const pre = structuredClone(h.stanje().stat)
    for (let i = 0; i < 400; i++) {
      h.pauza(ZAKLJUCAVANJE_TAPA_MS)
      const akcija = fuzz()
      try {
        if (akcija < 0.3) {
          const kl = h.qa(
            '.parcela, .seme:not([disabled]), [data-prodaj], [data-isporuci]:not([disabled]), [data-odbij], [data-kuvaj]:not([disabled]), [data-pokupi]:not([disabled]), [data-kupi]:not([disabled]), #uberiSve, #nivoOk',
          )
          h.klik(rnd(kl))
        } else if (akcija < 0.55) {
          h.klik(rnd(h.qa('nav [data-tab]')))
        } else if (akcija < 0.75) {
          h.skok(Math.floor(5000 + fuzz() * 600000))
          h.tik()
        } else if (akcija < 0.9) {
          h.tik(2)
        } else {
          if (h.q('#list.otvoren')) h.klik('#veo')
          h.zatvoriOverlaye()
        }
      } catch (e) {
        greske.push('fuzz[' + i + ']: ' + String(e))
      }
    }
    ok(h.q('nav'), 'C55 UI živ posle fuzz testa')
    ok(h.qa('[data-isporuci]').length === 2, 'C56 i dalje tačno 2 narudžbine posle fuzza')
    const sacuvano = sejv(h)
    ok(typeof sacuvano.novac === 'number' && sacuvano.novac >= 0, 'C57 novac nikad negativan')
    ok(
      Object.values(sacuvano.mag).every((v) => Number.isInteger(v) && v >= 0),
      'C58 magacin bez negativnih/razlomljenih količina',
    )
    ok(sacuvano.parcele.length <= 9, 'C59 broj parcela ne prelazi maksimum')

    // Fuzz je zaista igrao (nije ga progutalo zaključavanje): bilo je žetve, prodaje i isporuke.
    // (Seed 5: bez pauze pre akcija ubrano 7, zarađeno 56, isporuka 0; sa pauzom 14 / 1698 / 1.)
    const posle = h.stanje().stat
    expect(posle.ubrano).toBeGreaterThan(pre.ubrano)
    expect(posle.zaradjeno).toBeGreaterThan(pre.zaradjeno)
    expect(posle.isporuke).toBeGreaterThan(pre.isporuke)

    // Kao referenca-sim („GREŠKE U IZVRŠAVANJU"): nijedna greška u handlerima, ticku ni tajmerima.
    expect(greske).toEqual([])
    expect(h.greske).toEqual([])
  }, 20_000) // više mountova/koraka: izričit rok da ne zavisi od opterećenja (coverage)
})
