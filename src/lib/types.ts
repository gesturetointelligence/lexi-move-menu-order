/** A photographed menu, already downscaled to what the model sees. */
export interface Photo {
  src: string // data URL (JPEG)
  width: number
  height: number
}

/** One orderable item, with its tap target as fractions of the photo. */
export interface MenuItem {
  id: string
  name: string // exactly as printed
  price: string
  box: { x: number; y: number; w: number; h: number } // 0..1
}

/** A Magic card in the thread. Its text is the menu's own words, editable like any card. */
export interface Card {
  id: string
  text: string
}
