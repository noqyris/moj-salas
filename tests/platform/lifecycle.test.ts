// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createLifecycle } from '../../src/platform/lifecycle'

let skriven = false
Object.defineProperty(document, 'hidden', { configurable: true, get: () => skriven })

afterEach(() => {
  skriven = false
})

const vidljivost = () => document.dispatchEvent(new Event('visibilitychange'))
const pagehide = () => window.dispatchEvent(new Event('pagehide'))

describe('lifecycle.onHidden (D13)', () => {
  it('visibilitychange zove cb samo kad je dokument SKRIVEN (povratak na vidljivo — ne)', () => {
    let n = 0
    createLifecycle().onHidden(() => n++)
    vidljivost()
    expect(n).toBe(0)
    skriven = true
    vidljivost()
    expect(n).toBe(1)
  })

  it('pagehide zove cb (i kad visibilitychange ne stigne)', () => {
    let n = 0
    createLifecycle().onHidden(() => n++)
    pagehide()
    expect(n).toBe(1)
  })

  it('pri odlasku sa stranice mogu stići oba događaja — cb se zove za svaki', () => {
    let n = 0
    createLifecycle().onHidden(() => n++)
    skriven = true
    vidljivost()
    pagehide()
    expect(n).toBe(2)
  })

  it('odjava uklanja oba slušača; druge pretplate ostaju', () => {
    let a = 0
    let b = 0
    const lc = createLifecycle()
    const odjavaA = lc.onHidden(() => a++)
    lc.onHidden(() => b++)
    odjavaA()
    skriven = true
    vidljivost()
    pagehide()
    expect(a).toBe(0)
    expect(b).toBe(2)
  })

  it('radi i nad ubrizganim okruženjem (Capacitor/testovi)', () => {
    const dokument = Object.assign(new EventTarget(), { hidden: true })
    const prozor = new EventTarget()
    let n = 0
    const odjava = createLifecycle(() => ({ dokument, prozor })).onHidden(() => n++)
    dokument.dispatchEvent(new Event('visibilitychange'))
    prozor.dispatchEvent(new Event('pagehide'))
    expect(n).toBe(2)
    odjava()
    prozor.dispatchEvent(new Event('pagehide'))
    expect(n).toBe(2)
    // Slušači nisu kačeni na pravi document/window.
    pagehide()
    expect(n).toBe(2)
  })
})
