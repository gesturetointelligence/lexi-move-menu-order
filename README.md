# lexi-move-menu-order

Photograph a menu, tap each item on the photo, and each tap returns as its own card, already written, clear enough to hold up at the counter.

---

## What It Is

The photo is the interface. Colour Capture's camera opens in a bottom drawer. Take the shot and the menu is read once: items light up on the photo where they are printed, one by one, as the model writes them. Tap an item and a Magic card flies out of the photo into the order, already worded ("One flat white, please."). Tap it again and the card counts up ("2 flat whites, please."). Tap a card, or Hold up, and it fills the screen with the screen kept awake. Swipe between cards.

Every card is written during the single read, so a tap never waits on the network.

**Sample menu** draws a café menu on canvas with its cards pre-written, so the move runs with no key and no server (the GitHub Pages demo runs this way).

## How to Run

```bash
npm install
cp .env.example .env.local   # add ANTHROPIC_API_KEY
npm run dev                  # serves on your LAN too, for a phone
```

Live reading needs the dev server: `/api/read-menu` runs inside Vite, so the key stays in Node and never reaches the browser. A static build (Pages) has no server, so only the sample menu works there. Camera access needs a secure context: `localhost` works on the Mac; a phone on the LAN needs HTTPS (for example a tunnel).

`MENU_EFFORT` (low · medium · high, default low) trades read speed for care.

## How It Reads

`server/readMenu.ts`: one streamed call to `claude-opus-5-5` with the photo (downscaled to 1568px on the long edge) and a JSON schema (structured outputs). For each item it returns the printed name, price, a pixel box on that image, the card sentence in the menu's language, and a `{n}` form for quantities. Server-side refusal fallback is on (`fallbacks: "default"`). The client pulls each finished item out of the stream (`completedItems` in `src/lib/readMenu.ts`), so hotspots appear while the read is still going.

## What It Connects To

Magic. Cards use the Magic card's own layout (`src/lib/textLayout.ts`, copied from lexi-magic-studio, itself a port of the app's TextFitModule): SF Pro Rounded 600, radius 24, fit to size, never truncated. Shell, tokens and camera come from lexi-move-colour-capture.

## Authors

- Wayne

## Date

2026-10-13
