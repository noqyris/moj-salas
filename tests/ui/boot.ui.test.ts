// @vitest-environment jsdom
/*
 * Boot (ugovor §6 + D9/D16, 03 §10, 04 §4.11): redosled, kartice povratka i poklona, prvo čuvanje,
 * readOnly sesije, jedan interval tek posle učitavanja.
 */
import { describe, expect, it } from 'vitest'
import { ART } from '../../src/art'
import { KLJUC_REZERVE, KLJUC_SEJVA, SEJV_ODLAGANJE_MS, TIK_MS, TOAST_MS } from '../../src/config'
import { MemoryStorage } from '../../src/platform'
import { DAN_T0, MAG0, T0, stanje } from '../helpers'
import { mountApp } from '../helpers/mountApp'

/** HTML kako ga serijalizuje DOM (SVG sprajtovi se normalizuju isto kao u aplikaciji). */
function kaoDom(html: string): string {
  const d = document.createElement('div')
  d.innerHTML = html
  return d.innerHTML
}

const SAT = 3_600_000

/** 04 Appendix A, stanje G7: odsustvo 1 h, sazrela pšenica, mlin gotov, kokošinjac pun (4), poklon
 *  nije uzet, xp 100 (nivo 3), 500 din. */
function g7(o: { kazan?: boolean } = {}) {
  return stanje({
    novac: 500,
    xp: 100,
    mute: false,
    poklonDan: '',
    videno: T0 - SAT,
    parcele: [
      { c: 'psenica', t: T0 - SAT + 1000, z: false },
      { c: null, t: 0, z: false },
    ],
    masine: {
      mlin: { k: true, t: T0 - SAT + 1000 },
      kazan: o.kazan ? { k: true, t: T0 - SAT + 5000 } : { k: false, t: 0 },
    },
    ziv: { kokosinjac: { k: true, t: T0 - SAT }, stala: { k: false, t: 0 } },
    mag: { ...MAG0 },
  })
}

describe('boot — nova igra', () => {
  it('toast „Dobro došao na farmu", bez kartica; tajmeri tačno [2300, 1200]; jedan interval od 1 s', async () => {
    const h = await mountApp({ tajmeri: 'red' })
    expect(h.q('#toast')?.textContent).toBe('Dobro došao na farmu! 👩‍🌾')
    expect(h.q('#toast')?.classList.contains('vidljiv')).toBe(true)
    expect(h.q('#nivoVeo.otvoren')).toBeNull()
    expect(h.timeouti()).toEqual([TOAST_MS, SEJV_ODLAGANJE_MS])
    expect(h.intervali()).toEqual([TIK_MS])
    // Leptiri su popunjeni; HUD je izbrojao do 50; hint je na parceli 0.
    expect(h.q('#leptir1')?.innerHTML).toBe(kaoDom(ART.leptir))
    expect(h.q('#leptir2')?.innerHTML).toBe(kaoDom(ART.leptir))
    expect(h.q('#novac')?.textContent).toBe('50')
    expect(h.q('.parcela[data-i="0"] .hint')?.textContent).toBe('Tapni da posadiš 👇')
    // Nova igra: 2 narudžbine sa ID-jevima 1 i 2.
    expect(h.stanje().narudzbe.map((o) => o.id)).toEqual([1, 2])
    // Prvo čuvanje je odloženo (debounce), pa se upisuje tek posle 1200 ms.
    expect(h.skladiste?.upisi).toEqual([])
    h.pauza(SEJV_ODLAGANJE_MS)
    expect(h.skladiste?.upisi.map((u) => u.kljuc)).toEqual([KLJUC_SEJVA])
    expect(h.sacuvano()).toMatchObject({ v: 3, novac: 50, sadio: false, poklonDan: '' })
  })

  it('pre kraja učitavanja: nema intervala, nema upisa, sakrivanje ne piše (04 B4 / D9)', async () => {
    const sk = new MemoryStorage({
      [KLJUC_SEJVA]: JSON.stringify(stanje({ novac: 777, xp: 150 })),
    })
    sk.zadrziGet = true
    const h = await mountApp({ skladiste: sk, boot: false })
    const boot = h.app.boot()
    await h.mikro()
    expect(h.intervali()).toEqual([])
    h.sakrij() // lifecycle još nije vezan
    expect(sk.upisi).toEqual([])
    sk.pustiGet()
    await boot
    expect(h.stanje().novac).toBe(777)
    expect(h.intervali()).toEqual([TIK_MS])
    h.sakrij() // sada: trenutni upis
    expect(sk.upisi.map((u) => u.kljuc)).toEqual([KLJUC_SEJVA, KLJUC_SEJVA])
    expect(h.sacuvano()).toMatchObject({ novac: 777, xp: 150 })
  })

  it('drugi poziv boot-a ne radi ništa (jedan interval, jedno učitavanje)', async () => {
    const h = await mountApp()
    await h.app.boot()
    expect(h.intervali()).toEqual([TIK_MS])
    expect(h.skladiste?.getPozivi).toBe(1)
  })
})

describe('boot — povratak posle odsustva (G7) i dnevni poklon', () => {
  it('„Dobro došao nazad" (D16: red po mašini), pa poklon u redu; HUD bez poklona do „Hvala!"', async () => {
    const h = await mountApp({ sejv: g7(), tajmeri: 'red' })
    expect(h.q('#nivoVeo.otvoren')).not.toBeNull()
    expect(h.q('#nivoKartica')?.innerHTML).toBe(
      kaoDom(
        '<div class="zvezda">🌅</div><h3>Dobro došao nazad!</h3><p>Dok te nije bilo:</p><div class="spisak">' +
          `<div><span class="slicica">${ART.psenica3}</span>Sazrelo useva: 1</div>` +
          `<div><span class="slicica">${ART.mlin}</span>Brašno je samleveno!</div>` +
          `<div><span class="slicica">${ART.jaje}</span>Jaja: +4</div>` +
          '</div><button class="dugme zlatno" id="nivoOk">Idemo!</button>',
      ),
    )
    // Poklon je već u stanju (40 + 3·35 = 145) i UPISAN odmah, ali HUD ga još ne pokazuje.
    expect(h.stanje().novac).toBe(645)
    expect(h.stanje().poklonDan).toBe(DAN_T0)
    expect(h.q('#novac')?.textContent).toBe('500')
    expect(h.skladiste?.upisi).toHaveLength(1)
    expect(h.sacuvano()).toMatchObject({ novac: 645, poklonDan: DAN_T0, videno: T0 })
    // Idemo! → kartica poklona.
    h.pauza(350)
    h.klik('#nivoOk')
    expect(h.q('#nivoKartica')?.innerHTML).toBe(
      kaoDom(
        `<span class="slicica" style="width:56px;display:inline-block">${ART.poklon}</span>` +
          '<h3>Dnevni poklon</h3><p>Dobio si <b style="color:var(--zlato-t)">+145 din</b> za vernost farmi. Vidimo se sutra!</p>' +
          '<button class="dugme zlatno" id="nivoOk">Hvala!</button>',
      ),
    )
    expect(h.q('#novac')?.textContent).toBe('500')
    h.pauza(350)
    const zvuciPre = h.zvuci.length
    h.klik('#nivoOk')
    expect(h.q('#nivoVeo.otvoren')).toBeNull()
    expect(h.q('#novac')?.textContent).toBe('645')
    expect(h.zvuci.slice(zvuciPre)).toEqual(['tap', 'novac'])
  })

  it('D16: kad su obe mašine gotove, po jedan red za mlin i kazan (redom MASINE)', async () => {
    const h = await mountApp({ sejv: g7({ kazan: true }) })
    const linije = h.qa('#nivoKartica .spisak > div').map((d) => d.textContent)
    expect(linije).toEqual([
      'Sazrelo useva: 1',
      'Brašno je samleveno!',
      'Ajvar je gotov!',
      'Jaja: +4',
    ])
    const ikonice = h.qa('#nivoKartica .spisak .slicica').map((s) => s.innerHTML)
    expect(ikonice).toEqual([ART.psenica3, ART.mlin, ART.kazan, ART.jaje].map(kaoDom))
  })

  it('prvi tick posle povratka završava mašinu: toast i XP ispod otvorene kartice', async () => {
    const h = await mountApp({ sejv: g7() })
    h.tik()
    expect(h.stanje().mag.brasno).toBe(1)
    expect(h.stanje().xp).toBe(108)
    expect(h.q('#toast')?.textContent).toBe('Brašno je samleveno!')
    expect(h.q('[data-mbar="mlin"]')).toBeNull()
    expect(h.q('[data-kuvaj="mlin"]')).not.toBeNull()
    expect(h.q('#nivoKartica h3')?.textContent).toBe('Dobro došao nazad!')
  })

  it('odsustvo tačno 180 s: nema kartice povratka (strogo >), a poklon ide', async () => {
    const h = await mountApp({
      sejv: stanje({
        videno: T0 - 180_000,
        poklonDan: '',
        parcele: [
          { c: 'psenica', t: T0 - 30_000, z: false },
          { c: null, t: 0, z: false },
        ],
      }),
    })
    expect(h.q('#nivoKartica h3')?.textContent).toBe('Dnevni poklon')
    h.zatvoriOverlaye()
    expect(h.q('#nivoVeo.otvoren')).toBeNull()
  })
})

describe('boot — sejv koji ne sme da se pregazi (D9, D10)', () => {
  it('skladište odbije čitanje: toast upozorenja, nova igra samo u memoriji, NIŠTA se ne piše', async () => {
    const sk = new MemoryStorage({ [KLJUC_SEJVA]: JSON.stringify(stanje({ novac: 9999 })) })
    sk.odbijGet = true
    const h = await mountApp({ skladiste: sk })
    expect(h.q('#toast')?.textContent).toBe(
      'Napredak ne može da se učita — igra se ovaj put neće čuvati.',
    )
    expect(h.stanje().novac).toBe(50)
    h.klik('.parcela[data-i="0"]')
    h.klik('[data-seme="psenica"]')
    h.sakrij()
    expect(sk.upisi).toEqual([])
    expect(JSON.parse(sk.podaci.get(KLJUC_SEJVA) ?? 'null')).toMatchObject({ novac: 9999 })
  })

  it('sejv iz novije verzije: toast upozorenja, original netaknut, bez upisa', async () => {
    const buduci = JSON.stringify({ ...stanje({ novac: 1234 }), v: 4 })
    const h = await mountApp({ sejv: buduci })
    expect(h.q('#toast')?.textContent).toBe(
      'Napredak je iz novije verzije igre — igra se ovaj put neće čuvati.',
    )
    h.sakrij()
    expect(h.skladiste?.upisi).toEqual([])
    expect(h.skladiste?.podaci.get(KLJUC_SEJVA)).toBe(buduci)
  })

  it('neispravan JSON: sirovi original ide u rezervu PRE prvog upisa nove igre', async () => {
    const h = await mountApp({ sejv: '{"v":3, pokvaren' })
    expect(h.skladiste?.upisi.map((u) => u.kljuc)).toEqual([KLJUC_REZERVE, KLJUC_SEJVA])
    expect(h.skladiste?.podaci.get(KLJUC_REZERVE)).toBe('{"v":3, pokvaren')
    expect(h.q('#toast')?.textContent).toBe('Dobro došao na farmu! 👩‍🌾')
  })

  it('bez trajnog skladišta igra radi (samo u memoriji)', async () => {
    const h = await mountApp({ skladiste: null })
    h.klik('.parcela[data-i="0"]')
    h.klik('[data-seme="psenica"]')
    expect(h.stanje().novac).toBe(40)
    expect(h.stanje().videno).toBe(T0)
  })
})
