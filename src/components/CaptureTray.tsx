import { useRef, useState } from 'react'
import { AnimatePresence, animate, motion, useReducedMotion, useTransform } from 'motion/react'
import type { MotionValue } from 'motion/react'
import { KB_TIMING } from './CardCanvas'
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
  const drag = useRef<{ startY: number; active: boolean; moved: boolean } | null>(null)
  const { videoRef, status, error } = useCamera(!photo && props.live)
  const [flash, setFlash] = useState(0)

  // Drag the tray down (from the top of its content) and it follows the finger,
  // like an interactive keyboard dismiss. A lone empty card can't be dismissed.
  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { startY: e.clientY, active: false, moved: false }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dy = e.clientY - d.startY
    const atTop = (scrollRef.current?.scrollTop ?? 0) <= 0
    if (!d.active && dy > 10 && atTop) {
      d.active = true
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    }
    if (d.active) {
      d.moved = true
      const free = Math.max(0, dy)
      kb.set(1 - (props.dismissBlocked ? Math.min(free, 24) * 0.3 : free) / height)
    }
  }
  const onPointerUp = () => {
    const d = drag.current
    drag.current = null
    if (!d?.active) return
    if (!props.dismissBlocked && kb.get() < 0.75) props.onDismiss()
    else animate(kb, 1, KB_TIMING)
  }
  const swallowClickAfterDrag = (e: React.MouseEvent) => {
    if (kb.get() < 1) {
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

  const innerW = width - 16
  const photoH = photo ? (innerW * photo.height) / photo.width : 0

  const status_ = photo
    ? reading
      ? source === 'cloud'
        ? 'Reading in the cloud'
        : 'Reading'
      : items.length
        ? source === 'cloud'
          ? `Read in the cloud · ${items.length}`
          : `${items.length} items`
        : ''
    : ''

  return (
    <motion.div
      className="tray"
      role="dialog"
      aria-label="Menu"
      style={{ width, height, paddingBottom: safeBottom, y, visibility }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClickCapture={swallowClickAfterDrag}
    >
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
              <button type="button" className="tray-pill" onClick={() => fileRef.current?.click()}>
                All Photos
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

      {photo && (
        <div className="tray-overlay">
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
    </motion.div>
  )
}
