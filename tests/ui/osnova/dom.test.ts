// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { $, $$ } from '../../../src/ui/dom'

beforeEach(() => {
  document.body.innerHTML =
    '<div id="a"><span class="x" id="x1"></span><span class="x" id="x2"></span></div>' +
    '<div id="b"><span class="x" id="x3"></span></div>'
})

describe('$', () => {
  it('vraća prvi element za selektor', () => {
    expect($(document, '.x').id).toBe('x1')
    expect($(document, '#b .x').id).toBe('x3')
  })

  it('traži samo unutar zadatog korena', () => {
    expect($($(document, '#b'), '.x').id).toBe('x3')
  })

  it('baca, sa selektorom u poruci, kad element ne postoji', () => {
    expect(() => $(document, '#nema')).toThrow('#nema')
    // Postoji u dokumentu, ali ne u korenu #b.
    expect(() => $($(document, '#b'), '#x1')).toThrow('#x1')
  })
})

describe('$$', () => {
  it('pravi niz svih elemenata redosledom u dokumentu', () => {
    const svi = $$(document, '.x')
    expect(Array.isArray(svi)).toBe(true)
    expect(svi.map((e) => e.id)).toEqual(['x1', 'x2', 'x3'])
  })

  it('prazan niz kad nema poklapanja; poštuje koren', () => {
    expect($$(document, '.nema')).toEqual([])
    expect($$($(document, '#a'), '.x').map((e) => e.id)).toEqual(['x1', 'x2'])
  })

  it('niz je snimak: kasnije promene DOM-a ga ne menjaju', () => {
    const svi = $$(document, '.x')
    $(document, '#b').innerHTML = ''
    expect(svi).toHaveLength(3)
  })
})
