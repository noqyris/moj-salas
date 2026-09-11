// @vitest-environment jsdom
/*
 * Regresija 1 (CLAUDE.md, 07 R1): keš potpisa njiva. Stanje u core-u je u bagovitoj varijanti tačno;
 * zastareva DOM i handler vezan pri crtanju (parcela ostaje „raste" sa handlerom zalivanja, koji posle
 * zrenja ćuti). Zato test vozi PRAVO crtanje i PRAVI tick i proverava i DOM i efekat klika.
 *
 * Sat se PRESKAČE bez međutikova (skok + TAČNO jedan tick): sa tikom svake sekunde bagovita varijanta
 * se sama popravi (tick vidi f1, f2, f3) i test bi bio bezvredan (07 R1, izmereno na prototipu).
 *
 * Mutacija koja mora da obori test: upis keša premešten iz `crtaj` u `tik` (samo tick kešira) —
 * druga tura ostaje „raste" i drugo `toHaveLength(2)` pada.
 */
import { describe, expect, it } from 'vitest'
import { T0 } from '../helpers'
import { mountApp, type Montirana } from '../helpers/mountApp'

function posadi(h: Montirana, i: number): void {
  h.klik(`.parcela[data-i="${i}"]`)
  expect(h.q('#list.otvoren')).not.toBeNull()
  h.klik('[data-seme="psenica"]')
}

describe('R1 — keš potpisa njiva', () => {
  it('R1: posadi → uberi → posadi istu kombinaciju → druga tura je zrela i uberiva', async () => {
    const h = await mountApp({ sejv: null, t0: T0, tajmeri: 'red' }) // nova igra: 50 din, 2 prazne
    posadi(h, 0)
    posadi(h, 1)
    expect(h.stanje().novac).toBe(30)
    h.skok(21_000)
    h.tik(1) // skok sata, pa TAČNO jedan tick (bez međutikova)
    expect(h.qa('.parcela.zrelo')).toHaveLength(2)
    expect(h.q('#uberiSve')?.textContent).toBe('Uberi sve (2)')
    h.klik('#uberiSve') // „Uberi sve" crta sinhrono (L1018)
    expect(h.stanje().mag.psenica).toBe(2)
    expect(h.qa('.parcela.prazna')).toHaveLength(2)
    // D15: posle „Uberi sve" njiva ignoriše tapove ZAKLJUCAVANJE_TAPA_MS; pauza ne tika i ne pomera
    // sat igre, pa ne menja ništa što ovaj test proverava.
    h.pauza(350)
    posadi(h, 0)
    posadi(h, 1) // ista kombinacija → potpis se vraća na „zz"
    expect(h.stanje().novac).toBe(10)
    h.skok(21_000)
    h.tik(1)
    expect(h.qa('.parcela.zrelo')).toHaveLength(2) // bagovita varijanta: 0
    expect(h.q('#uberiSve')?.textContent).toBe('Uberi sve (2)')
    h.klik('.parcela[data-i="0"]')
    h.pauza(180) // žetva jedne parcele crta njivu posle 180 ms (L1006)
    h.klik('.parcela[data-i="1"]')
    h.pauza(180)
    expect(h.stanje().mag.psenica).toBe(4)
    expect(h.stanje().parcele.map((p) => p.c)).toEqual([null, null])
  })

  /*
   * R1b (D12, 04 B3): sat ide 1 ms napred pri SVAKOM čitanju. Crtanje njiva mora da koristi jedan
   * `now` za DOM i za potpis: da čita sat više puta, parcela koja sazri između DOM-a i potpisa bi
   * ostala nacrtana kao „raste" dok keš već kaže „z" — sledeći tick ne vidi promenu i parcela se
   * zaglavi (99 %, klik ćuti). Probamo 30 uzastopnih trenutaka oko granice zrenja (20 000 ms), da
   * bar jedan pogodi prelaz unutar crtanja bez obzira na to koliko čitanja sata ima pre njega.
   */
  it('R1b: jedan now po crtanju njiva — sazrevanje „unutar" crtanja ne zaglavi parcelu', async () => {
    for (let d = 1; d <= 30; d++) {
      const h = await mountApp({ korakSata: 1 })
      posadi(h, 0)
      const posadjeno = h.stanje().parcele[0]?.t ?? NaN
      // Tick oko sredine rasta: keš je „f2x".
      h.skok(posadjeno + 10_000 - h.sad())
      h.tik()
      expect(h.app.igra().s.parcele[0]?.c, `d=${d}`).toBe('psenica')
      // Tick koji prvi put čita sat d ms pre zrenja: f2 → f3 menja potpis, pa se njiva crta tu, na
      // samoj granici.
      h.skok(posadjeno + 20_000 - d - h.sad())
      h.tik()
      // Sledeći tick, posle zrenja: parcela MORA da postane zrela i uberiva.
      h.skok(1_000)
      h.tik()
      const el = h.q('.parcela[data-i="0"]')
      expect(el?.classList.contains('zrelo'), `d=${d}: parcela nije zrela posle ticka`).toBe(true)
      h.klik(el)
      expect(h.stanje().mag.psenica, `d=${d}: klik nije ubrao`).toBe(1)
    }
  }, 20_000) // više mountova/koraka: izričit rok da ne zavisi od opterećenja (coverage)
})
