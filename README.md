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
| **GitHub Pages** | Needs a paid plan (free for public repos) | Repo Settings → Pages → Source: **Deploy from a branch**, this branch, `/ (root)`. The built `index.html` is committed, so every push redeploys. Live at https://emitroo.github.io/Briscola/ |

Then on each phone, open the URL once and install it: Chrome → menu → **Install app**; Safari → Share → **Add to Home Screen**. After that it opens offline.

## Play on separate phones

The home screen has three clearly separate choices: **On this phone**, **Online** and **Nearby, no internet**.
In both multiplayer modes one person hosts. Their phone runs the game and deals; everyone else just joins.

### Online (internet on every phone)

1. **Host:** Online → **Host a game**. A 5-letter lobby code appears, with a QR and a Share button.
2. **Everyone else:** open the game → Online → **Join with a code**, type your name and the code, tap **Join**. Or scan the host's QR with the phone camera, which opens the game with the code filled in.
3. Joined players fill the seats automatically (up to 4). The host can switch any seat to a CPU, then taps **Start the game**.

Connection setup goes through the free public PeerJS server (0.peerjs.com); game traffic then goes directly between the phones. If someone's connection drops, their phone rejoins by itself; after closing the app, opening it again shows the join screen with the last code filled in.

**Mobile data:** a direct connection works on many networks, but some mobile networks block it when both phones are on mobile data. The fix is a relay (TURN) server. Make a free account at metered.ca (free plan), create TURN credentials, and paste the ICE servers settings it shows into the host's lobby under *Players on mobile data can't connect?*. Only the host needs this. Alternatively, one phone joins Wi-Fi, or you use the Nearby mode on a hotspot.

### Nearby, no internet (QR codes)

1. Everyone joins the same Wi-Fi, or the host's phone hotspot. Mobile data can stay off.
2. **Host:** Nearby → **Host**, then **Add a phone**.
3. **Friend:** Nearby → **Join**. The camera opens: scan the host's code (step 1). A reply code appears on the friend's phone.
4. **Host:** tap **They've scanned it: next** and scan the friend's reply (step 2). Repeat for each friend.

If phones won't connect on one phone's hotspot, try the other phone's hotspot or a normal Wi-Fi network. If a phone drops out, the host taps menu → **Phones** → **Add a phone** and the two swap codes again; the seat and cards are kept.

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
