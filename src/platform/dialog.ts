import type { DialogPort } from './tipovi'

/** Deo `window`-a koji dijalog koristi. */
export interface DijalogOkruzenje {
  confirm(poruka: string): boolean
}

/** `window.confirm` iza obećanja (Capacitor u Fazi 3 ima asinhroni dijalog). `confirm` se zove
 *  SINHRONO unutar poziva, dok traje korisnički gest. Ako baci, odgovor je „ne". */
export function createDialog(okruzenje: () => DijalogOkruzenje = () => window): DialogPort {
  return {
    confirm(poruka) {
      try {
        return Promise.resolve(okruzenje().confirm(poruka))
      } catch {
        return Promise.resolve(false)
      }
    },
  }
}
