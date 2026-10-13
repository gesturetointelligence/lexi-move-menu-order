import type { MenuItem, Photo } from './types'

/** Longest edge sent to the model. The photo shown is the same image, so boxes line up. */
const MAX_EDGE = 1568

export function downscale(source: HTMLVideoElement | HTMLImageElement): Photo {
  const sw = source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth
  const sh = source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight
  const k = Math.min(1, MAX_EDGE / Math.max(sw, sh))
  const width = Math.round(sw * k)
  const height = Math.round(sh * k)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas unavailable')
  ctx.drawImage(source, 0, 0, width, height)
  return { src: canvas.toDataURL('image/jpeg', 0.85), width, height }
}

export type ReadError = 'no-server' | 'no-key' | 'bad-key' | 'rate-limit' | 'refusal' | 'api-error' | 'nothing-found'

export class MenuReadError extends Error {
  constructor(public code: ReadError) {
    super(code)
  }
}

interface RawItem {
  name: string
  price: string
  box: { x: number; y: number; w: number; h: number }
}

/**
 * Pulls each finished object out of the `items` array of a JSON document that
 * is still being written. Returns every complete item so far.
 */
export function completedItems(text: string): RawItem[] {
  const start = text.indexOf('[', text.indexOf('"items"'))
  if (start < 0) return []
  const out: RawItem[] = []
  let depth = 0
  let inString = false
  let escaped = false
  let objStart = -1
  for (let i = start + 1; i < text.length; i++) {
    const c = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (c === '\\') escaped = true
      else if (c === '"') inString = false
      continue
    }
    if (c === '"') inString = true
    else if (c === '{') {
      if (depth === 0) objStart = i
      depth++
    } else if (c === '}') {
      depth--
      if (depth === 0 && objStart >= 0) {
        try {
          out.push(JSON.parse(text.slice(objStart, i + 1)) as RawItem)
        } catch {
          // Malformed fragment: skip it, keep reading.
        }
        objStart = -1
      }
    } else if (c === ']' && depth === 0) break
  }
  return out
}

function toItem(raw: RawItem, i: number, photo: Photo): MenuItem | null {
  const { x, y, w, h } = raw.box ?? {}
  if (!raw.name?.trim() || ![x, y, w, h].every((v) => typeof v === 'number' && Number.isFinite(v)) || w <= 0 || h <= 0) {
    return null
  }
  // A little air around the printed line makes a kinder tap target.
  const padX = Math.max(6, h * 0.25)
  const padY = Math.max(4, h * 0.3)
  const x0 = Math.max(0, x - padX)
  const y0 = Math.max(0, y - padY)
  const x1 = Math.min(photo.width, x + w + padX)
  const y1 = Math.min(photo.height, y + h + padY)
  return {
    id: `${i}-${raw.name}`,
    name: raw.name,
    price: raw.price ?? '',
    box: {
      x: x0 / photo.width,
      y: y0 / photo.height,
      w: (x1 - x0) / photo.width,
      h: (y1 - y0) / photo.height,
    },
  }
}

/**
 * One call. Items arrive through `onItem` as soon as each is written,
 * in reading order.
 */
export async function readMenu(
  photo: Photo,
  onItem: (item: MenuItem) => void,
  signal: AbortSignal,
): Promise<void> {
  let res: Response
  try {
    res = await fetch(`${import.meta.env.BASE_URL}api/read-menu`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        image: photo.src.slice(photo.src.indexOf(',') + 1),
        width: photo.width,
        height: photo.height,
      }),
      signal,
    })
  } catch (err) {
    if (signal.aborted) throw err
    throw new MenuReadError('no-server')
  }
  if (res.status === 503) throw new MenuReadError('no-key')
  if (!res.ok || !res.body) throw new MenuReadError('no-server')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let text = ''
  let emitted = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    text += decoder.decode(value, { stream: true })
    const items = completedItems(text)
    for (; emitted < items.length; emitted++) {
      const item = toItem(items[emitted], emitted, photo)
      if (item) onItem(item)
    }
  }

  const tail = text.lastIndexOf('\u0000')
  if (tail >= 0) {
    const code = text.slice(tail + 1).trim()
    if (code === 'max_tokens' && emitted > 0) return // keep what we have
    throw new MenuReadError(
      (['bad-key', 'rate-limit', 'refusal', 'api-error'] as const).find((c) => c === code) ?? 'api-error',
    )
  }
  if (emitted === 0) throw new MenuReadError('nothing-found')
}
