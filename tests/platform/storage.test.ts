import { describe, expect, it } from 'vitest'
import { KLJUC_SEJVA } from '../../src/config'
import {
  MemoryStorage,
  PROBA_KLJUC,
  createStorage,
  hostStorage,
  jeHostSkladiste,
  localStorageAdapter,
  type HostSkladiste,
  type StorageOkruzenje,
} from '../../src/platform/storage'

/** Web Storage u memoriji sa ubrizganim kvarovima. */
class LazniStorage {
  readonly podaci = new Map<string, string>()
  readonly log: string[] = []
  bacaNaGet: Error | null = null
  bacaNaSet: Error | null = null
  get length() {
    return this.podaci.size
  }
  clear() {
    this.podaci.clear()
  }
  key(i: number) {
    return [...this.podaci.keys()][i] ?? null
  }
  getItem(k: string) {
    this.log.push('get:' + k)
    if (this.bacaNaGet) throw this.bacaNaGet
    return this.podaci.get(k) ?? null
  }
  setItem(k: string, v: string) {
    this.log.push('set:' + k)
    if (this.bacaNaSet) throw this.bacaNaSet
    this.podaci.set(k, String(v))
  }
  removeItem(k: string) {
    this.log.push('remove:' + k)
    this.podaci.delete(k)
  }
  kao(): Storage {
    return this as unknown as Storage
  }
}

const securityError = () => new DOMException('The operation is insecure.', 'SecurityError')
const quotaError = () => new DOMException('Quota exceeded', 'QuotaExceededError')

/** Host kao u prototipovom okruženju (referenca-sim L42–46): get odbija za nepostojeći ključ. */
function lazniHost(pocetno: Record<string, string> = {}) {
  const mem: Record<string, string> = { ...pocetno }
  const pozivi: string[] = []
  const host: HostSkladiste = {
    async get(k) {
      pozivi.push('get:' + k)
      if (!(k in mem)) throw new Error('nema kljuca')
      return { key: k, value: mem[k] }
    },
    async set(k, v) {
      pozivi.push('set:' + k)
      mem[k] = v
      return { key: k, value: v }
    },
  }
  return { host, mem, pozivi }
}

describe('createStorage — izbor adaptera', () => {
  it('host window.storage ima prednost čak i kad localStorage radi (kontinuitet sa prototipom)', async () => {
    const { host, mem } = lazniHost({ [KLJUC_SEJVA]: '{"v":3}' })
    const ls = new LazniStorage()
    const s = createStorage({ storage: host, localStorage: ls.kao() })
    expect(s).not.toBeNull()
    expect(await s?.get(KLJUC_SEJVA)).toBe('{"v":3}')
    await s?.set(KLJUC_SEJVA, 'novo')
    expect(mem[KLJUC_SEJVA]).toBe('novo')
    // localStorage nije ni dodirnut (ni proba).
    expect(ls.log).toEqual([])
  })

  it('host se prepoznaje po `get` funkciji, kao prototip (L546)', () => {
    expect(jeHostSkladiste({ get: () => Promise.resolve(null) })).toBe(true)
    expect(jeHostSkladiste({ get: 'x', set: () => {} })).toBe(false)
    expect(jeHostSkladiste(null)).toBe(false)
    expect(jeHostSkladiste(undefined)).toBe(false)
    expect(jeHostSkladiste(() => {})).toBe(false)
  })

  it('bez hosta: localStorage posle uspešne probe; proba ne ostavlja trag i ne dira ključ sejva', async () => {
    const ls = new LazniStorage()
    ls.podaci.set(KLJUC_SEJVA, 'sejv')
    const s = createStorage({ storage: { get: 'nije funkcija' }, localStorage: ls.kao() })
    expect(ls.log).toEqual(['set:' + PROBA_KLJUC, 'remove:' + PROBA_KLJUC])
    expect([...ls.podaci.keys()]).toEqual([KLJUC_SEJVA])
    expect(await s?.get(KLJUC_SEJVA)).toBe('sejv')
  })

  it('proba baca SecurityError (privatni režim) → null, sesija bez čuvanja', () => {
    const ls = new LazniStorage()
    ls.bacaNaSet = securityError()
    expect(createStorage({ localStorage: ls.kao() })).toBeNull()
  })

  it('proba baca QuotaExceededError (Safari privatni režim, kvota 0) → null', () => {
    const ls = new LazniStorage()
    ls.bacaNaSet = quotaError()
    expect(createStorage({ localStorage: ls.kao() })).toBeNull()
  })

  it('i sam pristup `localStorage` može da baci (kolačići blokirani) → null', () => {
    const okr: StorageOkruzenje = {
      get localStorage(): Storage {
        throw securityError()
      },
    }
    expect(createStorage(okr)).toBeNull()
  })

  it('pristup `storage` koji baca ne obara izbor — pada se na localStorage', async () => {
    const ls = new LazniStorage()
    const okr: StorageOkruzenje = {
      get storage(): unknown {
        throw new Error('host pukao')
      },
      localStorage: ls.kao(),
    }
    const s = createStorage(okr)
    await s?.set('k', 'v')
    expect(ls.podaci.get('k')).toBe('v')
  })

  it('ni hosta ni localStorage-a → null', () => {
    expect(createStorage({})).toBeNull()
    expect(createStorage({ localStorage: null })).toBeNull()
  })

  it('u Node-u bez argumenata (nema window.storage ni localStorage) → null, bez bacanja', () => {
    expect(createStorage()).toBeNull()
  })
})

describe('hostStorage (01 §e.3)', () => {
  it('get: {value} → string; nepostojeći ključ (host odbija) → null', async () => {
    const { host } = lazniHost({ a: 'x' })
    const s = hostStorage(host)
    expect(await s.get('a')).toBe('x')
    expect(await s.get('nema')).toBeNull()
  })

  it('get: null rezultat ili rezultat bez value → null; prazan string ostaje prazan string', async () => {
    const odgovori: unknown[] = [null, undefined, {}, { value: null }, { value: '' }, 'goli string']
    const host: HostSkladiste = {
      get: async () => odgovori.shift(),
      set: async () => undefined,
    }
    const s = hostStorage(host)
    const dobijeno: (string | null)[] = []
    for (let i = 0; i < 6; i++) dobijeno.push(await s.get('k'))
    expect(dobijeno).toEqual([null, null, null, null, '', null])
  })

  it('get: vrednost koja nije string postaje string (dekoder je proglašava neispravnom → rezerva)', async () => {
    const s = hostStorage({ get: async () => ({ value: 5 }), set: async () => undefined })
    expect(await s.get('k')).toBe('5')
  })

  it('get: svako odbijanje hosta je „nema ključa" (host ih ne razlikuje) — nikad ne baca', async () => {
    const s = hostStorage({
      get: () => Promise.reject(new Error('IPC pukao')),
      set: async () => undefined,
    })
    await expect(s.get('k')).resolves.toBeNull()
    const sinhrono = hostStorage({
      get: () => {
        throw new Error('sinhrono')
      },
      set: async () => undefined,
    })
    await expect(sinhrono.get('k')).resolves.toBeNull()
  })

  it('set: host.set se poziva SINHRONO u pozivu (pre prvog await-a); odbijanje se prosleđuje', async () => {
    const { host, pozivi } = lazniHost()
    const s = hostStorage(host)
    const obecanje = s.set('k', 'v')
    expect(pozivi).toEqual(['set:k'])
    await obecanje
    const pukne = hostStorage({
      get: async () => null,
      set: () => Promise.reject(new Error('pun disk')),
    })
    await expect(pukne.set('k', 'v')).rejects.toThrow('pun disk')
  })
})

describe('localStorageAdapter', () => {
  it('get: getItem ili null; set upisuje SINHRONO (zapis iz pagehide stiže pre zamrzavanja)', async () => {
    const ls = new LazniStorage()
    const s = localStorageAdapter(ls.kao())
    expect(await s.get(KLJUC_SEJVA)).toBeNull()
    const obecanje = s.set(KLJUC_SEJVA, '{"v":3}')
    expect(ls.podaci.get(KLJUC_SEJVA)).toBe('{"v":3}')
    await expect(obecanje).resolves.toBeUndefined()
    expect(await s.get(KLJUC_SEJVA)).toBe('{"v":3}')
  })

  it('getItem baca → get ODBIJA (kvar skladišta ≠ nema sejva, D9)', async () => {
    const ls = new LazniStorage()
    ls.bacaNaGet = securityError()
    await expect(localStorageAdapter(ls.kao()).get('k')).rejects.toThrow('insecure')
  })

  it('setItem baca (kvota) → set odbija umesto da baci sinhrono; ništa nije upisano', async () => {
    const ls = new LazniStorage()
    ls.bacaNaSet = quotaError()
    const s = localStorageAdapter(ls.kao())
    let obecanje: Promise<void> | undefined
    expect(() => {
      obecanje = s.set('k', 'v')
    }).not.toThrow()
    await expect(obecanje).rejects.toThrow('Quota')
    expect(ls.podaci.has('k')).toBe(false)
  })
})

describe('MemoryStorage (za testove)', () => {
  it('nepostojeći ključ → null; početni sadržaj; upis/čitanje; log upisa', async () => {
    const m = new MemoryStorage({ [KLJUC_SEJVA]: 'staro' })
    expect(await m.get('nema')).toBeNull()
    expect(await m.get(KLJUC_SEJVA)).toBe('staro')
    await m.set(KLJUC_SEJVA, 'novo')
    expect(await m.get(KLJUC_SEJVA)).toBe('novo')
    expect(m.upisi).toEqual([{ kljuc: KLJUC_SEJVA, vrednost: 'novo' }])
    expect([m.getPozivi, m.setPozivi]).toEqual([3, 1])
  })

  it('set upisuje sinhrono u pozivu', () => {
    const m = new MemoryStorage()
    void m.set('k', 'v')
    expect(m.podaci.get('k')).toBe('v')
  })

  it('odbijGet: get odbija (kvar), a ne vraća null', async () => {
    const m = new MemoryStorage({ k: 'v' })
    m.odbijGet = true
    await expect(m.get('k')).rejects.toThrow('get odbijen')
  })

  it('odbijSet: set odbija i ništa ne upisuje; posle isključivanja radi', async () => {
    const m = new MemoryStorage()
    m.odbijSet = true
    await expect(m.set('k', 'v')).rejects.toThrow('set odbijen')
    expect(m.podaci.has('k')).toBe(false)
    expect(m.upisi).toEqual([])
    m.odbijSet = false
    await m.set('k', 'v')
    expect(m.podaci.get('k')).toBe('v')
  })

  it('zadrziGet: get čeka pustiGet(); vrednost se čita u trenutku puštanja', async () => {
    const m = new MemoryStorage({ k: 'pre' })
    m.zadrziGet = true
    let rezultat: string | null | undefined
    const p = m.get('k').then((v) => {
      rezultat = v
    })
    await Promise.resolve()
    await Promise.resolve()
    expect(rezultat).toBeUndefined()
    await m.set('k', 'posle')
    m.pustiGet()
    await p
    expect(rezultat).toBe('posle')
  })

  it('zadrziGet + odbijGet: pušteni get odbija', async () => {
    const m = new MemoryStorage()
    m.zadrziGet = true
    m.odbijGet = true
    const p = m.get('k')
    m.pustiGet()
    await expect(p).rejects.toThrow('get odbijen')
  })

  it('instance ne dele podatke', async () => {
    const a = new MemoryStorage()
    const b = new MemoryStorage()
    await a.set('k', 'v')
    expect(await b.get('k')).toBeNull()
  })
})
