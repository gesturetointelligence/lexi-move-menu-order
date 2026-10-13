import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { MotionValue } from 'motion/react'

// The Magic button, as CardPager draws it: a 48pt liquid-glass disc centred on
// the card, 12pt off its bottom edge, the armed mode's glyph inside (sparkles
// for Rewrite, translate for Translate). A tap fires the armed mode. Press and
// hold opens the menu, unfurling from the button; picking an item ARMS it
// (Magic's rule: "the menu chooses, the button acts"). This play adds Camera to
// the menu: picking it also swaps the keyboard for the camera, the way a
// language that needs downloading also starts the download.

export const BUTTON_SIZE = 48
export const BUTTON_MARGIN = 12
const HOLD_MS = 400
const MENU_W = 221
const ROW_H = 46
const MENU_RADIUS = 28

export type WandMode = { kind: 'rewrite' } | { kind: 'translate'; lang: string } | { kind: 'camera' }

export const LANGUAGES = [
  'Chinese (Mandarin, Simplified)',
  'French',
  'German',
  'Italian',
  'Japanese',
  'Korean',
  'Spanish',
]

export function Sparkles({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 3.5c.6 3.7 2.3 5.4 6 6-3.7.6-5.4 2.3-6 6-.6-3.7-2.3-5.4-6-6 3.7-.6 5.4-2.3 6-6Z" />
      <path d="M18 14c.3 1.9 1.1 2.7 3 3-1.9.3-2.7 1.1-3 3-.3-1.9-1.1-2.7-3-3 1.9-.3 2.7-1.1 3-3Z" />
      <path d="M18.5 2.5c.2 1.1.7 1.6 1.8 1.8-1.1.2-1.6.7-1.8 1.8-.2-1.1-.7-1.6-1.8-1.8 1.1-.2 1.6-.7 1.8-1.8Z" />
    </svg>
  )
}

export function TranslateGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size * 1.3} height={size} viewBox="0 0 31 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
      <path d="M3 3h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4 3.5V15H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="m6 12 3-7 3 7M7 10h4" />
      <path d="M19 8h9a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-1v3l-3.5-3H19a2 2 0 0 1-2-2v-2" />
      <path d="M20.5 12h7M24 11v1c0 2.5-1.5 4.5-3.5 5.5M22 14.5c1.2 1.5 3 2.6 5 3" />
    </svg>
  )
}

export function CameraGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size * 1.15} height={size} viewBox="0 0 26 22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.5 3h7l1.8 2.6H22a2.5 2.5 0 0 1 2.5 2.5v9.4A2.5 2.5 0 0 1 22 20H4a2.5 2.5 0 0 1-2.5-2.5V8.1A2.5 2.5 0 0 1 4 5.6h3.7Z" />
      <circle cx="13" cy="12.4" r="4.2" />
    </svg>
  )
}

function Chevron({ dir }: { dir: 'right' | 'left' }) {
  return (
    <svg width="9" height="15" viewBox="0 0 9 15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={dir === 'right' ? 'M1.5 1.5 7.5 7.5l-6 6' : 'M7.5 1.5 1.5 7.5l6 6'} />
    </svg>
  )
}

function Check() {
  return (
    <svg width="15" height="13" viewBox="0 0 15 13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m1.5 7 4 4 8-9" />
    </svg>
  )
}

export function glyphFor(mode: WandMode, size = 18) {
  if (mode.kind === 'translate') return <TranslateGlyph size={size} />
  if (mode.kind === 'camera') return <CameraGlyph size={size} />
  return <Sparkles size={size} />
}

interface Props {
  mode: WandMode
  busy: boolean
  opacity: MotionValue<number> | number
  onTap: () => void
  onArm: (mode: WandMode) => void
}

type Row = { key: string; label: string; icon?: React.ReactNode; checked?: boolean; drill?: boolean; back?: boolean; pick: () => void }

export function MagicButton({ mode, busy, opacity, onTap, onArm }: Props) {
  const reduced = useReducedMotion()
  const [open, setOpen] = useState<null | 'main' | 'translate'>(null)
  const [hot, setHot] = useState<string | null>(null)
  const hold = useRef<{ timer: number; opened: boolean; slid: boolean; x: number; y: number } | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const close = () => {
    setOpen(null)
    setHot(null)
  }

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const arm = (m: WandMode) => {
    navigator.vibrate?.(8)
    onArm(m)
    close()
  }

  const mainRows: Row[] = [
    { key: 'rewrite', label: 'Rewrite', icon: <Sparkles size={20} />, checked: mode.kind === 'rewrite', pick: () => arm({ kind: 'rewrite' }) },
    { key: 'translate', label: 'Translate', icon: <TranslateGlyph size={18} />, drill: true, checked: mode.kind === 'translate', pick: () => setOpen('translate') },
    { key: 'camera', label: 'Camera', icon: <CameraGlyph size={18} />, checked: mode.kind === 'camera', pick: () => arm({ kind: 'camera' }) },
  ]
  const langRows: Row[] = [
    { key: 'back', label: 'Translate', back: true, pick: () => setOpen('main') },
    ...LANGUAGES.map((lang) => ({
      key: `t:${lang}`,
      label: lang,
      checked: mode.kind === 'translate' && mode.lang === lang,
      pick: () => arm({ kind: 'translate', lang }),
    })),
  ]
  const rows = open === 'translate' ? langRows : mainRows

  // Hold, slide onto a row, release: an iOS menu commits on release.
  const rowAt = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest('[data-row]') as HTMLElement | null
    return el?.dataset.row ?? null
  }

  return (
    <div className="magic-btn-wrap">
      <motion.button
        type="button"
        className="magic-btn"
        aria-label={mode.kind === 'translate' ? 'Translate' : mode.kind === 'camera' ? 'Camera' : 'Rewrite'}
        aria-haspopup="menu"
        disabled={busy}
        style={{ width: BUTTON_SIZE, height: BUTTON_SIZE, opacity }}
        whileTap={reduced ? undefined : { scale: 0.92 }}
        onPointerDown={(e) => {
          e.stopPropagation()
          // Keep the gesture on the button so hold, slide onto a row, release works.
          e.currentTarget.setPointerCapture(e.pointerId)
          const timer = window.setTimeout(() => {
            if (!hold.current) return
            hold.current.opened = true
            navigator.vibrate?.(10) // the wand menu's own haptic (MAGI-161)
            setOpen('main')
          }, HOLD_MS)
          hold.current = { timer, opened: false, slid: false, x: e.clientX, y: e.clientY }
        }}
        onPointerMove={(e) => {
          const h = hold.current
          if (!h?.opened) return
          if (Math.hypot(e.clientX - h.x, e.clientY - h.y) > 6) h.slid = true
          if (h.slid) setHot(rowAt(e.clientX, e.clientY))
        }}
        onPointerUp={(e) => {
          const h = hold.current
          hold.current = null
          if (!h) return
          clearTimeout(h.timer)
          if (!h.opened) {
            onTap()
            return
          }
          // Released in place: the menu stays open for a tap. Slid onto a row: that row.
          if (h.slid) {
            const key = rowAt(e.clientX, e.clientY)
            rows.find((r) => r.key === key)?.pick()
          }
          setHot(null)
        }}
        onPointerCancel={() => {
          if (hold.current) clearTimeout(hold.current.timer)
          hold.current = null
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {busy ? <span className="magic-spin" /> : glyphFor(mode)}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={menuRef}
            key="menu"
            className="magic-menu"
            role="menu"
            style={{ width: MENU_W, borderRadius: MENU_RADIUS, transformOrigin: '50% calc(100% - 24px)' }}
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.3 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.3, transition: { duration: 0.16 } }}
            transition={reduced ? { duration: 0.01 } : { type: 'spring', visualDuration: 0.32, bounce: 0.22 }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {rows.map((r) => (
              <button
                key={r.key}
                type="button"
                role="menuitem"
                data-row={r.key}
                className={`magic-row${hot === r.key ? ' hot' : ''}${r.back ? ' back' : ''}`}
                style={{ height: ROW_H }}
                onClick={r.pick}
              >
                <span className="magic-row-icon">{r.back ? <Chevron dir="left" /> : r.icon ?? (r.checked ? <Check /> : null)}</span>
                <span className="magic-row-label">{r.label}</span>
                {r.drill && <Chevron dir="right" />}
                {!r.drill && !r.back && r.icon && r.checked && <Check />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
