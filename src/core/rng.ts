import type { Rng } from './types'

/** Deterministički rng (mulberry32) za testove, fuzz i paritet sa prototipom. U igri se
 *  koristi `Math.random`, ubrizgan iz main.ts. */
export function mulberry32(seed: number): Rng {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
