import { describe, expect, it } from 'vitest'
import { createDialog } from '../../src/platform/dialog'

describe('dialog.confirm → Promise<boolean>', () => {
  it('prosleđuje poruku i razrešava odgovor; confirm se zove SINHRONO (dok traje gest)', async () => {
    const pozivi: string[] = []
    const d = createDialog(() => ({
      confirm: (m) => {
        pozivi.push(m)
        return true
      },
    }))
    const p = d.confirm('Sigurno? Sav napredak se briše.')
    expect(pozivi).toEqual(['Sigurno? Sav napredak se briše.'])
    await expect(p).resolves.toBe(true)
  })

  it('„Otkaži" → false', async () => {
    await expect(createDialog(() => ({ confirm: () => false })).confirm('x')).resolves.toBe(false)
  })

  it('confirm koji baca (npr. sandbox bez modala) → false, bez odbijanja', async () => {
    const d = createDialog(() => ({
      confirm: () => {
        throw new Error('modali zabranjeni')
      },
    }))
    await expect(d.confirm('x')).resolves.toBe(false)
  })

  it('okruženje se čita pri svakom pozivu', async () => {
    let odgovor = true
    const d = createDialog(() => ({ confirm: () => odgovor }))
    await expect(d.confirm('a')).resolves.toBe(true)
    odgovor = false
    await expect(d.confirm('b')).resolves.toBe(false)
  })
})
