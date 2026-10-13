import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, animate, motion, useReducedMotion, useTransform } from 'motion/react'
import type { MotionValue } from 'motion/react'
import { KB_TIMING } from './CardCanvas'
import { Keyboard } from './Keyboard'
import type { KeyAction } from './Keyboard'
import { useCamera } from '../hooks/useCamera'
import { downscale } from '../lib/readMenu'
import type { MenuItem, Photo } from '../lib/types'

// Colour Capture's tray (components/ColourCaptureTray.tsx in Magic), working
// like the keyboard: docked at the bottom, its height is what the card stack
// sizes against, and its progress `kb` (0..1) is the same value the cards fade
// on. It STAYS UP while you tap the menu; it goes when you drag the card or the
// tray down, and comes back with a pull past the end of the thread.

function CameraGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  )
}

function PhotosGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
      <circle cx="9" cy="10" r="1.7" />
      <path d="m4 17.5 4.5-4.5 3.5 3.5 3.5-3.5 4.5 4.5" />
    </svg>
  )
}

function CloudGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
    </svg>
  )
}

export type ReadSource = 'cloud' | 'sample'

interface Props {
  width: number
  height: number // docked height, home indicator included
  safeBottom: number
  kb: MotionValue<number>
  live: boolean // tray is up: camera may run
  input: 'keyboard' | 'camera' // what the drawer holds, like an input view: same height either way
  autoCaps: boolean
  onKey: (a: KeyAction) => void
  dismissBlocked: boolean
  photo: Photo | null
  source: ReadSource | null
  items: MenuItem[]
  reading: boolean
  note: string | null
  onPhoto: (photo: Photo) => void
  onSample: () => void
  onRetake: () => void
  onTapItem: (item: MenuItem, from: DOMRect) => void
  onDismiss: () => void
}

export function CaptureTray(props: Props) {
  const { width, height, safeBottom, kb, photo, source, items, reading, note } = props
  const reduced = useReducedMotion()
  const y = useTransform(kb, (v) => (1 - v) * height)
  const visibility = useTransform(kb, (v) => (v <= 0.001 ? 'hidden' : 'visible'))
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const drag = useRef<{ startY: number; scroll0: number; mode: 'none' | 'dismiss' | 'scroll'; last: { t: number; y: number }[] } | null>(null)
  const camera = props.input === 'camera'
  const { videoRef, status, error } = useCamera(camera && !photo && props.live)
  const [flash, setFlash] = useState(0)

  // Drag the tray down (from the top of its content) and it follows the finger,
  // like an interactive keyboard dismiss. A lone empty card can't be dismissed.
  // Touch is handled natively so the browser can't claim the swipe as a scroll.
  const rootRef = useRef<HTMLDivElement | null>(null)
  const dragged = useRef(false) // a scroll or dismiss drag must not also tap an item
  const live = useRef(props)
  live.current = props
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    // The drawer owns its gestures: a pull down from the top is the dismiss,
    // anything else scrolls the photo (with momentum). The browser never pans it.
    let fling: { stop: () => void } | null = null
    const body = () => scrollRef.current
    const begin = (y: number) => {
      // The keyboard itself can't be dragged away; the cards (or Dismiss) take it down.
      if (live.current.input === 'keyboard') return
      fling?.stop()
      dragged.current = false
      drag.current = { startY: y, scroll0: body()?.scrollTop ?? 0, mode: 'none', last: [{ t: performance.now(), y }] }
    }
    const move = (y: number, e: Event) => {
      const d = drag.current
      if (!d) return
      const dy = y - d.startY
      d.last.push({ t: performance.now(), y })
      if (d.last.length > 5) d.last.shift()
      if (d.mode === 'none') {
        if (Math.abs(dy) < 4) return
        d.mode = dy > 0 && d.scroll0 <= 0 ? 'dismiss' : 'scroll'
        dragged.current = true
      }
      e.preventDefault()
      const P = live.current
      if (d.mode === 'scroll') {
        const el = body()
        if (el) el.scrollTop = d.scroll0 - dy
        return
      }
      const free = Math.max(0, dy)
      P.kb.set(1 - (P.dismissBlocked ? Math.min(free, 24) * 0.3 : free) / P.height)
    }
    const end = () => {
      const d = drag.current
      drag.current = null
      if (!d || d.mode === 'none') return
      const P = live.current
      if (d.mode === 'dismiss') {
        if (!P.dismissBlocked && P.kb.get() < 0.75) P.onDismiss()
        else animate(P.kb, 1, KB_TIMING)
        return
      }
      const el = body()
      const a = d.last[0]
      const z = d.last[d.last.length - 1]
      const v = (z.y - a.y) / Math.max(1, z.t - a.t) // px/ms, +down
      if (!el || Math.abs(v) < 0.05) return
      fling = animate(el.scrollTop, el.scrollTop - v * 325, {
        type: 'inertia',
        velocity: -v * 1000,
        min: 0,
        max: el.scrollHeight - el.clientHeight,
        power: 0.8,
        timeConstant: 325,
        onUpdate: (top: number) => {
          el.scrollTop = top
        },
      })
    }
    const ts = (e: TouchEvent) => begin(e.touches[0].clientY)
    const tm = (e: TouchEvent) => move(e.touches[0].clientY, e)
    const md = (e: PointerEvent) => e.pointerType === 'mouse' && begin(e.clientY)
    const mm = (e: PointerEvent) => e.pointerType === 'mouse' && move(e.clientY, e)
    const mu = (e: PointerEvent) => e.pointerType === 'mouse' && end()
    el.addEventListener('touchstart', ts, { passive: true })
    el.addEventListener('touchmove', tm, { passive: false })
    el.addEventListener('touchend', end)
    el.addEventListener('touchcancel', end)
    el.addEventListener('pointerdown', md)
    window.addEventListener('pointermove', mm)
    window.addEventListener('pointerup', mu)
    return () => {
      el.removeEventListener('touchstart', ts)
      el.removeEventListener('touchmove', tm)
      el.removeEventListener('touchend', end)
      el.removeEventListener('touchcancel', end)
      el.removeEventListener('pointerdown', md)
      window.removeEventListener('pointermove', mm)
      window.removeEventListener('pointerup', mu)
    }
  }, [])
  const swallowClickAfterDrag = (e: React.MouseEvent) => {
    if (kb.get() < 1 || dragged.current) {
      e.stopPropagation()
      e.preventDefault()
    }
  }

  const shoot = () => {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    navigator.vibrate?.(10)
    setFlash((n) => n + 1)
    try {
      props.onPhoto(downscale(v))
    } catch {
      // Frame not readable yet; the shutter can simply be pressed again.
    }
  }

  const pickFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') return
      const img = new Image()
      img.onload = () => props.onPhoto(downscale(img))
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  }

  const innerW = width
  const photoH = photo ? (innerW * photo.height) / photo.width : 0

  const status_ = photo
    ? reading
      ? source === 'cloud'
        ? 'Reading in the cloud'
        : 'Reading'
      : items.length
        ? 'Tap to select'
        : ''
    : ''

  return (
    <motion.div
      className="tray"
      role="dialog"
      aria-label="Menu"
      ref={rootRef}
      style={{ width, height, paddingBottom: safeBottom, y, visibility }}
      onClickCapture={swallowClickAfterDrag}
    >
      {!camera ? (
        <Keyboard autoCaps={props.autoCaps} onKey={props.onKey} />
      ) : (
        <>
      {photo && (
        <div className="tray-head">
          <span className="tray-status" aria-live="polite">
            {source === 'cloud' && (
              <span className="tray-cloud" title="This photo is read by a cloud model. It leaves the phone.">
                <CloudGlyph />
              </span>
            )}
            {note ?? status_}
          </span>
          <button type="button" className="tray-round" aria-label="Photograph another menu" onClick={props.onRetake}>
            <CameraGlyph />
          </button>
        </div>
      )}
      <div ref={scrollRef} className="tray-body">
        {!photo ? (
          <div className="tray-camera">
            {error ? (
              <p className="tray-hint">{error}</p>
            ) : (
              <video ref={videoRef} playsInline muted autoPlay />
            )}
            <AnimatePresence>
              {flash > 0 && (
                <motion.div
                  key={flash}
                  className="tray-flash"
                  initial={{ opacity: 0.9 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: 0.35 }}
                />
              )}
            </AnimatePresence>
            <div className="tray-camera-bar">
              <button
                type="button"
                className="tray-icon"
                aria-label="All Photos"
                onClick={() => fileRef.current?.click()}
              >
                <PhotosGlyph />
              </button>
              <button
                type="button"
                className="shutter"
                aria-label="Take a photo of the menu"
                disabled={status !== 'live'}
                onClick={shoot}
              />
              <button type="button" className="tray-pill" onClick={props.onSample}>
                Sample
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) pickFile(file)
              }}
            />
          </div>
        ) : (
          <div className="tray-photo" style={{ width: innerW, height: photoH }}>
            <img src={photo.src} alt="The menu" draggable={false} data-reading={reading || undefined} />
            {reading && !reduced && <div className="scan" aria-hidden="true" />}
            {items.map((item, i) => (
              <motion.button
                key={item.id}
                type="button"
                className="hotspot"
                aria-label={`New card: ${item.name}`}
                style={{
                  left: `${item.box.x * 100}%`,
                  top: `${item.box.y * 100}%`,
                  width: `${item.box.w * 100}%`,
                  height: `${item.box.h * 100}%`,
                }}
                initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={
                  reduced
                    ? { duration: 0.01 }
                    : { type: 'spring', visualDuration: 0.35, bounce: 0.3, delay: reading ? 0 : i * 0.02 }
                }
                whileTap={reduced ? undefined : { scale: 0.96 }}
                onClick={(e) => props.onTapItem(item, e.currentTarget.getBoundingClientRect())}
              />
            ))}
          </div>
        )}
      </div>

        </>
      )}
    </motion.div>
  )
}
