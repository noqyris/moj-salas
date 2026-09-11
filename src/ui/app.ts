/*
 * UI aplikacija (04 §7): povezuje core, platformu i DOM. Sve zavisnosti idu preko `p` i razrešavaju se
 * u trenutku poziva (testovi ubrizgavaju lažnjake). Jedan `createApp` = jedna nezavisna instanca.
 *
 * Tajmeri: tačno JEDAN `setInterval(tik, TIK_MS)`, pokrenut tek na kraju boot-a; sve ostalo je
 * `setTimeout`. `#novac` se piše iz rAF okvira (hud.ts).
 *
 * Boot (ugovor §6, D9 — 03 §10): pre = now → učitavanje (SaveController) → sesija → dopuna narudžbina →
 * rezime odsustva → crtajSve → „Dobro došao nazad" ili toast „Dobro došao na farmu" → dnevni poklon →
 * kontroler.spreman() → prvo čuvanje → tick i unos. Ništa se ne piše pre kraja učitavanja; ako skladište
 * zakaže ili je sejv iz novije verzije, sesija je readOnly i igrač to vidi u toastu.
 */
import { TIK_MS } from '../config'
import {
  SaveController,
  igraIzStanja,
  nivoIzXp,
  novaIgra,
  osigurajNarudzbe,
  pocetnoStanje,
  prebaciZvuk,
  prikaziDobrodoslicu,
  rezimeOdsustva,
  tikMasina,
  uzmiDnevniPoklon,
  type Igra,
  type ZvukId,
} from '../core'
import { t } from '../i18n'
import type { Clock, Platforma, Timers } from '../platform/tipovi'
import { napraviAkcije } from './akcije'
import { $ } from './dom'
import { napraviFx } from './fx'
import { napraviHud } from './hud'
import type { Crtanje, Ui } from './kontekst'
import { napraviList } from './list'
import { napraviNarudzbe } from './narudzbe'
import { osveziTacke, veziNav } from './nav'
import { napraviNjive } from './njive'
import { napraviOverlayRed } from './overlay'
import { dobrodoslicaHtml, poklonHtml } from './overlayi'
import { napraviRadnju } from './radnja'
import { montirajLeptire } from './scena'
import { napraviTezgu } from './tezga'
import { napraviToast } from './toast'
import { napraviZakljucavanje } from './zakljucavanje'
import { napraviZgrade } from './zgrade'

export interface App {
  /** Učitava sejv, crta sve, prikazuje kartice povratka/poklona, pa pokreće tick i unos. */
  boot(): Promise<void>
  /** Tekuća igra (posle reseta nov objekat). */
  igra(): Igra
  crtajSve(): void
  /** Jedan otkucaj (isto što radi interval). */
  tik(): void
  /** Zaustavlja tick, odjavljuje lifecycle i otkazuje odloženo čuvanje. */
  ugasi(): void
}

export function createApp(root: Document, p: Platforma): App {
  // Pre boot-a: prazna igra kao prototipov `S = POCETNO()` (tick i unos još ne rade).
  let igra: Igra = igraIzStanja(pocetnoStanje(p.clock.now()))
  let kontroler: SaveController | null = null
  let interval: number | null = null
  let odjaviLifecycle: (() => void) | null = null
  let bootovan = false

  const tajmeri: Timers = {
    setTimeout: (cb, ms) => p.timers.setTimeout(cb, ms),
    clearTimeout: (id) => p.timers.clearTimeout(id),
    setInterval: (cb, ms) => p.timers.setInterval(cb, ms),
    clearInterval: (id) => p.timers.clearInterval(id),
    raf: (cb) => p.timers.raf(cb),
    cancelRaf: (id) => p.timers.cancelRaf(id),
  }
  const sat: Clock = {
    now: () => p.clock.now(),
    perfNow: () => p.clock.perfNow(),
    danas: (now) => p.clock.danas(now),
  }
  const zvuk = (id: ZvukId): void => {
    // `mute` u trenutku PUŠTANJA (i za odloženi 'novac'); AudioContext nastaje pri prvom zvuku.
    if (!igra.s.mute) p.audio.play(id)
  }
  const zak = napraviZakljucavanje(sat)
  const toast = napraviToast({ koren: root, tajmeri })
  const fx = napraviFx({ doc: root, tajmeri, fxRandom: () => p.fxRandom(), zvuk })
  const hud = napraviHud({ koren: root, sat, tajmeri })
  const red = napraviOverlayRed({ koren: root, zvuk, zakljucavanje: zak })

  const ref = (): Ui => ui
  const njive = napraviNjive(ref)
  const zgrade = napraviZgrade(ref)
  const narudzbe = napraviNarudzbe(ref)
  const tezga = napraviTezgu(ref)
  const radnja = napraviRadnju(ref)
  const list = napraviList(ref)
  const akcije = napraviAkcije(ref)

  /** Prototip `crtajSve` (L950), svi regioni bez obzira na aktivan tab; D14: otvoren list se gradi
   *  ponovo (npr. posle level-up OK, da novootključano seme odmah bude dostupno). */
  function crtajSve(): void {
    const now = p.clock.now()
    crtanje.novac()
    crtanje.nivo()
    njive.crtaj(now)
    zgrade.crtaj(now)
    narudzbe.crtaj(now)
    tezga.crtaj(now)
    radnja.crtaj(now)
    if (list.otvoren()) list.crtaj()
  }

  const crtanje: Crtanje = {
    novac: () => hud.crtajNovac(igra.s.novac),
    nivo: () => hud.crtajNivo(nivoIzXp(igra.s.xp)),
    njive: (now) => njive.crtaj(now),
    zgrade: (now) => zgrade.crtaj(now),
    narudzbe: (now) => narudzbe.crtaj(now),
    tezga: (now) => tezga.crtaj(now),
    radnja: (now) => radnja.crtaj(now),
    tacke: (now = p.clock.now()) => osveziTacke(ref, now),
    sve: crtajSve,
  }

  const ui: Ui = {
    doc: root,
    p,
    igra: () => igra,
    zvuk,
    vibro: (obrazac) => p.haptics.vibrate(obrazac),
    toast,
    fx,
    hud,
    red,
    zak,
    sacuvaj: (odmah = false) => kontroler?.sacuvaj(odmah),
    crtaj: crtanje,
    list,
    akcije,
  }

  /** Otkucaj (04 §2.12, 03 §4) — jedan `now` za sve korake. */
  function tik(): void {
    const now = p.clock.now()
    // 1–2: trake i odbrojavanja parcela u mestu; ponovno crtanje njiva kad se promeni potpis.
    njive.tik(now)
    // 3: mašine — završene ture (redom mlin, kazan), pa odbrojavanje onih koje i dalje rade.
    const r = tikMasina(igra, now)
    akcije.izvrsi(r.dogadjaji)
    akcije.sacuvajPo(r.cuvaj)
    zgrade.tikMasine(now)
    // 4: životinje u mestu (0 → 1 spremno nije strukturna promena).
    zgrade.tikZivotinje(now)
    // 5: posle završene ture ponovo se crtaju zgrade, tezga i narudžbine.
    if (r.strukturno) {
      zgrade.crtaj(now)
      tezga.crtaj(now)
      narudzbe.crtaj(now)
    }
    // 6–7: cene (+ D14 oznaka trenda) i tačkice.
    tezga.tikCene(now)
    osveziTacke(ref, now)
  }

  async function resetuj(): Promise<void> {
    let potvrdjeno = false
    try {
      potvrdjeno = await p.dialog.confirm(t.reset.potvrda)
    } catch {
      potvrdjeno = false
    }
    if (!potvrdjeno) return
    const staro = igra.s
    // D6: nova igra zadržava podešavanje zvuka i dan već uzetog poklona.
    igra = novaIgra(p.clock.now(), p.random, { mute: staro.mute, poklonDan: staro.poklonDan })
    list.ponisti()
    list.zatvori()
    kontroler?.sacuvaj(true)
    crtajSve()
    toast(t.toast.novaIgra)
  }

  /** Statički kontroli i lifecycle — tek posle učitavanja (04 B4: ništa ne sme da pregazi sejv). */
  function veziUnos(): void {
    veziNav(ref)
    $(root, '#veo').onclick = zak.cuvaj('#veo', () => list.zatvori())
    $(root, '#zvukDugme').onclick = () => {
      // Prototip L1158–1161: prebaci, natpis, čuvanje, pa „tap" samo ako je zvuk sada uključen.
      const r = prebaciZvuk(igra)
      crtanje.radnja()
      akcije.sacuvajPo(r.cuvaj)
      akcije.izvrsi(r.dogadjaji)
    }
    $(root, '#resetDugme').onclick = () => {
      void resetuj()
    }
    odjaviLifecycle = p.lifecycle.onHidden(() => kontroler?.sacuvaj(true))
  }

  async function boot(): Promise<void> {
    if (bootovan) return
    bootovan = true
    montirajLeptire(root)
    const pre = p.clock.now()
    const k = new SaveController({
      skladiste: p.storage,
      now: () => p.clock.now(),
      rasporedjivac: tajmeri,
      stanje: () => igra.s,
    })
    kontroler = k
    const { dekodirano, greskaSkladista } = await k.ucitaj()
    igra = igraIzStanja(dekodirano.stanje)
    osigurajNarudzbe(igra, p.random)
    // Pročitano PRE bilo kakvog čuvanja (svako čuvanje prepisuje `videno`).
    const videnoPre = igra.s.videno || pre
    const rezime = rezimeOdsustva(igra.s, videnoPre, pre)
    crtajSve()
    if (prikaziDobrodoslicu(rezime)) red.uRed(dobrodoslicaHtml(rezime), null)
    else if (!igra.s.sadio) toast(t.toast.dobrodosao)
    // D9: readOnly sesija — poruka ide posle pozdrava da ga ne bi prekrio (toast: poslednji pobeđuje).
    if (greskaSkladista) toast(t.toast.ucitavanjeNeuspelo)
    else if (dekodirano.vrsta === 'buduci') toast(t.toast.sejvNovijeVerzije)
    const dar = uzmiDnevniPoklon(igra, p.clock.danas(pre))
    if (dar !== null) {
      // Novac je već u stanju; HUD ga sustiže tek na „Hvala!".
      red.uRed(poklonHtml(dar), () => {
        crtanje.novac()
        zvuk('novac')
      })
    }
    k.spreman()
    // Poklon se upisuje odmah (gašenje pre „Hvala!" ne gubi i ne duplira poklon).
    k.sacuvaj(dar !== null)
    interval = p.timers.setInterval(tik, TIK_MS)
    veziUnos()
  }

  function ugasi(): void {
    if (interval !== null) p.timers.clearInterval(interval)
    interval = null
    if (odjaviLifecycle) odjaviLifecycle()
    odjaviLifecycle = null
    kontroler?.ocisti()
  }

  return { boot, igra: () => igra, crtajSve, tik, ugasi }
}
