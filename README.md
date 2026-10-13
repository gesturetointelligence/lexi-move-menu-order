# lexi-move-menu-order

Magic's cards with the camera as the keyboard: photograph a menu, tap each item on the photo, and each tap becomes its own card, ready to present at the counter.

---

## What It Is

Magic's cards, with Colour Capture's camera tray in the keyboard's place.

The screen is Magic's card canvas: one card at the writing anchor, the camera tray docked under it like the keyboard. Photograph a menu (or tap Sample) and the tray stays up with the photo in it; items light up where they are printed. Tap an item and its printed words lift off the menu onto the card. Tap another and the card commits (it slides up to 1/3) while a new one rises with the next item. Each tap is its own card, in one thread.

The tray works exactly as the keyboard does in CardPager (`apps/magic-mobile/docs/cardpager-v2.md`): its height sets the card height, and its progress drives every fade. Swipe a card up to commit it. Drag the cards (or the tray) down and the tray follows the finger; a card with text commits on leave, an empty one recedes with the tray, and a lone empty card can't be dismissed. Browsing ends flush at the last card; pull past the end and a card rises, past the threshold the tray comes back. Pinch out (or a trackpad pinch) to Present: full-bleed, tap the left or right third to page, swipe or pinch in to go back. Hold a card for Share, Copy, Delete. Double-tap to edit.

The cards carry the menu's own words, editable like any card. Nothing is written for you.

**The cloud read is a labelled play.** Magic's promise is that what you write never leaves the phone. Here the menu photo goes to a cloud model to find where items are printed, and the tray marks it with a cloud glyph. Sample menu runs entirely in the browser.

## How to Run

```bash
npm install
cp .env.example .env.local   # add ANTHROPIC_API_KEY
npm run dev                  # serves on your LAN too, for a phone
```

Live reading needs the dev server: `/api/read-menu` runs inside Vite, so the key stays in Node and never reaches the browser. A static build (Pages) has no server, so only the sample menu works there. Camera access needs a secure context: `localhost` works on the Mac; a phone on the LAN needs HTTPS (for example a tunnel).

`MENU_EFFORT` (low · medium · high, default low) trades read speed for care.

## How It Reads

`server/readMenu.ts`: one streamed call to `claude-opus-5-5` with the photo (downscaled to 1568px on the long edge) and a JSON schema (structured outputs). It returns each item's printed name, price and pixel box, nothing else. Server-side refusal fallback is on (`fallbacks: "default"`). The client pulls each finished item out of the stream (`completedItems` in `src/lib/readMenu.ts`), so hotspots appear while the read is still going.

## What It Connects To

Magic. The card canvas follows CardPager v2's geometry and opacity formulas (`src/components/CardCanvas.tsx` lists them); text fit is `src/lib/textLayout.ts` (via lexi-magic-studio, a port of the app's TextFitModule): SF Pro Rounded 600, radius 24, never truncated. The tray is Colour Capture's (Magic's `ColourCaptureTray`), camera tile first. Not here: the Magic button (Rewrite and Translate run on the phone's own model), shake to undo, threads list.

## Authors

- Wayne

## Date

2026-10-13
