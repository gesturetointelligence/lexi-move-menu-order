import { useEffect, useRef, useState } from 'react'

export type CameraStatus = 'idle' | 'starting' | 'live' | 'error'

/**
 * getUserMedia lifecycle with strict cleanup: every acquired stream has its
 * tracks stopped when `active` flips false or the owner unmounts — including
 * streams that resolve after the effect has already been cleaned up.
 */
export function useCamera(active: boolean) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [status, setStatus] = useState<CameraStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!active) return

    let cancelled = false
    setStatus('starting')
    setError(null)

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => {
        if (cancelled) {
          // Effect already cleaned up (fast close / StrictMode double-run).
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          video.play().catch(() => {
            // autoplay + muted + playsInline should allow this; ignore races.
          })
        }
        setStatus('live')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const e = err as { name?: string; message?: string }
        setError(
          e?.name === 'NotAllowedError'
            ? 'Camera access denied. Please allow camera access and reload.'
            : `Camera error: ${e?.message ?? String(err)}`,
        )
        setStatus('error')
      })

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      if (videoRef.current) videoRef.current.srcObject = null
      setStatus('idle')
    }
  }, [active])

  return { videoRef, status, error }
}
