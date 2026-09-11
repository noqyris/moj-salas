import type { LifecyclePort } from './tipovi'

/** Dokument i prozor kako ih lifecycle koristi (ubrizgavaju se u testovima). */
export interface ZivotniCiklusOkruzenje {
  readonly dokument: EventTarget & { readonly hidden: boolean }
  readonly prozor: EventTarget
}

/**
 * „Aplikacija odlazi u pozadinu" (D13): `visibilitychange` kad je `document.hidden` (kao prototip,
 * L577) i `pagehide` (mobilni browseri često ubiju stranicu bez visibilitychange). Pri odlasku sa
 * stranice mogu stići oba — dvostruki trenutni upis je bezopasan. Capacitor `pause` dolazi u Fazi 3.
 */
export function createLifecycle(
  okruzenje: () => ZivotniCiklusOkruzenje = () => ({ dokument: document, prozor: window }),
): LifecyclePort {
  return {
    onHidden(cb) {
      const { dokument, prozor } = okruzenje()
      const naVidljivost = () => {
        if (dokument.hidden) cb()
      }
      const naPagehide = () => cb()
      dokument.addEventListener('visibilitychange', naVidljivost)
      prozor.addEventListener('pagehide', naPagehide)
      return () => {
        dokument.removeEventListener('visibilitychange', naVidljivost)
        prozor.removeEventListener('pagehide', naPagehide)
      }
    },
  }
}
