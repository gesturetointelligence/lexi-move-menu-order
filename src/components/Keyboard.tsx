import { useEffect, useRef, useState } from 'react'

// An iPhone keyboard (dark), drawn so the play opens the way Magic does: a
// blank card with the keyboard up. It types into the writing card. A physical
// keyboard types too.

export type KeyAction = { type: 'char'; ch: string } | { type: 'backspace' } | { type: 'return' }

const LETTERS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
]
const NUMBERS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['-', '/', ':', ';', '(', ')', '£', '&', '@', '"'],
  ['.', ',', '?', '!', "'"],
]

function Globe() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.6 2.8 2.6 15.2 0 18M12 3c-2.6 2.8-2.6 15.2 0 18" />
    </svg>
  )
}

function Mic() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
    </svg>
  )
}

function ShiftGlyph({ on }: { on: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 4 3.5 12.5H8V20h8v-7.5h4.5Z" />
    </svg>
  )
}

function BackspaceGlyph() {
  return (
    <svg width="26" height="22" viewBox="0 0 28 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
      <path d="M9 4h15a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H9l-7-8Z" />
      <path d="m13 9 6 6M19 9l-6 6" />
    </svg>
  )
}

interface Props {
  /** Auto-capitalise the next letter (start of the card, or after a sentence). */
  autoCaps: boolean
  onKey: (a: KeyAction) => void
}

export function Keyboard({ autoCaps, onKey }: Props) {
  const [shift, setShift] = useState(false)
  const [numbers, setNumbers] = useState(false)
  const repeat = useRef<number | null>(null)
  const caps = shift || autoCaps

  useEffect(() => () => {
    if (repeat.current) clearInterval(repeat.current)
  }, [])

  const press = (a: KeyAction) => {
    onKey(a)
    if (a.type === 'char' && shift) setShift(false)
  }

  const key = (label: string, opts: { cls?: string; flex?: number; action: () => void; aria?: string; repeat?: boolean; children?: React.ReactNode }) => (
    <button
      type="button"
      key={opts.aria ?? label}
      className={`kb-key ${opts.cls ?? ''}`}
      style={opts.flex ? { flex: opts.flex } : undefined}
      aria-label={opts.aria ?? label}
      onPointerDown={(e) => {
        e.preventDefault()
        opts.action()
        if (opts.repeat) {
          const start = window.setTimeout(() => {
            repeat.current = window.setInterval(opts.action, 90)
          }, 450)
          repeat.current = start
        }
      }}
      onPointerUp={() => {
        if (repeat.current) {
          clearTimeout(repeat.current)
          clearInterval(repeat.current)
          repeat.current = null
        }
      }}
      onPointerLeave={() => {
        if (repeat.current) {
          clearTimeout(repeat.current)
          clearInterval(repeat.current)
          repeat.current = null
        }
      }}
    >
      {opts.children ?? label}
    </button>
  )

  const rows = numbers ? NUMBERS : LETTERS
  const charKey = (ch: string) => {
    const out = !numbers && caps ? ch.toUpperCase() : ch
    return key(out, { action: () => press({ type: 'char', ch: out }), aria: `key-${ch}` })
  }

  return (
    <div className="keyboard" role="group" aria-label="Keyboard">
      <div className="kb-predictive" aria-hidden="true">
        <span />
        <i />
        <span />
        <i />
        <span />
      </div>
      <div className="kb-row">{rows[0].map(charKey)}</div>
      <div className={`kb-row ${numbers ? '' : 'kb-row-inset'}`}>{rows[1].map(charKey)}</div>
      <div className="kb-row">
        {numbers
          ? key('#+=', { cls: 'kb-fn kb-wide', action: () => {}, aria: 'symbols' })
          : key('', { cls: 'kb-fn kb-wide', action: () => setShift((s) => !s), aria: 'shift', children: <ShiftGlyph on={caps} /> })}
        <div className="kb-mid">{rows[2].map(charKey)}</div>
        {key('', { cls: 'kb-fn kb-wide', action: () => press({ type: 'backspace' }), aria: 'delete', repeat: true, children: <BackspaceGlyph /> })}
      </div>
      <div className="kb-row">
        {key(numbers ? 'ABC' : '123', { cls: 'kb-fn kb-mode', action: () => setNumbers((n) => !n), aria: numbers ? 'letters' : 'numbers' })}
        {key('space', { cls: 'kb-space', action: () => press({ type: 'char', ch: ' ' }), aria: 'space' })}
        {key('return', { cls: 'kb-fn kb-return', action: () => press({ type: 'return' }), aria: 'return' })}
      </div>
      <div className="kb-system" aria-hidden="true">
        <Globe />
        <Mic />
      </div>
    </div>
  )
}
