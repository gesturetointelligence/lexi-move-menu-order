import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useWidth } from '../hooks/useWidth'
import type { MenuItem, Photo } from '../lib/types'

interface Props {
  photo: Photo
  items: MenuItem[]
  reading: boolean
  counts: Record<string, number>
  onTap: (item: MenuItem, from: DOMRect) => void
}

/** The photo is the interface. Items light up where they are printed. */
export function MenuStage({ photo, items, reading, counts, onTap }: Props) {
  const reduced = useReducedMotion()
  const [ref, containerW] = useWidth<HTMLDivElement>()
  const aspect = photo.width / photo.height
  const maxH = typeof window !== 'undefined' ? window.innerHeight * 0.6 : 600
  const w = Math.min(containerW, maxH * aspect)
  const h = w / aspect

  return (
    <div ref={ref} className="stage-wrap">
      {w > 0 && (
        <div className="stage" style={{ width: w, height: h }}>
          <img
            className="stage-photo"
            src={photo.src}
            alt="The menu"
            data-reading={reading || undefined}
            draggable={false}
          />
          {reading && !reduced && <div className="scan" aria-hidden="true" />}
          <AnimatePresence>
            {items.map((item, i) => {
              const n = counts[item.id] ?? 0
              return (
                <motion.button
                  key={item.id}
                  type="button"
                  className="hotspot"
                  data-ordered={n > 0 || undefined}
                  aria-label={n > 0 ? `${item.name}, ${n} ordered. Add one more.` : `Order ${item.name}`}
                  style={{
                    left: `${item.box.x * 100}%`,
                    top: `${item.box.y * 100}%`,
                    width: `${item.box.w * 100}%`,
                    height: `${item.box.h * 100}%`,
                  }}
                  initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={
                    reduced
                      ? { duration: 0.01 }
                      : { type: 'spring', visualDuration: 0.35, bounce: 0.3, delay: reading ? 0 : i * 0.03 }
                  }
                  whileTap={reduced ? undefined : { scale: 0.96 }}
                  onClick={(e) => onTap(item, e.currentTarget.getBoundingClientRect())}
                >
                  <AnimatePresence>
                    {n > 0 && (
                      <motion.span
                        key={n}
                        className="hotspot-count"
                        initial={reduced ? { opacity: 0 } : { scale: 0.4, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={reduced ? { duration: 0.01 } : { type: 'spring', visualDuration: 0.3, bounce: 0.45 }}
                      >
                        {n}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
