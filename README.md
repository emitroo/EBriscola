# EBriscola

Briscola for 2 to 4 players, on one phone passed around or on separate phones connected to each other. It's a web page: no app store, no accounts, and it works offline once loaded.

## Features

- **2, 3 or 4 players.** In a 3-player game the 2 of Cups is removed. Four players play as two teams, partners opposite.
- **One phone for everyone.** Before each human turn, a pass-the-phone screen hides the previous hand. You can turn this off.
- **Separate phones.** Each player sees only their own cards on their own phone. Seats can mix people on this phone, people on other phones and CPU players.
- **CPU players** fill empty seats (Easy / Normal / Hard). Hard counts cards and plays the 2-player endgame perfectly.
- **14 regional decks:** Triestine (default), Trevigiane, Bergamasche, Bresciane, Trentine, Piacentine, Romagnole, Napoletane, Siciliane, Sarde, Toscane, Genovesi, Piemontesi, Milanesi. Cards are drawn in SVG, in a stylised interpretation of each pattern (suit system, single or double-headed courts, colours, card back). They are not scans of real decks. On separate phones each person picks their own deck style (except Settlers, below, which is shared with the whole game).
- **Settlers (private deck):** a Trieste-style deck with friends' photos on the cards. Hidden until a photo pack is opened on the phone or shared in a game. The photos come from a private encrypted pack, not from the website (see below). Not available in the offline single-file build. In a multiplayer game, whoever picks Settlers (host or guest) switches every phone in the game to it, including phones that never entered the code, and it stays unlocked on those phones afterwards. Anyone picking a regular deck turns the shared deck off, and each phone goes back to its own choice.
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

**Mobile data:** when the phones can't reach each other directly (common when both are on mobile data), the connection goes through a relay (TURN) server built into the game (Metered.ca, free plan with a monthly allowance). The relay credentials are visible to anyone who opens the page, which is normal for a static site; set a usage cap or rotate them in the Metered dashboard if needed (`src/net.js`). The host lobby also has an advanced field to add another relay.

### Nearby, no internet (QR codes)

1. Everyone joins the same Wi-Fi, or the host's phone hotspot. Mobile data can stay off.
2. **Host:** Nearby → **Host**, then **Add a phone**.
3. **Friend:** Nearby → **Join**. The camera opens: scan the host's code (step 1). A reply code appears on the friend's phone.
4. **Host:** tap **They've scanned it: next** and scan the friend's reply (step 2). Repeat for each friend.

If phones won't connect on one phone's hotspot, try the other phone's hotspot or a normal Wi-Fi network. If a phone drops out, the host taps menu → **Phones** → **Add a phone** and the two swap codes again; the seat and cards are kept.

### Privacy and fairness

The host sends each phone only what that player may see: their own hand, the table, and the partner's hand only when that rule is on and the deck is finished. The other phones never receive the host's cards. Nothing is sent to any server except the room-code handshake.

## Settlers deck photos (private, never hosted)

The photos are not in this repo or on the website. They live in an encrypted **photo pack** (`settlers.ebdeck`) that only the deck code opens (PBKDF2-SHA256 + AES-256-GCM). Keep the pack in a private place (e.g. your group chat) and don't commit it; `*.ebdeck` and `assets/settlers/` are in `.gitignore`.

- **Load it on a phone:** Deck → **Have a photo pack?** → choose the `.ebdeck` file, enter its code, tap **Unlock**. The photos are stored only in that phone's browser storage (IndexedDB) and work offline. **Remove photos from this phone** deletes them.
- **Friends don't need the file:** in a multiplayer game, when Settlers is the shared deck, any phone that has the photos sends them over the game's direct encrypted connection (guest → host → other guests). Each phone keeps them afterwards.
- **The code is the lock.** It is not stored in the app or this repo; it only opens the pack. A short code can be guessed offline by someone who has the pack file and really tries, so use a long one (a few random words) and don't post it with the file. To change it, rebuild the pack with the new code and share the new file.

**Making or updating a pack** (e.g. to add photos for more cards): put one image per card in a folder outside the repo, named by card id `cNN.jpg` (or `.png`/`.webp`), then:

```
node tools/make-pack.mjs ~/settlers-photos 'your code here' settlers.ebdeck
```

Card id = suit × 10 + rank − 1. Suits: Denari 0, Coppe 1, Spade 2, Bastoni 3. Ranks: Asso 1, Fante 8, Cavallo 9, Re 10. Any card can have a photo: Fante, Cavallo and Re fill the card behind the corner indices and a role banner (crop 9:16, e.g. 480×848, subject centred, nothing important in the bottom 12%); every other card gets an oval medallion with a ribbon naming the card (crop 64:85, e.g. 320×425). Keep each image under about 100 KB. Load the new pack on one phone; it reaches the others in the next game.

| Suit | Asso | Fante | Cavallo | Re |
| --- | --- | --- | --- | --- |
| Denari | c00 | c07 | c08 | c09 |
| Coppe | c10 | c17 | c18 | c19 |
| Spade | c20 | c27 | c28 | c29 |
| Bastoni | c30 | c37 | c38 | c39 |

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
- `src/photos.js`: encrypted photo packs, on-phone photo storage
- `tools/make-pack.mjs`: builds a photo pack
- `src/net.js`: WebRTC link, PeerJS signalling client, QR encode/scan, pairing codes
- `src/app.js`, `src/style.css`, `src/body.html`, `src/i18n.js`: UI, game flow, host/guest logic
- `src/vendor/`: [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (MIT) and [jsQR](https://github.com/cozmo/jsQR) (Apache-2.0), minified
- `build.mjs`: inlines everything into the single-file `index.html`
