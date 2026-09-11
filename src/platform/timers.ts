import type { Timers } from './tipovi'

/** Tajmeri browsera. Funkcije `window`-a se traže u trenutku poziva, ne pri pravljenju. */
export function createTimers(): Timers {
  return {
    setTimeout: (cb, ms) => window.setTimeout(cb, ms),
    clearTimeout: (id) => window.clearTimeout(id),
    setInterval: (cb, ms) => window.setInterval(cb, ms),
    clearInterval: (id) => window.clearInterval(id),
    raf: (cb) => window.requestAnimationFrame(cb),
    cancelRaf: (id) => window.cancelAnimationFrame(id),
  }
}
