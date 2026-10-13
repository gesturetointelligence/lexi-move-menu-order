import { forwardRef, useMemo } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { BUTTON_ZONE, CARD_FONT, CARD_FONT_WEIGHT, CARD_RADIUS, MAX_FONT, PAD, layoutCardText } from '../lib/textLayout'

// Magic's default card (lib/app-themes.ts): black ink on Signal, SF Pro Rounded, Bold = 600.
export const CARD_BG = '#D0E62C'
export const CARD_INK = '#151715'

/** CardPager's PRESENT_SCALE: the presented card fits text up to 15% larger. */
export const PRESENT_SCALE = 1.15

export function fitCardText(text: string, width: number, height: number, present = false) {
  return layoutCardText({
    text,
    fontFamily: CARD_FONT,
    fontWeight: CARD_FONT_WEIGHT,
    innerW: width - 2 * PAD,
    // A card keeps the Magic button's zone clear; the presented card has no chrome.
    availH: height - 2 * PAD - (present ? 0 : BUTTON_ZONE),
    maxFont: present ? MAX_FONT * PRESENT_SCALE : MAX_FONT,
  })
}

interface Props {
  text: string
  width: number
  height: number
  present?: boolean
  /** Blank writing surface: show the caret. */
  caret?: boolean
  style?: CSSProperties
  className?: string
  children?: ReactNode
}

/**
 * The Magic card, true to CardPager: radius 24, padding 18, text top-left,
 * fitted to the card and never truncated. Cards are laid out in real points;
 * the app has two sizes, the card and the presented card.
 */
export const MagicCard = forwardRef<HTMLDivElement, Props>(function MagicCard(
  { text, width, height, present = false, caret = false, style, className, children },
  ref,
) {
  const layout = useMemo(() => fitCardText(text, width, height, present), [text, width, height, present])

  return (
    <div
      ref={ref}
      className={`magic-card${className ? ` ${className}` : ''}`}
      style={{
        width,
        height,
        borderRadius: present ? 0 : CARD_RADIUS,
        padding: PAD,
        background: CARD_BG,
        color: CARD_INK,
        fontFamily: CARD_FONT,
        fontWeight: CARD_FONT_WEIGHT,
        fontSize: layout.fontSize,
        lineHeight: `${layout.lineHeight}px`,
        ...style,
      }}
    >
      {layout.lines.map((line, i) => (
        <div key={i} className="magic-line">
          {line}
        </div>
      ))}
      {caret && text.length === 0 && (
        <span className="caret" style={{ height: layout.lineHeight * 0.8 }} aria-hidden="true" />
      )}
      {children}
    </div>
  )
})
