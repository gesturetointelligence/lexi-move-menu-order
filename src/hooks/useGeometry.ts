import { useEffect, useState } from 'react'

// CardPager's geometry, with the capture tray in the keyboard's place:
//   cardH = windowH − topY − kbH − GAP   →   cardH = windowH − topY − trayBlock − GAP
// The tray IS the keyboard here: docked full width at the bottom edge.
// Cards are always cardH. Two sizes in the whole app: the card and the presented card.

export const GAP = 8 // between cards, and from the screen's edges
export const BROWSE_TAIL = 32 // tappable strip under the last card (recall)
// On a bigger screen the play stays inside an iPhone screen (402×874, the
// reference Magic's onboarding is drawn for). No device mockup, just the size.
const IPHONE_W = 402
const IPHONE_H = 874
// The drawer is keyboard-sized: CardPager's KB_SEED, the keyboard height it seeds with.
export const KB_SEED = 336

function readSafeArea() {
  const probe = document.createElement('div')
  probe.style.cssText =
    'position:fixed;visibility:hidden;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)'
  document.body.appendChild(probe)
  const cs = getComputedStyle(probe)
  const top = parseFloat(cs.paddingTop) || 0
  const bottom = parseFloat(cs.paddingBottom) || 0
  probe.remove()
  return { top, bottom }
}

export interface Geometry {
  ox: number // the screen's origin in the browser viewport
  oy: number
  colW: number
  vh: number
  safeTop: number
  safeBottom: number
  topY: number
  trayH: number
  trayBlock: number // the tray's full docked height, home indicator included
  cardW: number
  cardH: number
  step: number
}

function compute(): Geometry {
  const vh = Math.min(window.innerHeight, IPHONE_H)
  const colW = Math.min(window.innerWidth, IPHONE_W)
  const ox = Math.round((window.innerWidth - colW) / 2)
  const oy = Math.round((window.innerHeight - vh) / 2)
  const { top: safeTop, bottom: safeBottom } = readSafeArea()
  const topY = safeTop + GAP
  const trayBlock = KB_SEED // like the keyboard's height, it includes the home indicator
  const trayH = trayBlock - safeBottom
  const cardW = colW - 2 * GAP
  const cardH = Math.max(160, vh - topY - trayBlock - GAP)
  return { ox, oy, colW, vh, safeTop, safeBottom, topY, trayH, trayBlock, cardW, cardH, step: cardH + GAP }
}

export function useGeometry(): Geometry {
  const [g, setG] = useState(compute)
  useEffect(() => {
    const on = () => setG(compute())
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return g
}
