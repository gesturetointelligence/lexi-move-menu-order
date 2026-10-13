import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { MagicCard } from './MagicCard'
import { CARD_ASPECT } from '../lib/textLayout'
import { cardText } from '../lib/types'
import type { MenuItem, OrderLine } from '../lib/types'

interface Props {
  lines: OrderLine[]
  items: Record<string, MenuItem>
  start: number
  onClose: () => void
  onRemove: (itemId: string) => void
}

function useViewport() {
  const [v, setV] = useState({ w: window.innerWidth, h: window.innerHeight })
  useEffect(() => {
    const on = () => setV({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return v
}

/** The card, as big as the screen allows, held up for the counter. Swipe between cards. */
export function HoldUp({ lines, items, start, onClose, onRemove }: Props) {
  const reduced = useReducedMotion()
  const { w, h } = useViewport()
  const pagerRef = useRef<HTMLDivElement | null>(null)
  const [index, setIndex] = useState(start)
  const cardW = Math.min(w - 32, (h - 140) * CARD_ASPECT)

  // Keep the screen awake while the card is up.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null
    navigator.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => {})
    return () => {
      lock?.release().catch(() => {})
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') scrollTo(index + 1)
      if (e.key === 'ArrowLeft') scrollTo(index - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  useLayoutEffect(() => {
    const el = pagerRef.current
    if (el) el.scrollLeft = start * el.clientWidth
  }, [start])

  useEffect(() => {
    if (lines.length === 0) onClose()
    else if (index >= lines.length) setIndex(lines.length - 1)
  }, [lines.length, index, onClose])

  const scrollTo = (i: number) => {
    const el = pagerRef.current
    if (!el || i < 0 || i >= lines.length) return
    el.scrollTo({ left: i * el.clientWidth, behavior: reduced ? 'auto' : 'smooth' })
  }

  const current = lines[Math.min(index, lines.length - 1)]

  return (
    <motion.div
      className="holdup"
      role="dialog"
      aria-modal="true"
      aria-label="Hold up your order"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0.01 : 0.2 }}
    >
      <div
        ref={pagerRef}
        className="holdup-pager"
        onScroll={(e) => {
          const el = e.currentTarget
          setIndex(Math.round(el.scrollLeft / el.clientWidth))
        }}
      >
        {lines.map((line) => {
          const item = items[line.itemId]
          if (!item) return null
          return (
            <button key={line.itemId} type="button" className="holdup-page" onClick={onClose} aria-label="Close">
              <motion.div
                initial={reduced ? false : { scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', visualDuration: 0.35, bounce: 0.2 }}
              >
                <MagicCard text={cardText(item, line.n)} width={cardW} />
              </motion.div>
            </button>
          )
        })}
      </div>
      <div className="holdup-foot">
        <button type="button" className="pill-btn" onClick={() => current && onRemove(current.itemId)}>
          Remove
        </button>
        {lines.length > 1 && (
          <div className="dots" aria-hidden="true">
            {lines.map((l, i) => (
              <span key={l.itemId} className="dot" data-on={i === index || undefined} />
            ))}
          </div>
        )}
        <button type="button" className="pill-btn" onClick={onClose}>
          Done
        </button>
      </div>
    </motion.div>
  )
}
