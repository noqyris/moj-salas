// @vitest-environment jsdom
/*
 * Otkucaj (04 §2.12, 03 §4, 03 §12 „UI tick handler"): trake i odbrojavanja se menjaju U MESTU (isti
 * elementi, bez innerHTML), a ponovno crtanje ide samo na promenu potpisa njiva ili završenu turu
 * mašine. D4: „Pokupi" je disabled kad n ≤ 0. D14: oznaka trenda na tezgi prati cenu.
 */
import { describe, expect, it } from 'vitest'
import { trzisnaCena } from '../../src/core'
import { smerHtml } from '../../src/ui/tezga'
import { MAG0, T0, stanje } from '../helpers'
import { mountApp } from '../helpers/mountApp'

describe('tick — u mestu', () => {
  it('parcela koja raste: ista pločica, traka i odbrojavanje; faza f1→f2 crta njivu ponovo', async () => {
    const h = await mountApp()
    h.klik('.parcela[data-i="0"]')
    h.klik('[data-seme="psenica"]')
    const el = h.q('.parcela[data-i="0"]')
    h.skok(3000)
    h.tik()
    expect(h.q('.parcela[data-i="0"]')).toBe(el)
    expect(el?.querySelector<HTMLElement>('.traka i')?.style.width).toBe('15%')
    expect(el?.querySelector('.cd')?.textContent).toBe('17s')
    h.skok(4000) // 7000 ms: faza 2 → potpis se menja → nova pločica
    h.tik()
    const novi = h.q('.parcela[data-i="0"]')
    expect(novi).not.toBe(el)
    expect(novi?.querySelector('.traka i')?.getAttribute('style')).toBe('width:35%')
    expect(novi?.querySelector('.cd')?.textContent).toBe('13s')
  })

  it('mašina koja radi: odbrojavanje i traka u mestu; kraj ture: jedan proizvod, XP, ponovno crtanje', async () => {
    const h = await mountApp({
      sejv: stanje({
        xp: 200,
        mag: { ...MAG0, paprika: 3 },
        masine: { mlin: { k: false, t: 0 }, kazan: { k: true, t: 0 } },
      }),
    })
    h.klik('[data-kuvaj="kazan"]')
    const kartica = h.q('[data-masina="kazan"]')
    const traka = h.q('[data-mbar="kazan"]')
    h.skok(60_000)
    h.tik()
    expect(h.q('[data-masina="kazan"]')).toBe(kartica)
    expect(h.q('[data-mbar="kazan"]')).toBe(traka)
    expect(traka?.style.width).toBe('25%')
    expect(h.q('[data-mcd="kazan"]')?.textContent).toBe('Gotovo za 3:00')
    h.skok(10 * 3_600_000) // 10 h: i dalje TAČNO jedan ajvar
    h.tik()
    expect(h.stanje().mag.ajvar).toBe(1)
    expect(h.stanje().xp).toBe(225)
    expect(h.q('#toast')?.textContent).toBe('Ajvar je gotov!')
    expect(h.q('[data-masina="kazan"]')).not.toBe(kartica)
    expect(h.q<HTMLButtonElement>('[data-kuvaj="kazan"]')?.disabled).toBe(true)
    // Strukturna promena crta i tezgu: ajvar je na njoj.
    expect(h.q('[data-prodaj="ajvar"]')).not.toBeNull()
  })

  it('životinja: broj, traka i disabled u mestu (0 → 1 nije strukturno); tačka „Farma"', async () => {
    const h = await mountApp({
      sejv: stanje({
        xp: 200,
        ziv: { kokosinjac: { k: true, t: T0 }, stala: { k: false, t: 0 } },
      }),
    })
    const dugme = h.q<HTMLButtonElement>('[data-pokupi="kokosinjac"]')
    expect(dugme?.disabled).toBe(true)
    expect(h.q('#tackaFarma')?.classList.contains('ima')).toBe(false)
    h.skok(90_000)
    h.tik()
    expect(h.q('[data-zbar="kokosinjac"]')?.style.width).toBe('50%')
    h.skok(90_000)
    h.tik()
    expect(h.q('[data-pokupi="kokosinjac"]')).toBe(dugme) // isti element
    expect(dugme?.disabled).toBe(false)
    expect(h.q('[data-zn="kokosinjac"]')?.textContent).toBe('1')
    expect(h.q('[data-zbar="kokosinjac"]')?.style.width).toBe('0%')
    expect(h.q('#tackaFarma')?.classList.contains('ima')).toBe(true)
    // Pun kokošinjac: traka 100 %.
    h.skok(4 * 180_000)
    h.tik()
    expect(h.q('[data-zn="kokosinjac"]')?.textContent).toBe('4')
    expect(h.q('[data-zbar="kokosinjac"]')?.style.width).toBe('100%')
  })

  it('D4: sat vraćen unazad — 0 spremnih, dugme disabled, klik ne radi ništa', async () => {
    const h = await mountApp({
      sejv: stanje({
        xp: 200,
        ziv: { kokosinjac: { k: true, t: T0 - 180_000 }, stala: { k: false, t: 0 } },
      }),
    })
    const dugme = h.q<HTMLButtonElement>('[data-pokupi="kokosinjac"]')
    expect(dugme?.disabled).toBe(false)
    h.skok(-600_000)
    h.tik()
    expect(h.q('[data-zn="kokosinjac"]')?.textContent).toBe('0')
    expect(dugme?.disabled).toBe(true)
    h.klik(dugme)
    expect(h.stanje().mag.jaje).toBe(0)
    expect(h.stanje().xp).toBe(200)
  })

  it('D14: tick osvežava cenu I oznaku trenda (▲/▼/—) na tezgi', async () => {
    const h = await mountApp({ sejv: stanje({ mag: { ...MAG0, psenica: 3 } }) })
    h.klik('nav [data-tab="pijaca"]')
    const pocetni = trzisnaCena('psenica', T0).smer
    // Prvi trenutak (korak 10 s) u kome je trend drugačiji.
    let dt = 10_000
    while (trzisnaCena('psenica', T0 + dt).smer === pocetni) dt += 10_000
    const b = h.q('[data-cena="psenica"]')
    h.skok(dt)
    h.tik()
    const { cena, smer } = trzisnaCena('psenica', T0 + dt)
    expect(h.q('[data-cena="psenica"]')).toBe(b) // u mestu
    expect(b?.textContent).toBe(cena + ' din')
    const oznaka = document.createElement('div')
    oznaka.innerHTML = smerHtml(smer)
    expect(b?.nextElementSibling?.outerHTML).toBe(oznaka.innerHTML)
  })

  it('tick bez strukturne promene ne menja nijedan region renderera (samo u mestu)', async () => {
    const h = await mountApp({ sejv: stanje({ mag: { ...MAG0, psenica: 3 } }) })
    const regioni = ['#njive', '#zgradeKuca', '#narudzbeKuca', '#radnjaKuca', '#statKuca']
    const pre = regioni.map((s) => h.q(s)?.firstElementChild ?? null)
    h.skok(1000)
    h.tik()
    expect(regioni.map((s) => h.q(s)?.firstElementChild ?? null)).toEqual(pre)
  })
})
