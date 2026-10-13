import { motion } from 'motion/react'
import type { MotionValue } from 'motion/react'
import { MagicCard } from './MagicCard'
import { GAP } from '../hooks/useGeometry'
import type { Geometry } from '../hooks/useGeometry'

// Magic's swipe-left new thread (components/cards/NewThreadPreview.tsx,
// lib/newThreadSwipe.ts, MAGI-105): a blank thread tracks the finger in from
// the right, commits past 35% or on a firm flick, and the screen resets in
// place underneath it. Here the new thread is a clean start: no cards, and the
// camera back in the drawer.

export const NEW_THREAD_COMMIT_FRACTION = 0.35
export const NEW_THREAD_FLICK_VELOCITY = 700 // px/s, leftward
export const NEW_THREAD_HOME_SPRING = { type: 'spring' as const, damping: 30, stiffness: 300, mass: 0.7, restDelta: 0.5 }
export const REVEAL_TIMING = { duration: 0.32, ease: [0.33, 1, 0.68, 1] as const } // Easing.out(cubic)
export const NEW_THREAD_RESET_COVER_MS = 450

export function commitsNewThread(slidIn: number, screenWidth: number, velocityX: number) {
  return slidIn > screenWidth * NEW_THREAD_COMMIT_FRACTION || velocityX < -NEW_THREAD_FLICK_VELOCITY
}

export function NewThreadPreview({ g, x }: { g: Geometry; x: MotionValue<number> }) {
  return (
    <motion.div className="new-thread" aria-hidden="true" style={{ x }}>
      <div style={{ position: 'absolute', top: g.topY, left: GAP }}>
        <MagicCard text="" width={g.cardW} height={g.cardH} caret />
      </div>
      <div className="new-thread-drawer" style={{ height: g.trayBlock }} />
    </motion.div>
  )
}
