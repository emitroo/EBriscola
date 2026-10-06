# Briscola

Briscola for 2 to 4 players, on one phone passed around or on separate phones connected to each other. It's a web page: no app store, no accounts, and it works offline once loaded.

## Features

- **2, 3 or 4 players.** In a 3-player game the 2 of Cups is removed. Four players play as two teams, partners opposite.
- **One phone for everyone.** Before each human turn, a pass-the-phone screen hides the previous hand. You can turn this off.
- **Separate phones.** Each player sees only their own cards on their own phone. Seats can mix people on this phone, people on other phones and CPU players.
- **CPU players** fill empty seats (Easy / Normal / Hard). Hard counts cards and plays the 2-player endgame perfectly.
- **14 regional decks:** Triestine (default), Trevigiane, Bergamasche, Bresciane, Trentine, Piacentine, Romagnole, Napoletane, Siciliane, Sarde, Toscane, Genovesi, Piemontesi, Milanesi. Cards are drawn in SVG, in a stylised interpretation of each pattern (suit system, single or double-headed courts, colours, card back). They are not scans of real decks. On separate phones each person picks their own deck style.
- **Optional rules:** swap the 2 or 7 of trumps for the face-up briscola; partners see each other's hand once the deck runs out; show or hide the running score; matches of 1, 2, 3 or 5 hands.
- English and Italian UI. Autosaves: closing the browser mid-hand loses nothing.

## Put it online (needed for separate phones)

Both phones must load the page from a website. A local file can't use the camera or connect phones. Pick one host:

| Host | Private repo | Setup |
| --- | --- | --- |
| **Cloudflare Pages** | Free | dash.cloudflare.com → Workers & Pages → Create → Pages → Connect to Git → this repo. Build command `npm run site`, output directory `_site`. |
| **GitHub Pages** | Needs a paid plan (free for public repos) | Repo Settings → Pages → Source: **GitHub Actions**. The included workflow tests, builds and deploys on every push. |

Then on each phone, open the URL once and install it: Chrome → menu → **Install app**; Safari → Share → **Add to Home Screen**. After that it opens offline.

## Play on separate phones

The phone that adds the others is the **host**: it runs the game and deals. Any phone can host.

### Offline, with QR codes (no internet needed)

1. Put both phones on the same Wi-Fi, or turn on one phone's hotspot and join it from the other. The hotspot works with mobile data off.
2. **Host:** under *Separate phones*, tap **Add a phone with QR**. Allow the camera.
3. **Other phone:** tap **Join someone else's game → Scan host code**. Allow the camera and point it at the host's QR. A reply QR appears.
4. **Host:** point the camera at the reply QR. The phone appears as *connected* and takes the next free seat.
5. Tap **Deal the cards**.

If the phones won't connect over one phone's hotspot, try the other phone's hotspot or a normal Wi-Fi network. Some phones don't let the browser use their own hotspot.

If a phone drops out mid-hand (screen locked, app switched), the host waits. Re-pair the same way: on the host, menu → **Phones** → **Add a phone with QR**. The phone gets its seat and cards back.

### Online, with a room code

1. **Host:** tap **Open a room code**. A 5-letter code and a QR appear.
2. **Other phone:** tap **Join someone else's game**, enter the code and tap **Join**. Or just scan the room QR with the phone camera.

The connection setup goes through the free public PeerJS server (0.peerjs.com). After that, game data goes directly between the phones. This works reliably on the same Wi-Fi. Between two phones on mobile data it can fail, because some mobile networks block direct connections; use the QR method on a hotspot instead. Dropped phones reconnect automatically while the room stays open.

### Privacy and fairness

The host sends each phone only what that player may see: their own hand, the table, and the partner's hand only when that rule is on and the deck is finished. The other phones never receive the host's cards. Nothing is sent to any server except the room-code handshake.

## Development

```
npm test        # rules engine + AI tests
npm run build   # bundles src/ into index.html and sw.js (commit both)
npm run site    # build + copy the deployable files to _site/
```

Browser tests for one-phone play, two-phone pairing, reconnection and camera scanning are in `test/e2e/` (see the README there).

- `src/engine.js`: rules (pure functions, seedable shuffle)
- `src/ai.js`: CPU players
- `src/decks.js`: regional deck styles and SVG card renderer
- `src/net.js`: WebRTC link, PeerJS signalling client, QR encode/scan, pairing codes
- `src/app.js`, `src/style.css`, `src/body.html`, `src/i18n.js`: UI, game flow, host/guest logic
- `src/vendor/`: [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (MIT) and [jsQR](https://github.com/cozmo/jsQR) (Apache-2.0), minified
- `build.mjs`: inlines everything into the single-file `index.html`
