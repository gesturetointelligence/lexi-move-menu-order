import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

import { CaptureDrawer } from './components/CaptureDrawer'
import { HoldUp } from './components/HoldUp'
import { CARD_BG, MagicCard } from './components/MagicCard'
import { MenuStage } from './components/MenuStage'
import { OrderRow, ROW_CARD_W } from './components/OrderRow'
import { useWidth } from './hooks/useWidth'
import { MenuReadError, readMenu } from './lib/readMenu'
import type { ReadError } from './lib/readMenu'
import { drawSampleMenu } from './lib/sampleMenu'
import { CARD_ASPECT, CARD_RADIUS, BASE_CARD_W_PT } from './lib/textLayout'
import type { MenuItem, OrderLine, Photo } from './lib/types'

const ERRORS: Record<ReadError, string> = {
  'no-server': 'Live reading runs on the dev server. Try the sample menu.',
  'no-key': 'Add ANTHROPIC_API_KEY to .env.local, then restart the dev server.',
  'bad-key': 'The API key was not accepted.',
  'rate-limit': 'Too many reads at once. Try again in a moment.',
  refusal: 'This photo could not be read.',
  'api-error': 'The read did not finish. Try again.',
  'nothing-found': 'No items found. Try a closer, flatter photo.',
}

function CameraIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#F8F9F9" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  )
}

function MenuIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#F8F9F9" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 3h12v18H6z" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </svg>
  )
}

interface Flight {
  key: number
  from: DOMRect
  to: { left: number; top: number; width: number; height: number }
  itemId: string
}

export default function App() {
  const reduced = useReducedMotion()
  const [heroRef, heroW] = useWidth<HTMLDivElement>()
  const rowRef = useRef<HTMLDivElement | null>(null)

  const [drawer, setDrawer] = useState(false)
  const [photo, setPhoto] = useState<Photo | null>(null)
  const [items, setItems] = useState<MenuItem[]>([])
  const [reading, setReading] = useState(false)
  const [error, setError] = useState<ReadError | null>(null)
  const [lines, setLines] = useState<OrderLine[]>([])
  const [pulse, setPulse] = useState<{ itemId: string; key: number } | null>(null)
  const [flights, setFlights] = useState<Flight[]>([])
  const [holding, setHolding] = useState<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const tapKey = useRef(0)

  const itemsById = Object.fromEntries(items.map((i) => [i.id, i]))
  const counts = Object.fromEntries(lines.map((l) => [l.itemId, l.n]))

  const start = useCallback((next: Photo, run: (signal: AbortSignal, add: (i: MenuItem) => void) => Promise<void>) => {
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setPhoto(next)
    setItems([])
    setLines([])
    setError(null)
    setReading(true)
    const add = (item: MenuItem) => {
      if (!ac.signal.aborted) setItems((prev) => [...prev, item])
    }
    run(ac.signal, add)
      .catch((err) => {
        if (ac.signal.aborted) return
        setError(err instanceof MenuReadError ? err.code : 'api-error')
      })
      .finally(() => {
        if (!ac.signal.aborted) setReading(false)
      })
  }, [])

  const handleCaptured = useCallback(
    (p: Photo) => {
      setDrawer(false)
      start(p, (signal, add) => readMenu(p, add, signal))
    },
    [start],
  )

  const handleSample = useCallback(() => {
    const { photo: p, items: sample } = drawSampleMenu()
    // Paced like a live read, so the sample feels like the real thing.
    start(p, async (signal, add) => {
      const wait = (ms: number) =>
        new Promise<void>((res, rej) => {
          const t = setTimeout(res, ms)
          signal.addEventListener('abort', () => {
            clearTimeout(t)
            rej(new DOMException('aborted', 'AbortError'))
          })
        })
      await wait(reduced ? 0 : 1400)
      for (const item of sample) {
        add(item)
        await wait(reduced ? 0 : 140)
      }
    })
  }, [start, reduced])

  useEffect(() => () => abortRef.current?.abort(), [])

  const handleTap = useCallback(
    (item: MenuItem, from: DOMRect) => {
      navigator.vibrate?.(10)
      tapKey.current += 1
      const existing = lines.some((l) => l.itemId === item.id)
      if (existing || reduced || !rowRef.current) {
        setLines((prev) =>
          existing
            ? prev.map((l) => (l.itemId === item.id ? { ...l, n: l.n + 1 } : l))
            : [{ itemId: item.id, n: 1 }, ...prev],
        )
        setPulse({ itemId: item.id, key: tapKey.current })
        return
      }
      // A new item flies from where it is printed into the order. Its slot
      // opens at once, so the card lands in a gap, not on another card.
      setLines((prev) => [{ itemId: item.id, n: 1 }, ...prev])
      const row = rowRef.current
      row.scrollTo({ left: 0, behavior: 'smooth' })
      const r = row.getBoundingClientRect()
      setFlights((f) => [
        ...f,
        {
          key: tapKey.current,
          from,
          to: { left: r.left, top: r.top, width: ROW_CARD_W, height: ROW_CARD_W / CARD_ASPECT },
          itemId: item.id,
        },
      ])
    },
    [lines, reduced],
  )

  const land = useCallback((flight: Flight) => {
    setFlights((f) => f.filter((x) => x.key !== flight.key))
  }, [])

  const handleRemove = useCallback((itemId: string) => {
    setLines((prev) => prev.filter((l) => l.itemId !== itemId))
  }, [])

  const status = reading
    ? items.length
      ? `Reading · ${items.length}`
      : 'Reading'
    : items.length
      ? `${items.length} items`
      : ''

  return (
    <div className="screen">
      <div className="content">
        {!photo ? (
          <div ref={heroRef} className="hero-wrap">
            {heroW > 0 && <MagicCard text="Photograph the menu." width={heroW} />}
          </div>
        ) : (
          <>
            <section className="stack">
              <div className="section-head">
                <h2 className="section-label">Menu</h2>
                <span className="section-status" aria-live="polite">
                  {status}
                </span>
              </div>
              <MenuStage photo={photo} items={items} reading={reading} counts={counts} onTap={handleTap} />
              <AnimatePresence>
                {error && (
                  <motion.p
                    className="note"
                    role="status"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    {ERRORS[error]}
                  </motion.p>
                )}
              </AnimatePresence>
            </section>
            <section className="stack">
              <h2 className="section-label">Order</h2>
              <OrderRow
                ref={rowRef}
                lines={lines}
                items={itemsById}
                pulse={pulse}
                landing={flights.map((f) => f.itemId)}
                onHold={(i) => setHolding(i)}
              />
            </section>
          </>
        )}

        <div className="controls">
          <button type="button" className="control-row control-row-btn" onClick={() => setDrawer(true)}>
            <span className="control-label">{photo ? 'New menu' : 'Menu'}</span>
            <span className="control-icon" aria-hidden="true">
              <CameraIcon />
            </span>
          </button>
          <div className="control-divider" aria-hidden="true" />
          {photo && lines.length > 0 ? (
            <button type="button" className="control-row control-row-btn" onClick={() => setHolding(0)}>
              <span className="control-label">Hold up</span>
              <span className="control-count">{lines.length}</span>
            </button>
          ) : (
            <button type="button" className="control-row control-row-btn" onClick={handleSample}>
              <span className="control-label">Sample menu</span>
              <span className="control-icon" aria-hidden="true">
                <MenuIcon />
              </span>
            </button>
          )}
        </div>
      </div>

      {flights.map((f) => {
        const scale = f.to.width / BASE_CARD_W_PT
        return (
          <motion.div
            key={f.key}
            className="flight"
            style={{ background: CARD_BG }}
            initial={{
              left: f.from.left,
              top: f.from.top,
              width: f.from.width,
              height: f.from.height,
              borderRadius: 10,
              opacity: 0.85,
            }}
            animate={{
              left: f.to.left,
              top: f.to.top,
              width: f.to.width,
              height: f.to.height,
              borderRadius: CARD_RADIUS * scale,
              opacity: 1,
            }}
            transition={{ type: 'spring', visualDuration: 0.45, bounce: 0.18 }}
            onAnimationComplete={() => land(f)}
          />
        )
      })}

      <AnimatePresence>
        {drawer && <CaptureDrawer onClose={() => setDrawer(false)} onCaptured={handleCaptured} />}
      </AnimatePresence>
      <AnimatePresence>
        {holding !== null && lines.length > 0 && (
          <HoldUp
            lines={lines}
            items={itemsById}
            start={holding}
            onClose={() => setHolding(null)}
            onRemove={handleRemove}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
