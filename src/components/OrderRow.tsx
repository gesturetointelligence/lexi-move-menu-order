import { forwardRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { MagicCard } from './MagicCard'
import { cardText } from '../lib/types'
import type { MenuItem, OrderLine } from '../lib/types'

export const ROW_CARD_W = 148

interface Props {
  lines: OrderLine[]
  items: Record<string, MenuItem>
  /** itemId whose card just changed, for the one-shot pulse. */
  pulse: { itemId: string; key: number } | null
  /** Items still in flight: their slot is open but the card is not shown yet. */
  landing: string[]
  onHold: (index: number) => void
}

/** Each tap returns as its own card. Newest first. */
export const OrderRow = forwardRef<HTMLDivElement, Props>(function OrderRow(
  { lines, items, pulse, landing, onHold },
  ref,
) {
  const reduced = useReducedMotion()
  const spring = { type: 'spring' as const, visualDuration: 0.4, bounce: 0.25 }

  return (
    <div ref={ref} className="order-row">
      {lines.length === 0 && (
        <div className="order-ghost" style={{ width: ROW_CARD_W }} aria-hidden="true" />
      )}
      <AnimatePresence initial={false} mode="popLayout">
        {lines.map((line, i) => {
          const item = items[line.itemId]
          if (!item) return null
          const text = cardText(item, line.n)
          const pulsing = pulse?.itemId === line.itemId
          return (
            <motion.button
              key={line.itemId}
              type="button"
              className="order-card"
              aria-label={`${text} Hold up.`}
              layout={!reduced}
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
              animate={{ opacity: landing.includes(line.itemId) ? 0 : 1, scale: 1 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
              transition={reduced ? { duration: 0.01 } : spring}
              whileTap={reduced ? undefined : { scale: 0.97 }}
              onClick={() => onHold(i)}
            >
              {/* Keyed by the tap, so every repeat tap of an item pulses again. */}
              <motion.div
                key={pulsing ? pulse.key : 'still'}
                initial={{ scale: 1 }}
                animate={pulsing && !reduced ? { scale: [1, 1.07, 1] } : { scale: 1 }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
              >
                <MagicCard text={text} width={ROW_CARD_W} />
              </motion.div>
            </motion.button>
          )
        })}
      </AnimatePresence>
    </div>
  )
})
