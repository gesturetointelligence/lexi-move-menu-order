# lexi-move-menu-order

Magic's cards with the camera as the keyboard: photograph a menu, tap each item on the photo, and each tap becomes its own card, ready to present at the counter.

---

## What It Is

Magic's cards, with a camera behind the Magic button.

It opens the way Magic does: a blank card with the keyboard up. Type, and the words go on the card. The Magic button sits on the card (48pt glass, bottom centre): a tap fires the armed mode, and press and hold opens Magic's menu, Rewrite and Translate, plus one new row, **Camera**. As in Magic, picking a row arms it; Camera also swaps the keyboard for the camera, at the same height, the way iOS swaps input views. With Camera armed, a tap on the button flips between camera and keyboard.

In the camera drawer, the shutter sits bottom centre. Capture, and the frame freezes while the read sweeps a light across it; each item it finds blooms with light and settles into an outline. "Tap to select": a tap lifts the printed words onto the card, and the next tap commits that card and writes the next. A swipe up to a new card brings the keyboard back, the default.

The drawer works exactly as the keyboard does in CardPager (`apps/magic-mobile/docs/cardpager-v2.md`): keyboard-sized (336pt, `KB_SEED`), its height sets the card height, its progress drives every fade. Swipe a card up to commit it. Leave with the glass Dismiss, by dragging the cards (or the camera) down, or a trackpad scroll; a card with text commits on leave. Browsing ends flush at the last card; pull past the end to bring the drawer back. Pinch out to Present (tap the thirds to page). Hold a card for Share, Copy, Delete; double-tap to edit. Swipe left for a new thread: a clean start.

One deviation from the app: Magic shows the button only once a card has a character. Here it shows on the blank card too, so the camera is reachable from the first screen.

**The cloud is a labelled play.** Magic's promise is that what you write never leaves the phone. Here the menu photo goes to a cloud model to find where items are printed (the drawer marks it with a cloud glyph), and Rewrite and Translate run on a cloud model too, since a browser has no on-device model. Rewrite uses Magic's own prompt, copied verbatim from `packages/magic-config` into `server/magicConfig.ts`. Sample menu runs entirely in the browser.

On a bigger screen the play stays the size of an iPhone screen (402×874), with no device frame; on a phone it fills the screen.

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
