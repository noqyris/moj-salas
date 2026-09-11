// @vitest-environment jsdom
/*
 * Regresija 8 (CLAUDE.md, 07 R8 — UI polovina): JEDNO dodavanje XP-a koje preskoči više nivoa prikazuje
 * SVAKI nivo, redom, kao zasebnu karticu (FIFO), svaku sa svojim bonusom i otključavanjima; bonusi su u
 * novcu odmah, pre bilo kog OK. Tekstovi kartica su izmereni na prototipu (07 R8, exp4/exp7; nivoi 6 i 7
 * iz 04 Appendix A).
 *
 * Mutacije koje moraju da obore test: `if` umesto `while` u petlji nivoa (samo „Nivo 2!"); bonus samo
 * za poslednji nivo (novac ≠ 435); kartice LIFO ili prepisane (redosled/tekst).
 */
import { describe, expect, it } from 'vitest'
import { MAG0, narudzba, stanje } from '../helpers'
import { mountApp, type Montirana } from '../helpers/mountApp'

/** Tekst kartica redom kako se zatvaraju (OK tek kad istekne D15 zaključavanje — čovek čita). */
function procitajKartice(h: Montirana): string[] {
  const kartice: string[] = []
  while (h.q('#nivoVeo.otvoren') && kartice.length < 10) {
    kartice.push(h.q('#nivoKartica')?.textContent ?? '')
    h.pauza(350)
    h.klik('#nivoOk')
  }
  return kartice
}

describe('R8 — XP preko više nivoa, kroz UI', () => {
  it('isporuka vredna 200 XP sa nivoa 1: kartice Nivo 2, 3, 4 (FIFO) sa tačnim tekstom', async () => {
    const h = await mountApp({
      tajmeri: 'red', // pravi redosled: zvuk novca kasni NOVAC_ZVUK_ODLAGANJE_MS za level-up-ovima
      sejv: stanje({
        mute: false,
        mag: { ...MAG0, psenica: 1 },
        narudzbe: [narudzba(1, 'psenica', 1, 25, 200), narudzba(2, 'sargarepa', 9, 700, 70)],
      }),
    })
    expect(h.q('#nivoVeo.otvoren')).toBeNull() // ni poklon ni dobrodošlica
    h.klik('nav [data-tab="narudzbe"]')
    h.klik('[data-isporuci="1"]')

    // Sve je već primenjeno, pre ijednog OK: nivo, bonusi (50 + 25 + 80 + 120 + 160) i HUD.
    expect(h.stanje().novac).toBe(435)
    expect(h.igra().prosliNivo).toBe(4)
    expect(h.q('#nivoBr')?.textContent).toBe('4')
    expect(h.q('#novac')?.textContent).toBe('435')
    // Zvuci redom: tap (tab), pa po jedan 'nivo' za svaki nivo; 'novac' tek posle 480 ms.
    expect(h.zvuci).toEqual(['tap', 'nivo', 'nivo', 'nivo'])
    h.pauza(480)
    expect(h.zvuci).toEqual(['tap', 'nivo', 'nivo', 'nivo', 'novac'])
    expect(h.vibracije.filter((v) => Array.isArray(v) && v.join() === '30,40,60')).toHaveLength(3)
    // Toast zahvalnice ide posle svih level-up-ova (ispod vela).
    expect(h.q('#toast')?.textContent).toBe('Baka Mira ti zahvaljuje! +25 din')

    expect(procitajKartice(h)).toEqual([
      '⭐Nivo 2!Nagrada: +80 dinOtključano:PaprikaMlinSuper!',
      '⭐Nivo 3!Nagrada: +120 dinOtključano:BundevaKazan za ajvarKokošinjacSuper!',
      '⭐Nivo 4!Nagrada: +160 dinOtključano:GrožđeSuper!',
    ])
    expect(h.q('#nivoVeo.otvoren')).toBeNull()
    expect(h.stanje().novac).toBe(435) // OK ne dodaje ništa
  })

  it('xp 400 → +1135: kartice Nivo 5 (Štala), 6 (Aukcija uskoro), 7 (bez „Otključano")', async () => {
    const h = await mountApp({
      sejv: stanje({
        xp: 400,
        mag: { ...MAG0, psenica: 1 },
        narudzbe: [narudzba(1, 'psenica', 1, 25, 1135), narudzba(2, 'sargarepa', 9, 700, 70)],
      }),
    })
    h.klik('nav [data-tab="narudzbe"]')
    h.klik('[data-isporuci="1"]')
    expect(h.stanje().novac).toBe(50 + 25 + 200 + 240 + 280)
    expect(procitajKartice(h)).toEqual([
      '⭐Nivo 5!Nagrada: +200 dinOtključano:ŠtalaSuper!',
      '⭐Nivo 6!Nagrada: +240 dinOtključano:Aukcija uskoroSuper!',
      '⭐Nivo 7!Nagrada: +280 dinSuper!',
    ])
  })

  it('OK na kartici nivoa pokreće crtajSve PRE sledeće kartice (radnja već nudi mlin posle „Nivo 2")', async () => {
    const h = await mountApp({
      sejv: stanje({
        mag: { ...MAG0, psenica: 1 },
        narudzbe: [narudzba(1, 'psenica', 1, 25, 200), narudzba(2, 'sargarepa', 9, 700, 70)],
      }),
    })
    h.klik('nav [data-tab="narudzbe"]')
    // Pre isporuke radnja je nacrtana na nivou 1: mlin je zaključan.
    expect(h.q('#radnjaKuca')?.innerHTML).toContain('<h3>Mlin 🔒</h3>')
    h.klik('[data-isporuci="1"]')
    // Isporuka ne crta radnju; tek OK (crtajSve) je osvežava.
    expect(h.q('#radnjaKuca')?.innerHTML).toContain('<h3>Mlin 🔒</h3>')
    h.pauza(350)
    h.klik('#nivoOk')
    expect(h.q('#nivoKartica h3')?.textContent).toBe('Nivo 3!')
    expect(h.q('[data-kupi="mlin"]')).not.toBeNull()
  })
})
