/** NPC mušterije sa table za narudžbine. Ime, emoji, boja i poruka se KOPIRAJU u narudžbinu
 *  kad nastane i tako se čuvaju u sejvu (v3 format), pa su deo sadržaja, a ne samo UI teksta. */
export interface Musterija {
  readonly ime: string
  readonly emoji: string
  /** Boja pozadine avatara. */
  readonly boja: string
  readonly poruke: readonly string[]
}

export const MUSTERIJE: readonly Musterija[] = [
  {
    ime: 'Baka Mira',
    emoji: '👵',
    boja: '#ffe0e6',
    poruke: ['Za unučiće spremam ručak…', 'Treba mi za zimnicu, sine.'],
  },
  {
    ime: 'Pekara „Zrno“',
    emoji: '🥖',
    boja: '#ffeccc',
    poruke: ['Peć je već vruća!', 'Jutarnja tura kreće u pet.'],
  },
  {
    ime: 'Kafana „Kod Žike“',
    emoji: '🍺',
    boja: '#fff3c4',
    poruke: ['Večeras je puna kafana.', 'Gosti traže domaće!'],
  },
  {
    ime: 'Piljar Pera',
    emoji: '🧢',
    boja: '#d9f0ff',
    poruke: ['Tezga mi je poluprazna…', 'Plaćam odmah, kao i uvek.'],
  },
  {
    ime: 'Resto „Šumadija“',
    emoji: '🍽️',
    boja: '#e4f5d8',
    poruke: ['Šef kuhinje je izričit.', 'Samo sveže, molim.'],
  },
]
