import { motion, useTransform } from 'motion/react'
import type { MotionValue } from 'motion/react'

// Magic's keyboard toolbar Dismiss (components/cards/KeyboardToolbar.tsx): a
// glass, icon-only `keyboard.chevron.compact.down`, 12pt above the keyboard at
// the right edge. Here it sits on the drawer and rides it up and down.

const BOTTOM_GAP = 12

function ChevronCompactDown() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 10l7 4 7-4" />
    </svg>
  )
}

interface Props {
  kb: MotionValue<number>
  trayBlock: number
  hidden: boolean
  onDismiss: () => void
}

export function DismissButton({ kb, trayBlock, hidden, onDismiss }: Props) {
  const bottom = useTransform(kb, (v) => v * trayBlock + BOTTOM_GAP)
  const opacity = useTransform(kb, (v) => (hidden ? 0 : Math.max(0, (v - 0.6) / 0.4)))
  return (
    <motion.button
      type="button"
      className="glass-dismiss"
      aria-label="Dismiss"
      style={{ bottom, opacity, pointerEvents: hidden ? 'none' : 'auto' }}
      whileTap={{ scale: 0.92 }}
      onClick={onDismiss}
    >
      <ChevronCompactDown />
    </motion.button>
  )
}
