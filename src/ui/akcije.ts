/*
 * Akcije igrača (04 §4.1, 03 §3 i §12 „UI controller contract"). Svaki handler:
 *   1. pozove core sa JEDNIM `now`;
 *   2. izvrši vraćene događaje REDOM (zvuk → vibracija → toast → FX → level-up kartice);
 *   3. ako je akcija prošla, pozove TAČNO renderere iz 03 §3.17 (žetva jedne parcele: tek posle
 *      UBERI_CRTANJE_ODLAGANJE_MS, preko setTimeout-a — referenca-sim ga izvršava odmah);
 *   4. sačuva prema `Rezultat.cuvaj`.
 * Odbijena akcija (`ok: false`) izvrši svoje događaje (npr. zvuk greške + poruka), ali ne crta i ne čuva.
 *
 * FX sidra: kliknuti element (meri se PRE ponovnog crtanja koje ga odvaja), osim gde prototip meri
 * nešto drugo (`#uberiSveKuca`, kartica mašine u ticku).
 */
import { UBERI_CRTANJE_ODLAGANJE_MS, VIBRACIJA } from '../config'
import {
  isporuci,
  kupiParcelu,
  kupiZgradu,
  odbij,
  pokreniMasinu,
  pokupi,
  posadi,
  prodaj,
  uberi,
  uberiSve,
  zalij,
  type Dogadjaj,
  type Rezultat,
  type Sidro,
} from '../core'
import { porukaTekst } from '../i18n'
import type { Akcije, UiRef } from './kontekst'
import { nivoHtml } from './overlayi'

/** Element sidra kad handler nema kliknuti element (tick, „Uberi sve"). */
function nadjiSidro(doc: Document, s: Sidro): HTMLElement | null {
  switch (s.vrsta) {
    case 'parcela':
      return doc.querySelector<HTMLElement>('.parcela[data-i="' + s.i + '"]')
    case 'uberiSve':
      return doc.querySelector<HTMLElement>('#uberiSveKuca')
    case 'prodaja':
      return doc.querySelector<HTMLElement>('[data-prodaj="' + s.artikal + '"]')
    case 'narudzba':
      return doc.querySelector<HTMLElement>('[data-isporuci="' + s.id + '"]')
    case 'masina':
      return doc.querySelector<HTMLElement>('[data-masina="' + s.id + '"]')
    case 'zivotinja':
      return doc.querySelector<HTMLElement>('[data-pokupi="' + s.id + '"]')
  }
}

export function napraviAkcije(ui: UiRef): Akcije {
  function izvrsi(dogadjaji: readonly Dogadjaj[], el: HTMLElement | null = null): void {
    const u = ui()
    const sidro = (s: Sidro): HTMLElement | null => el ?? nadjiSidro(u.doc, s)
    for (const d of dogadjaji) {
      switch (d.tip) {
        case 'zvuk':
          u.zvuk(d.id)
          break
        case 'vibracija':
          u.vibro(d.obrazac)
          break
        case 'poruka': {
          const tekst = porukaTekst(d.poruka)
          if (d.odlozenoMs === undefined) u.toast(tekst)
          else u.p.timers.setTimeout(() => u.toast(tekst), d.odlozenoMs)
          break
        }
        case 'novcici':
          u.fx.letiNovcic(sidro(d.sidro), d.broj)
          break
        case 'xp': {
          // Prototip `dodajXp`: plusXp samo ako sidro postoji, pa HUD nivo (već konačan).
          const a = sidro(d.sidro)
          if (a) u.fx.plusXp(a, d.iznos)
          u.crtaj.nivo()
          break
        }
        case 'nivo':
          // Prototip `prikaziNivo` (bonus je već u novcu): kartica u red (OK → crtajSve) → zvuk →
          // vibracija → konfete → novac broji odmah, pre potvrde.
          u.red.uRed(nivoHtml(d.nivo, d.bonus, d.otkljucano), () => u.crtaj.sve())
          u.zvuk('nivo')
          u.vibro(VIBRACIJA.nivo)
          u.fx.konfete()
          u.crtaj.novac()
          break
        case 'kapi': {
          const a = sidro({ vrsta: 'parcela', i: d.i })
          if (a) {
            u.fx.kapFx(a)
            a.querySelector('.zalij')?.remove()
          }
          break
        }
      }
    }
  }

  function sacuvajPo(c: Rezultat['cuvaj']): void {
    if (c === 'odlozeno') ui().sacuvaj(false)
    else if (c === 'odmah') ui().sacuvaj(true)
  }

  /** Događaji → (ako je prošlo) crtanje → čuvanje. Vraća `r.ok`. */
  function primeni(r: Rezultat, el: HTMLElement | null, crtaj: () => void): boolean {
    izvrsi(r.dogadjaji, el)
    if (!r.ok) return false
    crtaj()
    sacuvajPo(r.cuvaj)
    return true
  }

  const sad = (): number => ui().p.clock.now()

  return {
    izvrsi,
    sacuvajPo,

    posadi(k) {
      const u = ui()
      primeni(posadi(u.igra(), u.list.izabrana(), k, sad()), null, () => {
        u.list.zatvori()
        u.crtaj.novac()
        u.crtaj.njive()
      })
    },

    zalij(i, el) {
      const u = ui()
      // Bez crtanja: traku, odbrojavanje i fazu sustiže sledeći tick (ikonica kapi se skida u 'kapi').
      primeni(zalij(u.igra(), i, sad()), el, () => {})
    },

    uberi(i, el) {
      const u = ui()
      primeni(uberi(u.igra(), i, sad()), el, () => {
        // Tajmer se zakazuje PRE čuvanja (prototip L1006–1007); crtanje čita sat kad se izvrši.
        u.p.timers.setTimeout(() => {
          u.crtaj.njive()
          u.crtaj.tezga()
          u.crtaj.zgrade()
          u.crtaj.narudzbe()
        }, UBERI_CRTANJE_ODLAGANJE_MS)
      })
    },

    uberiSve() {
      const u = ui()
      const ok = primeni(uberiSve(u.igra(), sad()), null, () => {
        u.crtaj.njive()
        u.crtaj.tezga()
        u.crtaj.zgrade()
        u.crtaj.narudzbe()
      })
      if (ok) u.zak.zakljucaj('#njive')
    },

    prodaj(k, el) {
      const u = ui()
      const ok = primeni(prodaj(u.igra(), k, sad()), el, () => {
        u.crtaj.novac()
        u.crtaj.tezga()
        u.crtaj.narudzbe()
        u.crtaj.zgrade()
      })
      if (ok) u.zak.zakljucaj('#tezga')
    },

    isporuci(id, el) {
      const u = ui()
      const ok = primeni(isporuci(u.igra(), id, sad(), u.p.random), el, () => {
        u.crtaj.novac()
        u.crtaj.narudzbe()
        u.crtaj.tezga()
        u.crtaj.zgrade()
      })
      if (ok) u.zak.zakljucaj('#narudzbeKuca')
    },

    odbij(id) {
      const u = ui()
      const ok = primeni(odbij(u.igra(), id, u.p.random), null, () => u.crtaj.narudzbe())
      if (ok) u.zak.zakljucaj('#narudzbeKuca')
    },

    kupiParcelu() {
      const u = ui()
      primeni(kupiParcelu(u.igra(), sad()), null, () => {
        u.crtaj.novac()
        u.crtaj.njive()
      })
    },

    kupiZgradu(id) {
      const u = ui()
      primeni(kupiZgradu(u.igra(), id, sad()), null, () => u.crtaj.sve())
    },

    pokreniMasinu(id) {
      const u = ui()
      primeni(pokreniMasinu(u.igra(), id, sad()), null, () => {
        u.crtaj.zgrade()
        u.crtaj.tezga()
        u.crtaj.narudzbe()
      })
    },

    pokupi(id, el) {
      const u = ui()
      primeni(pokupi(u.igra(), id, sad()), el, () => {
        u.crtaj.zgrade()
        u.crtaj.tezga()
        u.crtaj.narudzbe()
      })
    },
  }
}
