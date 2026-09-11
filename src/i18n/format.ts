/*
 * Formateri iz prototipa (moja-farma-v3.html L583, L591–595). Čiste funkcije, bez DOM-a.
 * fmt i vremeTxt su 1:1; trajanjeTxt ima decimalni zarez (odobreno odstupanje D16).
 */

const LOKAL = 'sr-RS'

/** Novac i statistika (prototip `fmt`, L583): prvo `Math.round`, pa srpsko grupisanje tačkom —
 *  1234 → „1.234", 12.5 → „13". */
export function fmt(n: number): string {
  return Math.round(n).toLocaleString(LOKAL)
}

/** Odbrojavanje na parceli i mašini (prototip `vremeTxt`, L591–594). Prvo `ceil`, pa klešti na 0:
 *  ≥ 1 h → „1h 5m" (minuti bez vodeće nule), ≥ 1 min → „4:05", inače „9s". */
export function vremeTxt(s: number): string {
  const c = Math.max(0, Math.ceil(s))
  if (c >= 3600) return Math.floor(c / 3600) + 'h ' + Math.floor((c % 3600) / 60) + 'm'
  if (c >= 60) return Math.floor(c / 60) + ':' + String(c % 60).padStart(2, '0')
  return c + 's'
}

/** Statično trajanje iz config-a — vreme rasta u listu semena, interval životinje (prototip
 *  `trajanjeTxt`, L595). Ne zaokružuje na cele jedinice. D16: broj ide kroz `toLocaleString('sr-RS')`,
 *  pa razlomak ima decimalni ZAREZ („1,5 min" umesto prototipovog „1.5 min"); celi brojevi su isti
 *  kao u prototipu („20 s", „5 min", „2 h"). Intl prikazuje najviše 3 decimale (3599 s → „59,983 min"),
 *  što nijedna config vrednost ne dostiže. */
export function trajanjeTxt(s: number): string {
  if (s >= 3600) return (s / 3600).toLocaleString(LOKAL) + ' h'
  if (s >= 60) return (s / 60).toLocaleString(LOKAL) + ' min'
  return s.toLocaleString(LOKAL) + ' s'
}
