/*
 * Kompaktan zapis tragova pariteta. Pun prototipov `S` po koraku je ~1,7 KB, a korak obično
 * promeni samo `videno` i par polja — zato red nosi strukturnu RAZLIKU u odnosu na prethodni `S`
 * (~130 B po redu), a prvi red pun `S`. Enkoder proverava da dekoder vraća tačno isti objekat.
 *
 * Razlika (`Zakrpa`) nad JSON vrednostima:
 *   - primitiv ili niz              → zamena celom vrednošću;
 *   - objekat nad objektom          → rekurzivno, samo promenjeni ključevi;
 *   - objekat nad nizom iste dužine → promenjeni indeksi (`{"3": …}`);
 *   - `{"$": v}`                    → zamena objektom v (novi/obrisani ključevi, promena tipa).
 */
import { isDeepStrictEqual } from 'node:util'
import type { Cuvanje } from '../../src/core/dogadjaji'
import type { Akcija } from './tragovi'

export type Json = null | boolean | number | string | Json[] | { [k: string]: Json }
type JsonObjekat = { [k: string]: Json }

const jeObjekat = (x: Json | undefined): x is JsonObjekat =>
  typeof x === 'object' && x !== null && !Array.isArray(x)

export function razlika(pre: Json, posle: Json): Json | undefined {
  if (isDeepStrictEqual(pre, posle)) return undefined
  if (jeObjekat(pre) && jeObjekat(posle)) {
    if (!Object.keys(pre).every((k) => k in posle)) return { $: posle }
    const out: JsonObjekat = {}
    for (const [k, v] of Object.entries(posle)) {
      const staro = pre[k]
      if (staro === undefined) out[k] = jeObjekat(v) ? { $: v } : v
      else {
        const d = razlika(staro, v)
        if (d !== undefined) out[k] = d
      }
    }
    return out
  }
  if (Array.isArray(pre) && Array.isArray(posle) && pre.length === posle.length) {
    const out: JsonObjekat = {}
    posle.forEach((v, i) => {
      const staro = pre[i]
      const d = staro === undefined ? v : razlika(staro, v)
      if (d !== undefined) out[String(i)] = d
    })
    return out
  }
  return jeObjekat(posle) ? { $: posle } : posle
}

export function primeni(pre: Json | undefined, z: Json): Json {
  if (jeObjekat(z)) {
    const keys = Object.keys(z)
    if (keys.length === 1 && keys[0] === '$') return kopija(z.$ ?? null)
    if (jeObjekat(pre)) {
      const out: JsonObjekat = { ...pre }
      for (const [k, v] of Object.entries(z)) out[k] = primeni(pre[k], v)
      return out
    }
    if (Array.isArray(pre)) {
      const out = [...pre]
      for (const [k, v] of Object.entries(z)) {
        const i = Number(k)
        if (!Number.isInteger(i) || i < 0 || i >= out.length) {
          throw new Error(`kodek: indeks ${k} van niza dužine ${out.length}`)
        }
        out[i] = primeni(out[i], v)
      }
      return out
    }
    throw new Error('kodek: objektna razlika nad vrednošću koja nije objekat ni niz')
  }
  return kopija(z)
}

const kopija = (x: Json): Json => JSON.parse(JSON.stringify(x)) as Json

// ── Trag ─────────────────────────────────────────────────────────────────────────

export const FORMAT_TRAGA = 'moj-salas/paritet-trag'
/** Menjaj kad se promeni drajver ili oblik reda — stari fajlovi tada padaju na proveri svežine. */
export const VERZIJA_TRAGA = 1

export interface Zaglavlje {
  format: typeof FORMAT_TRAGA
  verzija: number
  ime: string
  /** Seme tokova: narudžbine = mulberry32(seme), FX = seme ^ 0x9E3779B9, drajver = seme ^ 0xA5A5A5A5. */
  seme: number
  start: string
  /** Broj koraka posle boot-a (= redovi − 1). */
  koraka: number
  /** sha256 (16 hex) HTML-a orakla (prototip + ZAKRPE + instrumentacija) iz kog je trag nastao. */
  orakl: string
}

export interface Red {
  i: number
  a: Akcija
  /** Virtuelno vreme posle koraka, ms od T0. */
  now: number
  /** Prototipov `S` posle koraka (JSON.parse(JSON.stringify(S))). */
  S: Json
  brojacN: number
  prosliNivo: number
  /** Najjači režim čuvanja koji je korak tražio ('ne' = nijedan `sacuvaj`). */
  cuvaj: Cuvanje
}

export interface Trag {
  zaglavlje: Zaglavlje
  redovi: Red[]
}

interface RedZapis {
  i: number
  a: Akcija
  now: number
  S?: Json
  dS?: Json
  brojacN: number
  prosliNivo: number
  cuvaj: Cuvanje
}

export function kodirajTrag(t: Trag): string {
  const linije = [JSON.stringify({ trag: t.zaglavlje })]
  let pre: Json | undefined
  for (const r of t.redovi) {
    const z: RedZapis = {
      i: r.i,
      a: r.a,
      now: r.now,
      brojacN: r.brojacN,
      prosliNivo: r.prosliNivo,
      cuvaj: r.cuvaj,
    }
    if (pre === undefined) z.S = r.S
    else {
      const d = razlika(pre, r.S)
      if (d !== undefined) z.dS = d
      const nazad = d === undefined ? pre : primeni(pre, d)
      if (!isDeepStrictEqual(nazad, r.S)) throw new Error(`kodek: red ${r.i} se ne vraća isti`)
    }
    linije.push(JSON.stringify(z))
    pre = r.S
  }
  return linije.join('\n') + '\n'
}

export function dekodirajTrag(tekst: string): Trag {
  const linije = tekst.split('\n').filter((l) => l.length > 0)
  const glava = linije.shift()
  if (glava === undefined) throw new Error('kodek: prazan trag')
  const { trag: zaglavlje } = JSON.parse(glava) as { trag: Zaglavlje }
  if (zaglavlje.format !== FORMAT_TRAGA)
    throw new Error(`kodek: nepoznat format ${zaglavlje.format}`)
  const redovi: Red[] = []
  let pre: Json | undefined
  for (const l of linije) {
    const z = JSON.parse(l) as RedZapis
    let S: Json
    if (z.S !== undefined) S = z.S
    else if (pre === undefined) throw new Error(`kodek: red ${z.i} bez punog S na početku`)
    else S = z.dS === undefined ? pre : primeni(pre, z.dS)
    redovi.push({
      i: z.i,
      a: z.a,
      now: z.now,
      S,
      brojacN: z.brojacN,
      prosliNivo: z.prosliNivo,
      cuvaj: z.cuvaj,
    })
    pre = S
  }
  return { zaglavlje, redovi }
}
