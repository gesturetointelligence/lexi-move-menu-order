import { useEffect, useRef, useState } from 'react'
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { CARD_BG, MagicCard, fitCardText } from './MagicCard'
import type { Geometry } from '../hooks/useGeometry'
import { CARD_RADIUS, PAD } from '../lib/textLayout'

// Present, as CardPager does it: pinch out and the card morphs full-bleed,
// text fitted up to 15% larger, no chrome. Tap the left or right third to page
// (the middle third does nothing), swipe past 90pt or pinch in to go back.

const PAGE_LEFT = 1 / 3
const PAGE_RIGHT = 2 / 3
const EXIT_THRESHOLD = 90
const EXIT_RESISTANCE = 0.6

export interface Rect {
  left: number
  top: number
  width: number
  height: number
}

interface Props {
  g: Geometry
  texts: string[]
  index: number
  /** Where card `i` sits on screen right now, so the morph opens and closes on it. */
  rectOf: (i: number) => Rect
  onIndex: (i: number) => void
  onClose: () => void
}

export function Present({ g, texts, index, rectOf, onIndex, onClose }: Props) {
  const reduced = useReducedMotion()
  const [closing, setClosing] = useState(false)
  const [origin] = useState(() => rectOf(index))
  const dragY = useMotionValue(0)
  const followY = useTransform(dragY, (v) => v * EXIT_RESISTANCE)
  const press = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinchD0 = useRef<number | null>(null)

  const text = texts[index] ?? ''
  const presentH = g.vh - g.safeTop - g.safeBottom
  const presentFont = fitCardText(text, g.colW, presentH, true).fontSize
  const cardFont = fitCardText(text, g.cardW, g.cardH).fontSize
  const zoom0 = presentFont > 0 ? Math.min(1, cardFont / presentFont) : 1

  const close = () => setClosing(true)

  const page = (dir: -1 | 1) => {
    const next = index + dir
    if (next < 0 || next >= texts.length) {
      navigator.vibrate?.([8, 40, 8]) // clamped: the reject haptic
      return
    }
    onIndex(next)
  }

  // Keep the screen awake while a card is up.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null
    navigator.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => {})
    return () => {
      lock?.release().catch(() => {})
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowRight') page(1)
      if (e.key === 'ArrowLeft') page(-1)
    }
    let wheel = 1
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      wheel *= Math.exp(-e.deltaY / 100)
      if (wheel < 0.9) close()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('wheel', onWheel)
    }
  })

  const target = closing ? rectOf(index) : null
  const full = { left: 0, top: 0, width: g.colW, height: g.vh, borderRadius: 0 }

  return (
    <motion.div
      className="present"
      role="dialog"
      aria-modal="true"
      aria-label={`Presenting: ${text}`}
      style={{ background: CARD_BG, y: followY }}
      initial={
        reduced
          ? { ...full, opacity: 0 }
          : { left: origin.left, top: origin.top, width: origin.width, height: origin.height, borderRadius: CARD_RADIUS }
      }
      animate={
        target
          ? reduced
            ? { opacity: 0 }
            : { left: target.left, top: target.top, width: target.width, height: target.height, borderRadius: CARD_RADIUS }
          : { ...full, opacity: 1 }
      }
      transition={reduced ? { duration: 0.01 } : { type: 'spring', visualDuration: 0.38, bounce: 0.12 }}
      onAnimationComplete={() => closing && onClose()}
      onPointerDown={(e) => {
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
        if (pointers.current.size === 2) {
          const [a, b] = [...pointers.current.values()]
          pinchD0.current = Math.hypot(a.x - b.x, a.y - b.y)
          press.current = null
          return
        }
        press.current = { x: e.clientX, y: e.clientY, moved: false }
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
        if (pinchD0.current && pointers.current.size === 2) {
          const [a, b] = [...pointers.current.values()]
          if (Math.hypot(a.x - b.x, a.y - b.y) / pinchD0.current < 0.9) {
            pinchD0.current = null
            close()
          }
          return
        }
        const pr = press.current
        if (!pr) return
        const dy = e.clientY - pr.y
        if (!pr.moved && Math.abs(dy) > 10) pr.moved = true
        if (pr.moved) dragY.set(dy)
      }}
      onPointerUp={(e) => {
        pointers.current.delete(e.pointerId)
        if (pointers.current.size < 2) pinchD0.current = null
        const pr = press.current
        press.current = null
        if (!pr || closing) return
        if (pr.moved) {
          if (Math.abs(dragY.get()) > EXIT_THRESHOLD) {
            animate(dragY, 0, { duration: 0.2 })
            close()
          } else animate(dragY, 0, { type: 'spring', damping: 26, stiffness: 320, mass: 0.6 })
          return
        }
        // Taps page through the order, like a slide clicker. Never exit.
        const x = (e.clientX - g.ox) / g.colW
        if (x <= PAGE_LEFT) page(-1)
        else if (x >= PAGE_RIGHT) page(1)
      }}
      onPointerCancel={(e) => {
        pointers.current.delete(e.pointerId)
        press.current = null
        animate(dragY, 0, { duration: 0.2 })
      }}
    >
      <motion.div
        className="present-text"
        style={{ transformOrigin: '0% 0%' }}
        initial={reduced ? false : { scale: zoom0 }}
        animate={{ scale: closing ? zoom0 : 1 }}
        transition={reduced ? { duration: 0 } : { type: 'spring', visualDuration: 0.38, bounce: 0.12 }}
      >
        <MagicCard
          text={text}
          width={g.colW}
          height={presentH}
          present
          style={{ background: 'transparent', paddingTop: PAD + g.safeTop }}
        />
      </motion.div>
    </motion.div>
  )
}
