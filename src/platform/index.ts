/*
 * Prava platforma za browser (main.ts). Testovi i Capacitor (Faza 3) prave svoju `Platforma`
 * od istih portova.
 */
import { createAudio } from './audio'
import { createClock } from './clock'
import { createDialog } from './dialog'
import { createHaptics } from './haptics'
import { createLifecycle } from './lifecycle'
import { createStorage } from './storage'
import { createTimers } from './timers'
import type { Platforma } from './tipovi'

export type * from './tipovi'
export * from './audio'
export * from './clock'
export * from './dialog'
export * from './haptics'
export * from './lifecycle'
export * from './storage'
export * from './timers'

export function napraviPlatformu(): Platforma {
  return {
    storage: createStorage(),
    clock: createClock(),
    timers: createTimers(),
    audio: createAudio(),
    haptics: createHaptics(),
    dialog: createDialog(),
    lifecycle: createLifecycle(),
    // Math.random se čita u trenutku poziva. Igra i efekti su odvojeni tokovi (vidi tipovi.ts).
    random: () => Math.random(),
    fxRandom: () => Math.random(),
  }
}
