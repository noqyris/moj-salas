/*
 * Red overlay kartica (prototip L686–699): nivo, dnevni poklon, dobrodošlica.
 * - FIFO; dok je `#nivoVeo.otvoren`, nove kartice samo čekaju u redu.
 * - `#nivoOk` → zvuk 'tap' → callback odbačene kartice → sledeća kartica (ili zatvaranje).
 * - `#nivoKartica` se ne pravi ponovo (menja se samo innerHTML), pa CSS `pop` ide samo pri
 *   otvaranju vela. Pozadina nema handler — jedini izlaz je `#nivoOk`.
 * - D15: svaka tek prikazana kartica ignoriše `#nivoOk` ZAKLJUCAVANJE_TAPA_MS, da brz drugi tap ne
 *   zatvori sledeću karticu nepročitanu.
 */
import type { ZvukId } from '../core/dogadjaji'
import { $ } from './dom'
import type { Zakljucavanje } from './zakljucavanje'

export interface OverlayZavisnosti {
  koren: ParentNode
  /** UI-jev zvuk (on proverava `mute` u trenutku puštanja). */
  zvuk: (id: ZvukId) => void
  zakljucavanje: Pick<Zakljucavanje, 'zakljucaj' | 'zakljucano'>
}

export interface OverlayRed {
  /** Dodaje karticu (HTML mora da sadrži `#nivoOk`); ako veo nije otvoren, odmah je prikazuje. */
  uRed(html: string, cb: (() => void) | null): void
  /** Prikazuje sledeću karticu iz reda, ili zatvara veo kad je red prazan. */
  sledeciOverlay(): void
  /** Broj kartica koje čekaju (bez prikazane). */
  uRedu(): number
}

interface Stavka {
  html: string
  cb: (() => void) | null
}

export function napraviOverlayRed({ koren, zvuk, zakljucavanje }: OverlayZavisnosti): OverlayRed {
  const red: Stavka[] = []

  function sledeciOverlay(): void {
    const x = red.shift()
    const veo = $(koren, '#nivoVeo')
    if (!x) {
      veo.classList.remove('otvoren')
      return
    }
    $(koren, '#nivoKartica').innerHTML = x.html
    veo.classList.add('otvoren')
    zakljucavanje.zakljucaj('#nivoOk')
    const ok = koren.querySelector<HTMLElement>('#nivoOk')
    if (ok)
      ok.onclick = () => {
        if (zakljucavanje.zakljucano('#nivoOk')) return
        zvuk('tap')
        if (x.cb) x.cb()
        sledeciOverlay()
      }
  }

  return {
    uRed(html, cb) {
      red.push({ html, cb })
      if (!$(koren, '#nivoVeo').classList.contains('otvoren')) sledeciOverlay()
    },
    sledeciOverlay,
    uRedu: () => red.length,
  }
}
