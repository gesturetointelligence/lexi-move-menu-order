import { useEffect, useRef, useState } from 'react'
import { animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform } from 'motion/react'
import type { MotionValue } from 'motion/react'
import { MagicCard, fitCardText } from './MagicCard'
import { BROWSE_TAIL, GAP } from '../hooks/useGeometry'
import type { Geometry } from '../hooks/useGeometry'
import { CARD_FONT, CARD_FONT_WEIGHT, PAD } from '../lib/textLayout'
import type { Card } from '../lib/types'
import { NEW_THREAD_HOME_SPRING, commitsNewThread } from './NewThreadPreview'

// CardPager v2 (apps/magic-mobile/docs/cardpager-v2.md), in the browser, with
// the capture tray in the keyboard's place. One position (`pos`, the scroll
// offset) and one keyboard progress (`kb`, 0..1) drive everything:
//
//   anchor   = n·step                         the writing surface's slot
//   p        = clamp((pos − anchor)/step)     swipe-up progress past the anchor
//   rise     = draft ? 1 : clamp(p' + 1)      p' = (pos − anchor)/step, unclamped
//   settled  = (draft || n>0) ? 1 − ⅔·kb : 0
//   recede   = draft ? 1 : kb                 an empty card fades WITH the tray
//   editor   = (1 − (1−settled)·p) · rise · recede,  scale 0.92 + 0.08·rise
//   committed i = 1 − ⅔·kb·(1−b) · clamp((pos − i·step)/step),  b = clamp((anchor − pos)/kbH)
//   placeholder = p,  scale 0.92 + 0.08·p
//
// Writing rests at the anchor; browsing rests in [0, browseEnd].

const COMMIT_FRACTION = 0.22
const COMMIT_VELOCITY = 0.9 // pt/ms
const RECALL_DRAG = 90 // tease reaches full opacity
const RECALL_OVERSCROLL = 144
const RECALL_FLICK_PAST = 48
const RECALL_VELOCITY = 1.2
const BROWSE_BUFFER = 12
const BROWSE_BOTTOM_MARGIN = 2 * GAP + BROWSE_TAIL + BROWSE_BUFFER
export const KB_TIMING = { duration: 0.3, ease: [0.38, 0.7, 0.125, 1] as const } // the iOS keyboard curve
const TIMING = { duration: 0.3, ease: [0.33, 1, 0.68, 1] as const } // Easing.out(cubic)
const DISSOLVE_MS = 420
const LONG_PRESS_MS = 500
const DOUBLE_TAP_MS = 300

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** UIKit-style rubber band past an edge. */
function rubber(excess: number, dim: number) {
  return (1 - 1 / ((excess * 0.55) / dim + 1)) * dim
}

interface Props {
  g: Geometry
  cards: Card[] // committed
  active: Card // the writing surface
  writing: boolean // tray up
  kb: MotionValue<number>
  hideActiveText: boolean // a word is in flight onto the writing surface
  dismissBlocked: boolean // lone empty card on a fresh thread
  newX: MotionValue<number> // the new-thread layer: rests at the screen width, 0 = covering
  onNewThread: () => void
  onCommit: () => void
  onDismiss: () => void
  onRecall: () => void
  onEdit: (id: string, text: string) => void
  onDelete: (id: string) => void
  onMenu: (id: string) => void
  onPresent: (id: string) => void
  dissolving: string | null
  onDissolved: (id: string) => void
}

export function CardCanvas(props: Props) {
  const { g, cards, active, writing, kb } = props
  const reduced = useReducedMotion()
  const n = cards.length
  const anchor = n * g.step
  const kbH = g.trayBlock
  const draft = !!active.text && !props.hideActiveText
  const browseEnd = n === 0 ? 0 : Math.max(0, g.topY + (n - 1) * g.step + g.cardH - g.vh + BROWSE_BOTTOM_MARGIN)

  const pos = useMotionValue(anchor)
  const anim = useRef<{ stop: () => void } | null>(null)
  const to = (target: number, t: object = TIMING) => {
    anim.current?.stop()
    anim.current = reduced ? (pos.set(target), null) : animate(pos, target, t)
  }

  // Keep live values in a ref for the gesture handlers.
  const live = useRef({ anchor, browseEnd, writing, draft, n, dismissBlocked: props.dismissBlocked })
  live.current = { anchor, browseEnd, writing, draft, n, dismissBlocked: props.dismissBlocked }

  // ---- Rest targets: every mode change and every commit names its rest ----
  const prev = useRef({ writing, n })
  useEffect(() => {
    const was = prev.current
    prev.current = { writing, n }
    if (writing && !was.writing) to(anchor, KB_TIMING) // recall: glide on the tray's clock
    else if (writing && n !== was.n) to(anchor) // commit: the anchor moves one step
    else if (!writing) {
      // Browsing's only rest region is [0, browseEnd]: the dismissal glide, or a card deleted under the end.
      const at = pos.get()
      if (at > browseEnd) to(browseEnd)
      else if (at < 0) to(0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [writing, n, anchor, browseEnd])

  // ---- Drag: one gesture engine for both modes ----
  const drag = useRef<{
    id: number
    x0: number
    axis: 'x' | 'y' | null
    lastX: { t: number; x: number }[]
    y0: number
    pos0: number
    last: { t: number; y: number }[]
    moved: boolean
    minPos: number
    armed: boolean
    trayFollow: boolean
  } | null>(null)
  const [tease, setTease] = useState(false)

  const velocity = () => {
    const s = drag.current?.last ?? []
    if (s.length < 2) return 0
    const a = s[0]
    const b = s[s.length - 1]
    return (b.y - a.y) / Math.max(1, b.t - a.t) // pt/ms, +down
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (!e.isPrimary || drag.current) return
    anim.current?.stop()
    const L = live.current
    drag.current = {
      id: e.pointerId,
      x0: e.clientX,
      axis: null,
      lastX: [{ t: e.timeStamp, x: e.clientX }],
      y0: e.clientY,
      pos0: pos.get(),
      last: [{ t: e.timeStamp, y: e.clientY }],
      moved: false,
      minPos: pos.get(),
      // The tease and recall are armed only by a drag that starts inside browse's rest region.
      armed: !L.writing && pos.get() <= L.browseEnd + 4,
      trayFollow: false,
    }
    setTease(drag.current.armed)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  const onMove = (e: PointerEvent) => {
    const d = drag.current
    if (!d || e.pointerId !== d.id) return
    const dy = e.clientY - d.y0
    const dx = e.clientX - d.x0
    if (!d.moved && Math.hypot(dx, dy) < 6) return
    d.moved = true
    // One pan, two axes, as in Magic: horizontal is the new-thread swipe, vertical the cards.
    if (!d.axis) d.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
    if (d.axis === 'x') {
      d.lastX.push({ t: e.timeStamp, x: e.clientX })
      if (d.lastX.length > 5) d.lastX.shift()
      props.newX.set(Math.min(g.colW, Math.max(0, g.colW + Math.min(0, dx))))
      return
    }
    d.last.push({ t: e.timeStamp, y: e.clientY })
    if (d.last.length > 5) d.last.shift()
    const L = live.current
    let next = d.pos0 - dy
    if (L.writing) {
      // Writing overscroll is capped at half a card, then rubber-bands.
      const cap = L.anchor + g.step / 2
      if (next > cap) next = cap + rubber(next - cap, g.step)
      if (next < 0) next = -rubber(-next, g.vh)
      // Interactive dismiss: once the finger crosses the tray's top edge, the tray follows it.
      const trayTop = g.vh - kbH
      const y = e.clientY - g.oy
      if (!L.dismissBlocked && y > trayTop) {
        d.trayFollow = true
        kb.set(clamp01(1 - (y - trayTop) / kbH))
      } else if (d.trayFollow) kb.set(1)
    } else {
      if (next < 0) next = -rubber(-next, g.vh)
      if (next > L.browseEnd) next = L.browseEnd + rubber(next - L.browseEnd, g.vh)
    }
    d.minPos = Math.min(d.minPos, next)
    pos.set(next)
  }

  const onUp = (e: PointerEvent) => {
    const d = drag.current
    if (!d || e.pointerId !== d.id) return
    drag.current = null
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
    if (!d.moved) return
    if (d.axis === 'x') {
      const a = d.lastX[0]
      const z = d.lastX[d.lastX.length - 1]
      const vx = ((z.x - a.x) / Math.max(1, z.t - a.t)) * 1000 // px/s
      if (commitsNewThread(g.colW - props.newX.get(), g.colW, vx)) props.onNewThread()
      else animate(props.newX, g.colW, NEW_THREAD_HOME_SPRING)
      return
    }
    const L = live.current
    const vy = velocity() // +down
    const at = pos.get()

    if (L.writing) {
      if (d.trayFollow && kb.get() < 1) {
        if (vy > 0.3 || kb.get() < 0.5) props.onDismiss()
        else animate(kb, 1, KB_TIMING)
        if (at > L.anchor) to(L.anchor)
        return
      }
      const p = (at - L.anchor) / g.step
      const browsedDown = d.minPos < L.anchor - 0.25 * g.step
      if (browsedDown) {
        if (at > L.anchor) to(L.anchor)
        else if (at < 0) to(0)
        return
      }
      if (p >= COMMIT_FRACTION || -vy > COMMIT_VELOCITY) {
        if (L.draft) {
          navigator.vibrate?.(10)
          props.onCommit() // the anchor moves +step; the rest effect glides there
        } else {
          // Dispose: the blank placeholder at p=1 is pixel-identical to the blank editor at the anchor.
          anim.current?.stop()
          const c = animate(pos, L.anchor + g.step, TIMING)
          anim.current = c
          c.then(() => pos.set(live.current.anchor))
        }
        return
      }
      to(L.anchor)
      return
    }

    // Browsing.
    const past = at - L.browseEnd
    if (d.armed && (past > RECALL_OVERSCROLL || (past > RECALL_FLICK_PAST && -vy > RECALL_VELOCITY))) {
      props.onRecall()
      return
    }
    setTease(false)
    anim.current?.stop()
    anim.current = animate(pos, at, {
      type: 'inertia',
      velocity: -vy * 1000,
      min: 0,
      max: L.browseEnd,
      power: 0.8,
      timeConstant: 325,
      bounceStiffness: 300,
      bounceDamping: 32,
    })
  }

  useEffect(
    () => () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  // Desktop: wheel scrolls in browse; a trackpad pinch presents.
  const rootRef = useRef<HTMLDivElement | null>(null)
  const wheelScale = useRef(1)
  const wheelPull = useRef(0)
  const swipeX = useRef(0)
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (e.ctrlKey) {
        wheelScale.current *= Math.exp(-e.deltaY / 100)
        if (wheelScale.current > 1.1) {
          wheelScale.current = 1
          presentAt(e.clientY)
        } else if (wheelScale.current < 0.9) wheelScale.current = 1
        return
      }
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        // A trackpad's two-finger swipe left is the new-thread swipe.
        swipeX.current = e.deltaX > 0 ? swipeX.current + e.deltaX : 0
        if (swipeX.current > 120) {
          swipeX.current = 0
          props.onNewThread()
        }
        return
      }
      if (live.current.writing) {
        // A trackpad's scroll-down is the drag-down: past a notch, the drawer goes.
        wheelPull.current = e.deltaY < 0 ? wheelPull.current - e.deltaY : 0
        if (wheelPull.current > 80 && !live.current.dismissBlocked) {
          wheelPull.current = 0
          props.onDismiss()
        }
        return
      }
      anim.current?.stop()
      pos.set(Math.min(live.current.browseEnd, Math.max(0, pos.get() + e.deltaY)))
    }
    const stop = (e: Event) => e.preventDefault()
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('gesturestart', stop)
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('gesturestart', stop)
    }
  })

  // Two-finger pinch out presents the card under the fingers.
  const touches = useRef(new Map<number, { x: number; y: number }>())
  const pinch0 = useRef<number | null>(null)
  const presentAt = (clientY: number) => {
    const idx = Math.floor((clientY - g.oy - g.topY + pos.get()) / g.step)
    const all = live.current.writing ? [...cards, active] : cards
    const card = all[Math.min(Math.max(idx, 0), all.length - 1)]
    if (card?.text) props.onPresent(card.id)
  }

  // Strip position, and the tease overlay pinned to the editor's slot.
  const stripY = useTransform(pos, (v) => -v)
  const teaseOpacity = useTransform(pos, (v) => (tease ? clamp01((v - browseEnd) / RECALL_DRAG) : 0))
  const teaseScale = useTransform(teaseOpacity, (o) => 0.94 + 0.06 * o)
  const teaseTop = useTransform(pos, (v) => g.topY + n * g.step - v)
  useMotionValueEvent(kb, 'change', (v) => {
    if (v >= 0.999 && tease) setTease(false)
  })

  const [editing, setEditing] = useState<string | null>(null)

  return (
    <div
      ref={rootRef}
      className="canvas"
      onPointerDown={(e) => {
        touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
        if (touches.current.size === 2) {
          const [a, b] = [...touches.current.values()]
          pinch0.current = Math.hypot(a.x - b.x, a.y - b.y)
          return
        }
        onPointerDown(e)
      }}
      onPointerMove={(e) => {
        if (!touches.current.has(e.pointerId)) return
        touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
        if (pinch0.current && touches.current.size === 2) {
          const [a, b] = [...touches.current.values()]
          if (Math.hypot(a.x - b.x, a.y - b.y) / pinch0.current > 1.1) {
            pinch0.current = null
            presentAt((a.y + b.y) / 2)
          }
        }
      }}
      onPointerUp={(e) => {
        touches.current.delete(e.pointerId)
        if (touches.current.size < 2) pinch0.current = null
      }}
      onPointerCancel={(e) => {
        touches.current.delete(e.pointerId)
        pinch0.current = null
      }}
    >
      <motion.div className="strip" style={{ y: stripY, paddingTop: g.topY, paddingLeft: GAP, paddingRight: GAP }}>
        {cards.map((c, i) => (
          <CommittedSlot key={c.id} card={c} i={i} {...slotShared(props, i, editing, setEditing, reduced)} pos={pos} />
        ))}
        {/* The writing surface, and the blank placeholder that rises behind a commit. */}
        <EditorSlot key={active.id} {...props} pos={pos} draft={draft} editing={editing} setEditing={setEditing} />
        {writing && <PlaceholderSlot g={g} pos={pos} anchor={anchor} />}
      </motion.div>

      {!writing && n > 0 && (
        <>
          {/* Recall tease: a full card rising past the end, following the finger. */}
          <motion.div
            className="tease"
            aria-hidden="true"
            style={{ top: teaseTop, left: GAP, opacity: teaseOpacity, scale: teaseScale }}
          >
            <MagicCard text="" width={g.cardW} height={g.cardH} />
          </motion.div>
          {/* Short thread, no scroll range: a transparent tap zone to add a card. */}
          {browseEnd <= 0 && (
            <button
              type="button"
              className="add-zone"
              aria-label="New card"
              style={{ bottom: g.safeBottom + BROWSE_BUFFER }}
              onClick={props.onRecall}
            />
          )}
        </>
      )}
    </div>
  )
}

// ---- Slots ----

function slotShared(
  p: Props,
  _i: number,
  editing: string | null,
  setEditing: (id: string | null) => void,
  reduced: boolean | null,
) {
  return { g: p.g, kb: p.kb, n: p.cards.length, p, editing, setEditing, reduced: !!reduced }
}

function CommittedSlot({
  card,
  i,
  g,
  kb,
  n,
  pos,
  p,
  editing,
  setEditing,
  reduced,
}: {
  card: Card
  i: number
  g: Geometry
  kb: MotionValue<number>
  n: number
  pos: MotionValue<number>
  p: Props
  editing: string | null
  setEditing: (id: string | null) => void
  reduced: boolean
}) {
  const anchor = n * g.step
  const opacity = useTransform([pos, kb], ([v, k]: number[]) => {
    const b = clamp01((anchor - v) / g.trayBlock)
    const settledC = 1 - (2 / 3) * k * (1 - b)
    const pLive = clamp01((v - i * g.step) / g.step)
    return 1 - (1 - settledC) * pLive
  })
  return (
    <Slot
      id={card.id}
      text={card.text}
      g={g}
      opacity={opacity}
      editing={editing === card.id}
      dissolving={p.dissolving === card.id}
      reduced={reduced}
      onDoubleTap={() => setEditing(card.id)}
      onLongPress={() => p.onMenu(card.id)}
      onEditDone={(t) => {
        setEditing(null)
        if (t.trim()) p.onEdit(card.id, t)
        else p.onDelete(card.id)
      }}
      onDissolved={() => p.onDissolved(card.id)}
    />
  )
}

function EditorSlot(
  props: Props & {
    pos: MotionValue<number>
    draft: boolean
    editing: string | null
    setEditing: (id: string | null) => void
  },
) {
  const { g, cards, active, kb, pos, draft } = props
  const n = cards.length
  const anchor = n * g.step
  const opacity = useTransform([pos, kb], ([v, k]: number[]) => {
    const pp = clamp01((v - anchor) / g.step)
    const rise = draft ? 1 : clamp01((v - anchor) / g.step + 1)
    const settled = draft || n > 0 ? 1 - (2 / 3) * k : 0
    const recede = draft ? 1 : k
    return (1 - (1 - settled) * pp) * rise * recede
  })
  const scale = useTransform(pos, (v) => 0.92 + 0.08 * (draft ? 1 : clamp01((v - anchor) / g.step + 1)))
  const reduced = useReducedMotion()
  return (
    <Slot
      id={active.id}
      text={props.hideActiveText ? '' : active.text}
      g={g}
      opacity={opacity}
      scale={scale}
      caret={!active.text}
      editing={props.editing === active.id}
      dissolving={props.dissolving === active.id}
      reduced={!!reduced}
      onDoubleTap={() => active.text && props.setEditing(active.id)}
      onLongPress={() => active.text && props.onMenu(active.id)}
      onEditDone={(t) => {
        props.setEditing(null)
        if (t.trim()) props.onEdit(active.id, t)
        else props.onDelete(active.id)
      }}
      onDissolved={() => props.onDissolved(active.id)}
    />
  )
}

function PlaceholderSlot({ g, pos, anchor }: { g: Geometry; pos: MotionValue<number>; anchor: number }) {
  const pp = useTransform(pos, (v) => clamp01((v - anchor) / g.step))
  const scale = useTransform(pp, (v) => 0.92 + 0.08 * v)
  return (
    <motion.div className="slot" style={{ height: g.cardH, marginBottom: GAP, opacity: pp, scale }} aria-hidden="true">
      <MagicCard text="" width={g.cardW} height={g.cardH} caret />
    </motion.div>
  )
}

interface SlotProps {
  id: string
  text: string
  g: Geometry
  opacity: MotionValue<number>
  scale?: MotionValue<number>
  caret?: boolean
  editing: boolean
  dissolving: boolean
  reduced: boolean
  onDoubleTap: () => void
  onLongPress: () => void
  onEditDone: (text: string) => void
  onDissolved: () => void
}

function Slot({ id, text, g, opacity, scale, caret, editing, dissolving, reduced, ...on }: SlotProps) {
  const press = useRef<{ x: number; y: number; timer: number; long: boolean } | null>(null)
  const lastTap = useRef(0)

  return (
    <motion.div className="slot" data-slot={id} style={{ height: g.cardH, marginBottom: GAP, opacity, scale }}>
      <motion.div
        animate={dissolving ? { opacity: 0, scale: 0.88 } : { opacity: 1, scale: 1 }}
        transition={reduced ? { duration: 0 } : { duration: DISSOLVE_MS / 1000, ease: 'easeOut' }}
        onAnimationComplete={() => dissolving && on.onDissolved()}
        onPointerDown={(e) => {
          if (!e.isPrimary) return
          const timer = window.setTimeout(() => {
            if (!press.current) return
            press.current.long = true
            navigator.vibrate?.(15)
            on.onLongPress()
          }, LONG_PRESS_MS)
          press.current = { x: e.clientX, y: e.clientY, timer, long: false }
        }}
        onPointerMove={(e) => {
          const pr = press.current
          if (pr && Math.hypot(e.clientX - pr.x, e.clientY - pr.y) > 8) {
            clearTimeout(pr.timer)
            press.current = null
          }
        }}
        onPointerUp={() => {
          const pr = press.current
          press.current = null
          if (!pr) return
          clearTimeout(pr.timer)
          if (pr.long) return
          const now = performance.now()
          if (now - lastTap.current < DOUBLE_TAP_MS) {
            lastTap.current = 0
            on.onDoubleTap()
          } else lastTap.current = now
        }}
        onPointerCancel={() => {
          if (press.current) clearTimeout(press.current.timer)
          press.current = null
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <MagicCard text={editing ? '' : text} width={g.cardW} height={g.cardH} caret={caret && !editing}>
          {editing && <CardEditor initial={text} width={g.cardW} height={g.cardH} onDone={on.onEditDone} />}
        </MagicCard>
      </motion.div>
    </motion.div>
  )
}

/** Edit in place: the card's own words, refitted on every keystroke like the app. */
function CardEditor({ initial, width, height, onDone }: { initial: string; width: number; height: number; onDone: (t: string) => void }) {
  const [value, setValue] = useState(initial)
  const ref = useRef<HTMLTextAreaElement | null>(null)
  const done = useRef(false)
  const finish = (t: string) => {
    if (done.current) return
    done.current = true
    onDone(t)
  }
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [])
  const fit = fitCardText(value || 'M', width, height)
  return (
    <textarea
      ref={ref}
      className="card-editor"
      value={value}
      aria-label="Edit card"
      onPointerDown={(e) => e.stopPropagation()}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => finish(value)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') finish(initial)
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          ref.current?.blur()
        }
      }}
      style={{
        inset: PAD,
        width: width - 2 * PAD,
        fontFamily: CARD_FONT,
        fontWeight: CARD_FONT_WEIGHT,
        fontSize: fit.fontSize,
        lineHeight: `${fit.lineHeight}px`,
      }}
    />
  )
}
