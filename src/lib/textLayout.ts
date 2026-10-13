// Card text-fit module — the load-bearing fidelity file.
//
// Faithful port of the native Lexi Magic TextFitModule: greedy word wrap on an
// offscreen 2D context, a 16pt longest-word width cap, and a fixed 16-halving
// binary search. Preview (DOM) and export (canvas) both consume the returned
// lines + fontSize so their geometry is identical.

// ---------------------------------------------------------------------------
// Card fidelity constants (design points, iPhone baseline)
// ---------------------------------------------------------------------------

export const CARD_RADIUS = 24 // continuous/squircle corners
export const PAD = 18 // inner padding all sides
export const GAP = 8
export const SIDE_PAD = 8
export const BUTTON_ZONE = 50 // bottom text reserve (wand zone) — keep for parity
export const MAX_FONT = 76
export const MIN_FONT = 8
export const LH_RATIO = 1.12 // lineHeight = Math.round(fontSize * 1.12)
export const WORD_MEASURE_FONT = 16
export const BASE_CARD_W_PT = 374 // in-app card width baseline (390pt iPhone − 2*GAP)
export const BASE_INNER_W_PT = 338 // 390 − 2*SIDE_PAD − 2*PAD

// Card aspect is FIXED — no user width/height. Ratio comes from the Figma
// mock's card: W 1158 × H 1380. The card scales to fit within the fit-box
// fractions below, preserving this ratio, on every format.
export const CARD_ASPECT = 1158 / 1380 // width / height ≈ 0.839
export const CARD_FIT_W = 0.64 // max card width as fraction of canvas width
export const CARD_FIT_H = 0.72 // max card height as fraction of canvas height

// Card drop shadow — LOCKED, no user controls. Values from the Figma mock's
// Drop shadow panel: X 0 / Y 10 / Blur 24 / Spread 0 / #000 at 15%, specified
// on the mock's 1158px-wide card — so they scale by cardW/1158 (NOT the
// pt-space card scale, which would render the shadow ~3× heavier than the mock).
export const MOCK_CARD_W = 1158
export const CARD_SHADOW = { x: 0, y: 10, blur: 24, color: 'rgba(0, 0, 0, 0.15)' } as const

/** Shadow multiplier for a card of the given rendered width. */
export function shadowScaleFor(cardWpx: number): number {
  return cardWpx / MOCK_CARD_W
}

export const CARD_FONT =
  'ui-rounded, "SF Pro Rounded", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'
export const CARD_FONT_WEIGHT = 600

// ---------------------------------------------------------------------------
// Card font options — mirrors the in-app set (app-themes.ts familyMap):
// sf-pro → system face, sf-pro-rounded → ui-rounded (DEFAULT), sf-mono →
// ui-monospace, new-york → ui-serif. "Bold" is 600, never 700, to stay
// pixel-identical to the app's established look.
// ---------------------------------------------------------------------------

export type CardFontId = 'sf-pro' | 'sf-pro-rounded' | 'sf-mono' | 'new-york'
export type CardWeightId = 'regular' | 'bold'

export const CARD_FONTS: { id: CardFontId; label: string; stack: string }[] = [
  {
    id: 'sf-pro',
    label: 'SF Pro',
    stack: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif',
  },
  {
    id: 'sf-pro-rounded',
    label: 'SF Pro Rounded',
    stack: CARD_FONT,
  },
  {
    id: 'sf-mono',
    label: 'SF Mono',
    stack: 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace',
  },
  {
    id: 'new-york',
    label: 'New York',
    stack: 'ui-serif, "New York", "New York Medium", Georgia, serif',
  },
]

export const DEFAULT_CARD_FONT_ID: CardFontId = 'sf-pro-rounded'
export const DEFAULT_CARD_WEIGHT_ID: CardWeightId = 'bold'

export function fontStackFor(id: CardFontId): string {
  return CARD_FONTS.find((f) => f.id === id)?.stack ?? CARD_FONT
}

export function fontWeightFor(w: CardWeightId): number {
  return w === 'bold' ? 600 : 400
}

// ---------------------------------------------------------------------------
// Module-level offscreen measuring context
// ---------------------------------------------------------------------------

let _measureCtx: CanvasRenderingContext2D | null = null

function measureCtx(): CanvasRenderingContext2D {
  if (_measureCtx) return _measureCtx
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable for text measurement')
  _measureCtx = ctx
  return _measureCtx
}

function setFont(
  ctx: CanvasRenderingContext2D,
  size: number,
  weight: number,
  family: string,
): void {
  ctx.font = `${weight} ${size}px ${family}`
}

// ---------------------------------------------------------------------------
// layoutCardText
// ---------------------------------------------------------------------------

export interface LayoutOptions {
  text: string
  fontFamily: string
  fontWeight: number
  innerW: number // pt
  availH: number // pt = cardH − 2*PAD − BUTTON_ZONE
  maxFont?: number
  minFont?: number
  lhRatio?: number
}

export interface LayoutResult {
  fontSize: number
  lineHeight: number
  lines: string[]
}

export function layoutCardText(opts: LayoutOptions): LayoutResult {
  const {
    text,
    fontFamily,
    fontWeight,
    innerW,
    availH,
    maxFont = MAX_FONT,
    minFont = MIN_FONT,
    lhRatio = LH_RATIO,
  } = opts

  // 1. Empty text → maxFont, no lines.
  if (text.length === 0) {
    return { fontSize: maxFont, lineHeight: Math.round(maxFont * lhRatio), lines: [] }
  }

  // 2. Trailing-newline sentinel: a trailing blank line must count for height.
  const sentinelApplied = text.endsWith('\n')
  const measureText = sentinelApplied ? text + 'M' : text

  const ctx = measureCtx()

  // 3. Greedy word wrap at a candidate size (honours explicit \n; an
  //    over-wide single word stays on its own line).
  const wrapAt = (size: number): string[] => {
    setFont(ctx, size, fontWeight, fontFamily)
    const out: string[] = []
    for (const para of measureText.split('\n')) {
      const words = para.split(/\s+/).filter((w) => w.length > 0)
      if (words.length === 0) {
        out.push('')
        continue
      }
      let line = ''
      for (const w of words) {
        const cand = line === '' ? w : line + ' ' + w
        if (line === '' || ctx.measureText(cand).width <= innerW) {
          line = cand
        } else {
          out.push(line)
          line = w
        }
      }
      out.push(line)
    }
    return out
  }

  const lineHeightAt = (size: number): number => Math.round(size * lhRatio)
  // 5. fits(size) = wrappedHeight(size) <= availH
  const fits = (size: number): boolean => wrapAt(size).length * lineHeightAt(size) <= availH

  // 4. Width cap: longest token measured at 16pt → 16 * innerW / wordW.
  //    Escape hatch: single token > 24 chars with no spaces (URL / CJK run).
  let widthCap = maxFont
  {
    const tokens = measureText.split(/\s+/).filter((t) => t.length > 0)
    setFont(ctx, WORD_MEASURE_FONT, fontWeight, fontFamily)
    let wordW = 0
    let longest = ''
    for (const t of tokens) {
      const w = ctx.measureText(t).width
      if (w > wordW) {
        wordW = w
        longest = t
      }
    }
    const escapeHatch = tokens.length === 1 && longest.length > 24
    if (wordW > 0 && !escapeHatch) {
      widthCap = (WORD_MEASURE_FONT * innerW) / wordW
    }
  }

  // 6. Fast path at maxFont, else EXACTLY 16 binary-search halvings → lo.
  let result: number
  if (fits(maxFont)) {
    result = maxFont
  } else {
    let lo = minFont
    let hi = maxFont
    for (let i = 0; i < 16; i++) {
      const mid = (lo + hi) / 2
      if (fits(mid)) lo = mid
      else hi = mid
    }
    result = lo
  }

  const finalSize = Math.min(result, widthCap)

  // 7. Wrap the lines AT the final size so preview and export match.
  const lines = wrapAt(finalSize)
  if (sentinelApplied && lines.length > 0 && lines[lines.length - 1] === 'M') {
    lines[lines.length - 1] = ''
  }

  return { fontSize: finalSize, lineHeight: Math.round(finalSize * lhRatio), lines }
}

// ---------------------------------------------------------------------------
// Card-in-post render model — shared by preview and export
// ---------------------------------------------------------------------------

export interface CardModelParams {
  text: string
  canvasW: number
  canvasH: number
  cx: number // card centre x as fraction of canvas width
  cy: number // card centre y as fraction of canvas height
  font?: CardFontId
  weight?: CardWeightId
}

export interface CardModel {
  /** Card box in canvas px. */
  cardW: number
  cardH: number
  left: number
  top: number
  /** pt→px scale (cardW_px / BASE_CARD_W_PT). */
  scale: number
  /** Text metrics in PT space — multiply by `scale` for px. */
  fontSize: number
  lineHeight: number
  lines: string[]
  pad: number // PAD in pt
  /** Resolved CSS stack + numeric weight — preview and export both use these. */
  fontFamily: string
  fontWeight: number
}

/**
 * Lays out the card in pt-space then scales, exactly as the phone does, so
 * text scaling is identical regardless of format or card size.
 */
export function computeCardModel(p: CardModelParams): CardModel {
  // Fixed aspect: fit the 1158:1380 card inside the fit-box for this canvas.
  const cardW = Math.min(CARD_FIT_W * p.canvasW, CARD_FIT_H * p.canvasH * CARD_ASPECT)
  const cardH = cardW / CARD_ASPECT
  const scale = cardW / BASE_CARD_W_PT

  const cardH_pt = cardH / scale
  const innerW = BASE_INNER_W_PT
  const availH = cardH_pt - 2 * PAD - BUTTON_ZONE

  const fontFamily = fontStackFor(p.font ?? DEFAULT_CARD_FONT_ID)
  const fontWeight = fontWeightFor(p.weight ?? DEFAULT_CARD_WEIGHT_ID)

  const layout = layoutCardText({
    text: p.text,
    fontFamily,
    fontWeight,
    innerW,
    availH,
  })

  const left = p.cx * p.canvasW - cardW / 2
  const top = p.cy * p.canvasH - cardH / 2

  return {
    cardW,
    cardH,
    left,
    top,
    scale,
    fontSize: layout.fontSize,
    lineHeight: layout.lineHeight,
    lines: layout.lines,
    pad: PAD,
    fontFamily,
    fontWeight,
  }
}

// ---------------------------------------------------------------------------
// Shared line paint metrics (used by the canvas exporter)
// ---------------------------------------------------------------------------

export interface LinePaintMetrics {
  ascent: number
  descent: number
  /** Distance from a line's top to the alphabetic baseline, matching CSS. */
  baselineOffset: number
}

/**
 * Computes where to place the alphabetic baseline inside a line box so the
 * glyph box is centred exactly the way CSS centres it within line-height.
 * Uses fontBoundingBox metrics when available, falling back to actualBoundingBox.
 * `ctx` is the caller's canvas context (already at render resolution).
 */
export function linePaintMetrics(
  ctx: CanvasRenderingContext2D,
  fontSizePx: number,
  lineHeightPx: number,
  weight: number,
  family: string,
): LinePaintMetrics {
  ctx.font = `${weight} ${fontSizePx}px ${family}`
  const m = ctx.measureText('Mg')
  const ascent =
    (m as TextMetrics).fontBoundingBoxAscent ??
    m.actualBoundingBoxAscent ??
    fontSizePx * 0.8
  const descent =
    (m as TextMetrics).fontBoundingBoxDescent ??
    m.actualBoundingBoxDescent ??
    fontSizePx * 0.2
  const baselineOffset = (lineHeightPx - (ascent + descent)) / 2 + ascent
  return { ascent, descent, baselineOffset }
}
