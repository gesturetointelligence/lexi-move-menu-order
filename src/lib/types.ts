/** A photographed menu, already downscaled to what the model sees. */
export interface Photo {
  src: string // data URL (JPEG)
  width: number
  height: number
}

/** One orderable item, with its tap target as fractions of the photo. */
export interface MenuItem {
  id: string
  name: string
  price: string
  box: { x: number; y: number; w: number; h: number } // 0..1
  card: string
  cardMany: string // contains {n}
}

export interface OrderLine {
  itemId: string
  n: number
}

export function cardText(item: MenuItem, n: number): string {
  if (n <= 1) return item.card
  return item.cardMany.includes('{n}')
    ? item.cardMany.replace('{n}', String(n))
    : `${n} × ${item.card}`
}
