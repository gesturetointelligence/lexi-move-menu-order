import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { useCamera } from '../hooks/useCamera'
import { downscale } from '../lib/readMenu'
import type { Photo } from '../lib/types'

// Colour Capture's camera, kept intact, moved into a bottom drawer.

function PhotosIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="5" width="16" height="14" rx="3" />
      <circle cx="9.2" cy="10" r="1.6" />
      <path d="m4.5 16.5 4-4 3 3 3.5-3.5 4.5 4.5" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2 2l10 10M12 2 2 12" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

interface Props {
  onClose: () => void
  onCaptured: (photo: Photo) => void
}

export function CaptureDrawer({ onClose, onCaptured }: Props) {
  const reduced = useReducedMotion()
  const fileRef = useRef<HTMLInputElement | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [photoSrc, setPhotoSrc] = useState<string | null>(null)
  const [photoReady, setPhotoReady] = useState(false)
  const mode = photoSrc ? 'photo' : 'camera'
  const { videoRef, status, error } = useCamera(mode === 'camera')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleConfirm = () => {
    const source = mode === 'camera' ? videoRef.current : imgRef.current
    if (!source) return
    if (source instanceof HTMLVideoElement) {
      if (!source.videoWidth) return
      source.pause() // freeze the frame the moment it is taken
    }
    try {
      onCaptured(downscale(source))
    } catch {
      onClose()
    }
  }

  const ready = mode === 'camera' ? status === 'live' && !error : photoReady
  const spring = { type: 'spring' as const, visualDuration: 0.35, bounce: 0.15 }

  return (
    <motion.div
      className="drawer-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0.01 : 0.2, ease: 'easeOut' }}
      onClick={onClose}
    >
      <motion.div
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'camera' ? 'Photograph the menu' : 'Use a photo of the menu'}
        onClick={(e) => e.stopPropagation()}
        initial={reduced ? { opacity: 0 } : { y: '100%' }}
        animate={reduced ? { opacity: 1 } : { y: 0 }}
        exit={reduced ? { opacity: 0 } : { y: '100%' }}
        transition={reduced ? { duration: 0.01 } : spring}
        drag={reduced ? false : 'y'}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 120 || info.velocity.y > 600) onClose()
        }}
      >
        <div className="drawer-grabber" aria-hidden="true" />
        <div className="capture-top">
          <span className="capture-title">{mode === 'camera' ? 'Camera' : 'Photo'}</span>
          <button type="button" className="capture-close" aria-label="Close" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <div className="viewfinder">
          {mode === 'camera' ? (
            error ? (
              <p className="capture-error">{error}</p>
            ) : (
              <video ref={videoRef} playsInline muted autoPlay />
            )
          ) : (
            <img
              ref={imgRef}
              src={photoSrc ?? undefined}
              alt="Chosen photo"
              onLoad={() => setPhotoReady(true)}
              style={{ objectFit: 'contain' }}
            />
          )}
        </div>
        <div className="capture-actions">
          <button type="button" className="capture-shutter" disabled={!ready} onClick={handleConfirm}>
            {mode === 'camera' ? 'Capture' : 'Use photo'}
          </button>
          {mode === 'camera' && (
            <>
              <button
                type="button"
                className="icon-btn-44"
                aria-label="Pick a photo from the library instead"
                onClick={() => fileRef.current?.click()}
              >
                <PhotosIcon />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (!file) return
                  const reader = new FileReader()
                  reader.onload = () => {
                    if (typeof reader.result === 'string') setPhotoSrc(reader.result)
                  }
                  reader.readAsDataURL(file)
                }}
              />
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
