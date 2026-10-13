import { useMemo } from 'react'
import {
  BASE_CARD_W_PT,
  BASE_INNER_W_PT,
  BUTTON_ZONE,
  CARD_ASPECT,
  CARD_FONT,
  CARD_FONT_WEIGHT,
  CARD_RADIUS,
  PAD,
  layoutCardText,
} from '../lib/textLayout'

export const CARD_BG = '#D0E62C'
export const CARD_INK = '#151715'

interface Props {
  text: string
  /** Rendered width in px. Height follows the Magic card aspect. */
  width: number
}

/**
 * The Magic card, true to the app: laid out in pt on the iPhone baseline,
 * then scaled, so it fits text exactly as the phone does at any size.
 */
export function MagicCard({ text, width }: Props) {
  const height = width / CARD_ASPECT
  const scale = width / BASE_CARD_W_PT

  const layout = useMemo(
    () =>
      layoutCardText({
        text,
        fontFamily: CARD_FONT,
        fontWeight: CARD_FONT_WEIGHT,
        innerW: BASE_INNER_W_PT,
        availH: height / scale - 2 * PAD - BUTTON_ZONE,
      }),
    [text, height, scale],
  )

  return (
    <div
      className="magic-card"
      role="img"
      aria-label={text}
      style={{
        width,
        height,
        borderRadius: CARD_RADIUS * scale,
        padding: PAD * scale,
        background: CARD_BG,
        color: CARD_INK,
        fontFamily: CARD_FONT,
        fontWeight: CARD_FONT_WEIGHT,
        fontSize: layout.fontSize * scale,
        lineHeight: `${layout.lineHeight * scale}px`,
      }}
    >
      {layout.lines.map((line, i) => (
        <div key={i} className="magic-line">
          {line}
        </div>
      ))}
    </div>
  )
}
