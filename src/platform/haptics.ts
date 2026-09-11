import type { HapticsPort } from './tipovi'

/** Deo `navigator`-a koji vibracija koristi. */
export interface VibracijaNavigator {
  vibrate?: (obrazac: number | number[]) => boolean
}

function podrazumevaniNavigator(): VibracijaNavigator | undefined {
  return typeof navigator === 'undefined' ? undefined : navigator
}

/** `navigator.vibrate` sa proverom podrške i try/catch, kao prototip (L599). Nije vezano za
 *  `mute` (prototip vibrira i kad je zvuk isključen). iOS Safari nema `vibrate` → ništa. */
export function createHaptics(
  nav: () => VibracijaNavigator | undefined = podrazumevaniNavigator,
): HapticsPort {
  return {
    vibrate(obrazac) {
      try {
        const n = nav()
        if (n && typeof n.vibrate === 'function') {
          n.vibrate(typeof obrazac === 'number' ? obrazac : [...obrazac])
        }
      } catch {
        // Neki WebView-ovi bacaju bez korisničkog gesta — vibracija nije kritična.
      }
    },
  }
}
