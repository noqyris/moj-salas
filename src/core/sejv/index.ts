/*
 * Javni API sejva (ugovor §5). Pomoćnici iz `tipovi.ts` (`jeObjekat`, `ima`, `popravka`) su
 * interni i namerno se ne izvoze, da `src/core/index.ts` nema sukobe imena.
 */
export { dekodirajSejv, kodirajSejv, type DekodiranSejv } from './dekoder'
export {
  SaveController,
  type OpcijeKontrolera,
  type Rasporedjivac,
  type RezultatUcitavanja,
  type SkladisteSejva,
} from './kontroler'
export { MIGRACIJE, pokreniMigracije, v2uV3, type Migracija } from './migracije'
export { normalizujV3, type Normalizovano } from './normalizuj'
export type { MusterijaV2, NarudzbaV2, SejvV2, SejvV3KakoJeZapisan, VrstaPopravke } from './tipovi'
