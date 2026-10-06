# Briscola

Pass-and-play Briscola for 2 to 4 players on one phone. Works fully offline. No dependencies, no server, no tracking.

## Features

- **2, 3 or 4 players.** In a 3-player game the 2 of Cups is removed. Four players play as two teams, partners opposite.
- **One phone for everyone.** Before each human turn, a pass-the-phone screen hides the previous hand. You can turn this off.
- **CPU players** fill empty seats (Easy / Normal / Hard). Hard counts cards and plays the 2-player endgame perfectly.
- **14 regional decks:** Triestine (default), Trevigiane, Bergamasche, Bresciane, Trentine, Piacentine, Romagnole, Napoletane, Siciliane, Sarde, Toscane, Genovesi, Piemontesi, Milanesi. Each deck has its own suit system (Italian, Spanish-type or French), single or double-headed court cards, colours and card back. All cards are drawn in SVG, in a stylised interpretation of each pattern. They are not scans of real decks.
- **Optional rules:** swap the 2 or 7 of trumps for the face-up briscola; partners see each other's hand once the deck runs out; show or hide the running score; play a match of 1, 2, 3 or 5 hands.
- English and Italian UI. Saves automatically: closing the browser mid-hand loses nothing.

## Play on a phone

| Method | Offline | How |
| --- | --- | --- |
| GitHub Pages (recommended) | Yes, after the first load | Repo Settings → Pages → Source: **GitHub Actions**. Push, open the Pages URL on the phone, then use the browser menu → **Add to Home screen / Install app**. |
| Single file | Yes | Copy `index.html` to the phone and open it in Chrome (on Android, open it from Files with Chrome). The service worker is skipped on `file://`, but nothing else needs it. |

## Development

```
npm test        # rules engine + AI tests
npm run build   # bundles src/ into index.html and sw.js (commit both)
```

- `src/engine.js`: rules (pure functions, seedable shuffle)
- `src/ai.js`: CPU players
- `src/decks.js`: regional deck styles and SVG card renderer
- `src/i18n.js`: English and Italian strings
- `src/app.js`, `src/style.css`, `src/body.html`: UI and game flow
- `build.mjs`: inlines everything into the single-file `index.html`
