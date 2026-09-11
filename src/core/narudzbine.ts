/*
 * Narudžbine (prototip L735–760, L1029–1040, L883–887).
 *
 * PARITET: `novaNarudzba` troši rng TAČNIM redom i brojem poziva iz prototipa (02 §5.4):
 *   1 (broj vrsta) → C (poređenja u sort-shuffle celog pool-a) → 1 (cilj) → 1 (mušterija) → 1 (poruka).
 * Shuffle je namerno `[...pool].sort(() => rng() - 0.5)` — pristrasan i zavisan od engine-a, ali
 * bit-identičan prototipu u V8 (DECISIONS: sort-shuffle ostaje 1:1). Ne menjati bez nove odluke.
 */
import {
  KULTURE,
  MASINE,
  MASINE_REDOSLED,
  MUSTERIJE,
  NARUDZBINA_AKTIVNIH,
  NARUDZBINA_JEDNA_VRSTA,
  NARUDZBINA_KOM_MAX,
  NARUDZBINA_KOM_MIN,
  NARUDZBINA_MAX_VREME_KULTURE,
  NARUDZBINA_MAX_VRSTA,
  NOVCICA_MAX,
  REDOSLED,
  VIBRACIJA,
  ZIV,
  ZIV_REDOSLED,
  baznaCena,
  ciljNarudzbine,
  nagradaDin,
  nagradaXp,
  type ArtikalId,
} from '../config'
import { ODBIJENO, type Igra, type Rezultat } from './dogadjaji'
import type { Narudzba, Rng, Stanje } from './types'
import { dodajXp, nivoIzXp } from './xp'

/** Element niza na indeksu koji je izračunat iz rng-a; rng van [0, 1) je greška pozivaoca. */
function izvuci<T>(niz: readonly T[], i: number): T {
  const x = niz[i]
  if (x === undefined) throw new RangeError(`rng mora da vraća [0, 1): indeks ${i} van niza`)
  return x
}

/**
 * Šta mušterije mogu da traže: kulture do trenutnog nivoa koje rastu ≤ 30 min (REDOSLED), pa
 * proizvodi KUPLJENIH zgrada (mašine pa životinje) — nezavisno od nivoa. Redosled je bitan za rng.
 */
export function narPool(s: Stanje): ArtikalId[] {
  const { lvl } = nivoIzXp(s.xp)
  const pool: ArtikalId[] = REDOSLED.filter(
    (k) => KULTURE[k].nivo <= lvl && KULTURE[k].vreme <= NARUDZBINA_MAX_VREME_KULTURE,
  )
  for (const id of MASINE_REDOSLED) if (s.masine[id].k) pool.push(MASINE[id].izlaz)
  for (const id of ZIV_REDOSLED) if (s.ziv[id].k) pool.push(ZIV[id].proizvod)
  return pool
}

/** Nova narudžbina sa ID-jem `g.brojacN++`. Troši `4 + C` rng poziva (vidi zaglavlje). */
export function novaNarudzba(g: Igra, rng: Rng): Narudzba {
  const { lvl } = nivoIzXp(g.s.xp)
  const pool = narPool(g.s)
  // r₁ se izvlači UVEK: levi operand; `pool.length < 2` se računa samo kad je r₁ ≥ 0.55.
  const brojVrsta =
    rng() < NARUDZBINA_JEDNA_VRSTA || pool.length < NARUDZBINA_MAX_VRSTA ? 1 : NARUDZBINA_MAX_VRSTA
  const izbor = [...pool].sort(() => rng() - 0.5).slice(0, brojVrsta)
  const cilj = ciljNarudzbine(lvl, rng())
  const stavke = izbor.map((k) => ({
    k,
    kom: Math.max(
      NARUDZBINA_KOM_MIN,
      Math.min(NARUDZBINA_KOM_MAX, Math.round(cilj / izbor.length / baznaCena(k))),
    ),
  }))
  const vrednost = stavke.reduce((zbir, x) => zbir + baznaCena(x.k) * x.kom, 0)
  const ko = izvuci(MUSTERIJE, Math.floor(rng() * MUSTERIJE.length))
  return {
    id: g.brojacN++,
    ime: ko.ime,
    emoji: ko.emoji,
    boja: ko.boja,
    msg: izvuci(ko.poruke, Math.floor(rng() * ko.poruke.length)),
    stavke,
    din: nagradaDin(vrednost),
    xp: nagradaXp(vrednost),
  }
}

/** Dopunjava tablu do NARUDZBINA_AKTIVNIH; nove idu NA KRAJ. */
export function osigurajNarudzbe(g: Igra, rng: Rng): void {
  while (g.s.narudzbe.length < NARUDZBINA_AKTIVNIH) g.s.narudzbe.push(novaNarudzba(g, rng))
}

/** Magacin pokriva sve stavke narudžbine. */
export function mozeIsporuka(s: Stanje, o: Narudzba): boolean {
  return o.stavke.every((st) => s.mag[st.k] >= st.kom)
}

/**
 * Isporuka. Nepoznat ID: tiho. Nedovoljno robe: samo zvuk greške. Zamenska narudžbina nastaje
 * POSLE `dodajXp`, pa već koristi pool i cilj novog nivoa.
 */
export function isporuci(g: Igra, id: number, _now: number, rng: Rng): Rezultat {
  const s = g.s
  const o = s.narudzbe.find((x) => x.id === id)
  if (!o) return ODBIJENO
  if (!mozeIsporuka(s, o)) {
    return { ok: false, dogadjaji: [{ tip: 'zvuk', id: 'greska' }], cuvaj: 'ne' }
  }
  for (const st of o.stavke) s.mag[st.k] -= st.kom
  s.novac += o.din
  s.stat.zaradjeno += o.din
  s.stat.isporuke++
  const sidro = { vrsta: 'narudzba', id } as const
  const dogadjaji: Rezultat['dogadjaji'] = [
    { tip: 'novcici', sidro, broj: NOVCICA_MAX },
    { tip: 'vibracija', obrazac: VIBRACIJA.isporuka },
    ...dodajXp(g, o.xp, sidro),
    { tip: 'poruka', poruka: { id: 'zahvaljuje', ime: o.ime, din: o.din } },
  ]
  s.narudzbe = s.narudzbe.filter((x) => x.id !== id)
  osigurajNarudzbe(g, rng)
  return { ok: true, dogadjaji, cuvaj: 'odlozeno' }
}

/**
 * „Nemam to — daj drugu": besplatno i neograničeno (1:1). Nepoznat ID: odbijeno (prototip je i
 * tada crtao i čuvao, što se ne vidi).
 */
export function odbij(g: Igra, id: number, rng: Rng): Rezultat {
  const s = g.s
  if (!s.narudzbe.some((x) => x.id === id)) return ODBIJENO
  s.narudzbe = s.narudzbe.filter((x) => x.id !== id)
  osigurajNarudzbe(g, rng)
  return { ok: true, dogadjaji: [{ tip: 'zvuk', id: 'tap' }], cuvaj: 'odlozeno' }
}
