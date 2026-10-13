// A printed café menu, drawn on canvas so the demo runs with no key and no
// server. Boxes come from the drawing itself, and the cards are written the
// way the model writes them, so the sample behaves like a real read.

import type { MenuItem, Photo } from './types'

const W = 1200
const H = 1600

interface Entry {
  name: string
  price: string
  card: string
  cardMany: string
}

const SECTIONS: { title: string; entries: Entry[] }[] = [
  {
    title: 'Coffee',
    entries: [
      { name: 'Espresso', price: '3.00', card: 'One espresso, please.', cardMany: '{n} espressos, please.' },
      { name: 'Flat white', price: '3.80', card: 'One flat white, please.', cardMany: '{n} flat whites, please.' },
      { name: 'Oat cortado', price: '3.90', card: 'One oat cortado, please.', cardMany: '{n} oat cortados, please.' },
      { name: 'Iced long black', price: '4.20', card: 'One iced long black, please.', cardMany: '{n} iced long blacks, please.' },
      { name: 'Chai latte', price: '4.10', card: 'One chai latte, please.', cardMany: '{n} chai lattes, please.' },
    ],
  },
  {
    title: 'Breakfast',
    entries: [
      { name: 'Smashed avocado on sourdough', price: '12.50', card: 'Smashed avocado on sourdough, please.', cardMany: '{n} smashed avocado on sourdough, please.' },
      { name: 'Bacon & egg roll', price: '9.00', card: 'One bacon and egg roll, please.', cardMany: '{n} bacon and egg rolls, please.' },
      { name: 'Shakshuka', price: '14.00', card: 'The shakshuka, please.', cardMany: '{n} shakshukas, please.' },
      { name: 'Bircher muesli', price: '10.50', card: 'One Bircher muesli, please.', cardMany: '{n} Bircher mueslis, please.' },
    ],
  },
  {
    title: 'Bakery',
    entries: [
      { name: 'Almond croissant', price: '5.20', card: 'One almond croissant, please.', cardMany: '{n} almond croissants, please.' },
      { name: 'Banana bread', price: '4.80', card: 'A slice of banana bread, please.', cardMany: '{n} slices of banana bread, please.' },
      { name: 'Cinnamon scroll', price: '4.90', card: 'One cinnamon scroll, please.', cardMany: '{n} cinnamon scrolls, please.' },
    ],
  },
]

export function drawSampleMenu(): { photo: Photo; items: MenuItem[] } {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  // Paper, warm and slightly uneven, like a photo under café light.
  ctx.fillStyle = '#efe7d6'
  ctx.fillRect(0, 0, W, H)
  const light = ctx.createRadialGradient(W * 0.42, H * 0.3, 80, W * 0.5, H * 0.5, H * 0.85)
  light.addColorStop(0, 'rgba(255,250,238,0.55)')
  light.addColorStop(1, 'rgba(70,52,30,0.28)')
  ctx.fillStyle = light
  ctx.fillRect(0, 0, W, H)
  let seed = 7
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = `rgba(80,60,30,${rand() * 0.05})`
    ctx.fillRect(rand() * W, rand() * H, 2, 2)
  }

  const ink = '#2a2420'
  const serif = 'Georgia, "Times New Roman", serif'
  ctx.fillStyle = ink
  ctx.textBaseline = 'alphabetic'

  ctx.textAlign = 'center'
  ctx.font = `italic 400 84px ${serif}`
  ctx.fillText('Corner Kitchen', W / 2, 168)
  ctx.font = `400 26px ${serif}`
  ctx.fillText('ALL DAY  ·  ORDER AT THE COUNTER', W / 2, 218)
  ctx.fillRect(W / 2 - 60, 252, 120, 2)

  const left = 120
  const right = W - 120
  let y = 320
  const items: MenuItem[] = []
  const nameSize = 40

  for (const section of SECTIONS) {
    ctx.textAlign = 'left'
    ctx.font = `700 30px ${serif}`
    ctx.fillText(section.title.toUpperCase().split('').join(' '), left, y)
    y += 66
    for (const e of section.entries) {
      ctx.font = `400 ${nameSize}px ${serif}`
      ctx.textAlign = 'left'
      ctx.fillText(e.name, left, y)
      const nameW = ctx.measureText(e.name).width
      ctx.textAlign = 'right'
      ctx.fillText(e.price, right, y)
      const priceW = ctx.measureText(e.price).width
      // Dotted leader between name and price.
      ctx.fillStyle = 'rgba(42,36,32,0.45)'
      for (let x = left + nameW + 18; x < right - priceW - 18; x += 14) {
        ctx.fillRect(x, y - 6, 3, 3)
      }
      ctx.fillStyle = ink
      const top = y - nameSize * 0.8
      const h = nameSize * 1.05
      const padX = h * 0.25
      const padY = h * 0.3
      items.push({
        id: `${items.length}-${e.name}`,
        name: e.name,
        price: e.price,
        box: {
          x: (left - padX) / W,
          y: (top - padY) / H,
          w: (right - left + 2 * padX) / W,
          h: (h + 2 * padY) / H,
        },
        card: e.card,
        cardMany: e.cardMany,
      })
      y += 72
    }
    y += 40
  }

  ctx.textAlign = 'center'
  ctx.font = `italic 400 24px ${serif}`
  ctx.fillStyle = 'rgba(42,36,32,0.7)'
  ctx.fillText('Oat, soy and almond milk available. Ask us about gluten free.', W / 2, H - 70)

  return { photo: { src: canvas.toDataURL('image/jpeg', 0.9), width: W, height: H }, items }
}
