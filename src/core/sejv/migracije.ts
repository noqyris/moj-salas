/*
 * Lanac migracija sejva (01 §h.2). Svaki korak podiže `v` tačno za 1. Dekoder ga pokreće samo
 * za podržane verzije (NAJSTARIJA_VERZIJA_SEJVA..VERZIJA_SEJVA); nova verzija = novi korak ovde.
 */
import { VERZIJA_SEJVA } from '../../config'
import { ima, jeObjekat, popravka, type Obj } from './tipovi'

/** Jedan korak migracije. U `popravke` upisuje sve što odbaci (vidi `VrstaPopravke`). */
export type Migracija = (o: Obj, popravke?: string[]) => Obj

/**
 * v2 → v3, tačno semantika prototipa (L566): `masine.kazan.k = !!kazan`, `masine.kazan.t =
 * kazanT || 0` — vrednosti sa vrha pregaze eventualni `masine.kazan` iz sejva, a `mlin` iz
 * `masine` ostaje. Parcele dobijaju `z`, magacin nova polja i `ko` se spljošti tek u
 * `normalizujV3`, jer i v3 sejv koji prototip zapiše posle migracije nosi v2 narudžbine.
 *
 * ODSTUPANJE D11: `kazan`/`kazanT` se posle prenosa uklanjaju sa vrha (prototip ih čuva i
 * ponovo zapisuje zauvek, 06 bug 13). To je premeštanje, ne gubitak, pa nije popravka.
 */
export function v2uV3(o: Obj, popravke: string[] = []): Obj {
  const { kazan, kazanT, ...ostalo } = o
  const masine = jeObjekat(ostalo.masine) ? ostalo.masine : {}
  const stari = jeObjekat(masine.kazan) ? masine.kazan : {}
  const novi = { ...stari, k: !!kazan, t: kazanT || 0 }
  // v2 nije imao `masine`; ako ga ručno izmenjen sejv ipak ima, pregaženo se beleži.
  for (const f of ['k', 't'] as const) {
    if (ima(stari, f) && stari[f] !== novi[f]) {
      popravke.push(popravka(`masine.kazan.${f}`, 'zamenjeno'))
    }
  }
  if (ima(o, 'kazan') && typeof kazan !== 'boolean') {
    popravke.push(popravka('kazan', 'ispravljeno'))
  }
  return { ...ostalo, v: 3, masine: { ...masine, kazan: novi } }
}

export const MIGRACIJE: Readonly<Record<number, Migracija>> = { 2: v2uV3 }

/**
 * Pokreće korake dok `v` ne dostigne VERZIJA_SEJVA. Baca za verziju koja se ne može migrirati
 * (nije ceo broj, veća od tekuće, ili nema koraka) — dekoder to proverava pre poziva, pa za
 * njega ovo nikad ne baca.
 */
export function pokreniMigracije(
  o: Obj,
  popravke: string[] = [],
  migracije: Readonly<Record<number, Migracija>> = MIGRACIJE,
): Obj {
  let tekuci = o
  while (tekuci.v !== VERZIJA_SEJVA) {
    const v = tekuci.v
    if (typeof v !== 'number' || !Number.isInteger(v) || v > VERZIJA_SEJVA) {
      throw new Error(`sejv: verzija ${String(v)} ne može da se migrira`)
    }
    const korak = migracije[v]
    if (!korak) throw new Error(`sejv: nema migracije iz v${v}`)
    const sledeci = korak(tekuci, popravke)
    if (sledeci.v !== v + 1) throw new Error(`sejv: migracija iz v${v} mora da vrati v${v + 1}`)
    tekuci = sledeci
  }
  return tekuci
}
