import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from 'motion/react'

import { CaptureTray } from './components/CaptureTray'
import type { ReadSource } from './components/CaptureTray'
import { CardCanvas, KB_TIMING } from './components/CardCanvas'
import { CardMenu } from './components/CardMenu'
import { CARD_INK, fitCardText } from './components/MagicCard'
import { Present } from './components/Present'
import type { Rect } from './components/Present'
import { GAP, useGeometry } from './hooks/useGeometry'
import { MenuReadError, readMenu } from './lib/readMenu'
import type { ReadError } from './lib/readMenu'
import { drawSampleMenu } from './lib/sampleMenu'
import { CARD_FONT, CARD_FONT_WEIGHT, PAD } from './lib/textLayout'
import type { Card, MenuItem, Photo } from './lib/types'

const ERRORS: Record<ReadError, string> = {
  'no-server': 'Reading needs the dev server. Try Sample.',
  'no-key': 'Add ANTHROPIC_API_KEY to .env.local',
  'bad-key': 'The API key was not accepted',
  'rate-limit': 'Busy. Try again in a moment',
  refusal: 'This photo could not be read',
  'api-error': 'The read did not finish. Try again',
  'nothing-found': 'No items found. Try a closer photo',
}

let nextId = 0
const newId = () => `c${++nextId}`

interface Flight {
  key: number
  cardId: string
  lines: string[]
  fontSize: number
  lineHeight: number
  from: DOMRect
}

export default function App() {
  const g = useGeometry()
  const reduced = useReducedMotion()
  const colLeft = (window.innerWidth - g.colW) / 2

  // The tray is the keyboard: `writing` flips at the start of a rise or a fall
  // (keyboardWillShow / WillHide), `kb` is its live progress.
  const [writing, setWriting] = useState(true)
  const kb = useMotionValue(1)
  const [photo, setPhoto] = useState<Photo | null>(null)
  const [source, setSource] = useState<ReadSource | null>(null)
  const [items, setItems] = useState<MenuItem[]>([])
  const [reading, setReading] = useState(false)
  const [error, setError] = useState<ReadError | null>(null)

  const [cards, setCards] = useState<Card[]>([])
  const [active, setActive] = useState<Card>(() => ({ id: newId(), text: '' }))
  const [flights, setFlights] = useState<Flight[]>([])
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [dissolving, setDissolving] = useState<string | null>(null)
  const [present, setPresent] = useState<number | null>(null)
  const [toast, setToast] = useState<{ key: number; text: string } | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const flightKey = useRef(0)

  const shown = (writing ? [...cards, active] : cards).filter((c) => c.text)
  const dismissBlocked = cards.length === 0 && !active.text

  // ---- Reading the menu ----
  const start = useCallback(
    (next: Photo, src: ReadSource, run: (signal: AbortSignal, add: (i: MenuItem) => void) => Promise<void>) => {
      abortRef.current?.abort()
      const ac = new AbortController()
      abortRef.current = ac
      setPhoto(next)
      setSource(src)
      setItems([])
      setError(null)
      setReading(true)
      run(ac.signal, (item) => !ac.signal.aborted && setItems((prev) => [...prev, item]))
        .catch((err) => {
          if (!ac.signal.aborted) setError(err instanceof MenuReadError ? err.code : 'api-error')
        })
        .finally(() => !ac.signal.aborted && setReading(false))
    },
    [],
  )

  const handlePhoto = useCallback(
    (p: Photo) => start(p, 'cloud', (signal, add) => readMenu(p, add, signal)),
    [start],
  )

  const handleSample = useCallback(() => {
    const { photo: p, items: sample } = drawSampleMenu()
    start(p, 'sample', async (signal, add) => {
      const wait = (ms: number) =>
        new Promise<void>((res, rej) => {
          const t = setTimeout(res, ms)
          signal.addEventListener('abort', () => {
            clearTimeout(t)
            rej(new DOMException('aborted', 'AbortError'))
          })
        })
      await wait(reduced ? 0 : 1200)
      for (const item of sample) {
        add(item)
        await wait(reduced ? 0 : 110)
      }
    })
  }, [start, reduced])

  const handleRetake = useCallback(() => {
    abortRef.current?.abort()
    setPhoto(null)
    setSource(null)
    setItems([])
    setReading(false)
    setError(null)
  }, [])

  useEffect(() => () => abortRef.current?.abort(), [])

  // ---- A tap on the menu writes the card ----
  const handleTapItem = useCallback(
    (item: MenuItem, from: DOMRect) => {
      navigator.vibrate?.(10)
      const text = item.name
      let cardId = active.id
      if (active.text) {
        // A commit: the card that's up goes to 1/3 above, a new card rises in
        // its place, and the printed words land on it.
        setCards((prev) => [...prev, active])
        cardId = newId()
      }
      setActive({ id: cardId, text })
      if (reduced) return
      const fit = fitCardText(text, g.cardW, g.cardH)
      flightKey.current += 1
      setFlights((f) => [
        ...f,
        { key: flightKey.current, cardId, lines: fit.lines, fontSize: fit.fontSize, lineHeight: fit.lineHeight, from },
      ])
    },
    [active, reduced, g.cardW, g.cardH],
  )

  // ---- Swipe-up commit: the card goes, a blank one rises ----
  const handleCommit = useCallback(() => {
    if (!active.text) return
    setCards((prev) => [...prev, active])
    setActive({ id: newId(), text: '' })
  }, [active])

  // ---- The tray, like the keyboard ----
  const dismissTray = useCallback(() => {
    if (cards.length === 0 && !active.text) {
      animate(kb, 1, KB_TIMING) // a lone empty card has no browse state
      return
    }
    // Leaving writing commits a card with text (MAGI-111); an empty one just recedes.
    if (active.text) {
      setCards((prev) => [...prev, active])
      setActive({ id: newId(), text: '' })
    }
    setWriting(false)
    animate(kb, 0, KB_TIMING)
  }, [active, cards.length, kb])

  const recallTray = useCallback(() => {
    setWriting(true)
    animate(kb, 1, KB_TIMING)
  }, [kb])

  // ---- Card actions ----
  const cardText = (id: string) => (id === active.id ? active.text : cards.find((c) => c.id === id)?.text ?? '')

  const handleEdit = useCallback(
    (id: string, text: string) => {
      if (id === active.id) setActive((a) => ({ ...a, text }))
      else setCards((prev) => prev.map((c) => (c.id === id ? { ...c, text } : c)))
    },
    [active.id],
  )

  const handleDissolved = useCallback(
    (id: string) => {
      setDissolving(null)
      if (id === active.id) setActive({ id: newId(), text: '' })
      else setCards((prev) => prev.filter((c) => c.id !== id))
    },
    [active.id],
  )

  const showToast = (text: string) => setToast({ key: Date.now(), text })
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 1600)
    return () => clearTimeout(t)
  }, [toast])

  const rectOf = (i: number): Rect => {
    const id = shown[i]?.id
    const el = id ? document.querySelector(`[data-slot="${id}"]`) : null
    const r = el?.getBoundingClientRect()
    if (!r) return { left: colLeft + GAP, top: g.topY, width: g.cardW, height: g.cardH }
    const top = Math.min(Math.max(r.top, g.topY), g.vh - g.cardH - GAP)
    return { left: r.left, top, width: r.width, height: r.height }
  }

  const status = error ? ERRORS[error] : null

  return (
    <div className="phone" style={{ width: g.colW }}>
      <CardCanvas
        g={g}
        cards={cards}
        active={active}
        writing={writing}
        kb={kb}
        hideActiveText={flights.some((f) => f.cardId === active.id)}
        dismissBlocked={dismissBlocked}
        onCommit={handleCommit}
        onDismiss={dismissTray}
        onRecall={recallTray}
        onEdit={handleEdit}
        onDelete={(id) => setDissolving(id)}
        onMenu={(id) => setMenuFor(id)}
        onPresent={(id) => {
          const i = shown.findIndex((c) => c.id === id)
          if (i >= 0) setPresent(i)
        }}
        dissolving={dissolving}
        onDissolved={handleDissolved}
      />

      <CaptureTray
        width={g.colW}
        height={g.trayBlock}
        safeBottom={g.safeBottom}
        kb={kb}
        live={writing}
        dismissBlocked={dismissBlocked}
        photo={photo}
        source={source}
        items={items}
        reading={reading}
        note={status}
        onPhoto={handlePhoto}
        onSample={handleSample}
        onRetake={handleRetake}
        onTapItem={handleTapItem}
        onDismiss={dismissTray}
      />

      {/* The printed words lift off the menu and settle onto the card. */}
      {flights.map((f) => {
        const s0 = Math.min(1, (f.from.height * 0.62) / f.lineHeight)
        return (
          <motion.div
            key={f.key}
            className="flight"
            style={{
              fontFamily: CARD_FONT,
              fontWeight: CARD_FONT_WEIGHT,
              fontSize: f.fontSize,
              lineHeight: `${f.lineHeight}px`,
              color: CARD_INK,
              width: g.cardW - 2 * PAD,
              transformOrigin: '0% 0%',
            }}
            initial={{
              left: f.from.left + 8,
              top: f.from.top + (f.from.height - f.lineHeight * s0) / 2,
              scale: s0,
              opacity: 0.6,
            }}
            animate={{ left: colLeft + GAP + PAD, top: g.topY + PAD, scale: 1, opacity: 1 }}
            transition={{ type: 'spring', visualDuration: 0.5, bounce: 0.15 }}
            onAnimationComplete={() => setFlights((all) => all.filter((x) => x.key !== f.key))}
          >
            {f.lines.map((line, i) => (
              <div key={i} className="magic-line">
                {line}
              </div>
            ))}
          </motion.div>
        )
      })}

      <AnimatePresence>
        {present !== null && shown.length > 0 && (
          <Present
            key="present"
            g={g}
            texts={shown.map((s) => s.text)}
            index={Math.min(present, shown.length - 1)}
            colLeft={colLeft}
            rectOf={rectOf}
            onIndex={setPresent}
            onClose={() => setPresent(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {menuFor && (
          <CardMenu
            onCancel={() => setMenuFor(null)}
            onCopy={() => {
              navigator.clipboard?.writeText(cardText(menuFor)).catch(() => {})
              setMenuFor(null)
              showToast('Copied.')
            }}
            onShare={() => {
              const text = cardText(menuFor)
              setMenuFor(null)
              if (navigator.share) navigator.share({ text }).catch(() => {})
              else {
                navigator.clipboard?.writeText(text).catch(() => {})
                showToast('Copied.')
              }
            }}
            onDelete={() => {
              setDissolving(menuFor)
              setMenuFor(null)
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.key}
            className="toast"
            role="status"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
          >
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
