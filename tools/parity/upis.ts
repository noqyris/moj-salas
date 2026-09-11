/*
 * Pravljenje fikstura pariteta: `npm run parity:gen` (tools/parity/generisi.mjs → upisiSveFiksture).
 * Test tests/parity/tragovi.test.ts proverava da su upisane fiksture sveže.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { DIR_FIKSTURA, postojeceFiksture, putanjaFiksture } from './fiksture'
import { kodirajTrag } from './kodek'
import { SVI_TRAGOVI } from './scenariji'
import { generisiTrag, type OpcijeTraga } from './tragovi'

export async function generisiFiksturu(o: OpcijeTraga): Promise<string> {
  return kodirajTrag(await generisiTrag(o))
}

/** Generiše sve tragove i prepisuje direktorijum fikstura (zastareli fajlovi se brišu). */
export async function upisiSveFiksture(log: (s: string) => void = () => {}): Promise<void> {
  mkdirSync(DIR_FIKSTURA, { recursive: true })
  const nove = new Map<string, string>()
  for (const o of SVI_TRAGOVI) {
    const t0 = performance.now()
    const tekst = await generisiFiksturu(o)
    nove.set(o.ime, tekst)
    const ms = Math.round(performance.now() - t0)
    log(`${o.ime.padEnd(22)} ${String(Buffer.byteLength(tekst)).padStart(7)} B  ${ms} ms`)
  }
  for (const ime of postojeceFiksture()) if (!nove.has(ime)) rmSync(putanjaFiksture(ime))
  let ukupno = 0
  for (const [ime, tekst] of nove) {
    writeFileSync(putanjaFiksture(ime), tekst)
    ukupno += Buffer.byteLength(tekst)
  }
  log(`ukupno ${nove.size} tragova, ${ukupno} B`)
}
