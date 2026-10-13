import { useEffect, useState } from 'react'

// CardPager's geometry, with the capture tray in the keyboard's place:
//   cardH = windowH − topY − kbH − GAP   →   cardH = windowH − topY − trayBlock − GAP
// The tray IS the keyboard here: docked full width at the bottom edge.
// Cards are always cardH. Two sizes in the whole app: the card and the presented card.

export const GAP = 8 // between cards, and from the screen's edges
export const BROWSE_TAIL = 32 // tappable strip under the last card (recall)
const PHONE_MAX_W = 440 // on a desktop the play renders as a phone-width column
const TRAY_FRACTION = 0.52

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
  const vh = window.innerHeight
  const colW = Math.min(window.innerWidth, PHONE_MAX_W)
  const { top: safeTop, bottom: safeBottom } = readSafeArea()
  const topY = safeTop + GAP
  const trayH = Math.round(vh * TRAY_FRACTION)
  const trayBlock = trayH + safeBottom
  const cardW = colW - 2 * GAP
  const cardH = Math.max(160, vh - topY - trayBlock - GAP)
  return { colW, vh, safeTop, safeBottom, topY, trayH, trayBlock, cardW, cardH, step: cardH + GAP }
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
