/* UI strings, English and Italian. */
(function (root) {
  'use strict';
  const en = {
    tagline: 'For 2 to 4 players, on one phone or several',
    resume: 'Resume game', resume_d: 'Hand {hand} in progress · {names}',
    players: 'Players', seat: 'Player {n}', cpu_name: 'CPU {n}', human: 'Human', cpu: 'CPU',
    easy: 'Easy', normal: 'Normal', hard: 'Hard',
    teams_hint: 'Four players play as two teams. Partners sit opposite: {a} & {c} against {b} & {d}.',
    three_hint: 'Three players: each plays alone and the 2 of Cups is taken out of the deck.',
    need_human: 'Make at least one player human.',
    deck: 'Deck', change: 'Change', choose_deck: 'Choose a regional deck',
    sys_it: 'Italian suits', sys_es: 'Spanish-type suits', sys_fr: 'French suits',
    double: 'double-headed courts', full: 'full-length courts',
    options: 'Options',
    opt_hide: 'Hide hands between turns', opt_hide_d: 'Shows a pass-the-phone screen before each human turn, so nobody sees another hand.',
    opt_twotap: 'Tap twice to play', opt_twotap_d: 'First tap lifts the card, second tap plays it. Stops misplays on a passed-around phone.',
    opt_swap: 'Swap the face-up briscola', opt_swap_d: 'House rule: whoever holds this trump may exchange it for the face-up card while the deck lasts.',
    off: 'Off',
    opt_partner: 'Partners show their cards at the end', opt_partner_d: 'Four players: once the deck runs out, you can see your partner’s hand.',
    opt_score: 'Show points during play', opt_score_d: 'Traditionally the score stays secret until the end of the hand.',
    opt_match: 'Hands to win the match',
    opt_speed: 'Game speed', slow: 'Slow', fast: 'Fast',
    opt_sound: 'Sound',
    lang: 'Language',
    rules: 'Rules', deal: 'Deal the cards',
    briscola: 'Briscola', in_deck: '{n} in deck', last_card: 'last card', deck_empty: 'deck empty',
    your_turn: '{name}, your turn', tap2: 'Tap a card to lift it, tap again to play', tap1: 'Tap a card to play it',
    thinking: '{name} is playing…', waiting: 'Waiting for {name}',
    takes: '{name} takes {pts}', pts: '{n} points', pt1: '1 point', pt0: 'no points',
    last_trick: 'Last trick', no_trick: 'No tricks played yet.', trick_of: 'Trick {i} of {n}',
    pass_to: 'Pass the phone to', tap_reveal: 'Show my cards', you_lead: 'You lead this trick.', on_table: '{n} on the table.',
    swap_btn: 'Swap for {card}', swapped: '{name} swapped the {give} for the {took}',
    dealer: 'D', partner: 'partner', you: 'you',
    menu: 'Menu', back_game: 'Back to the game', redeal: 'Redeal this hand', quit: 'Quit to setup',
    confirm_quit: 'Quit this game? The current hand and match score are lost.', confirm_redeal: 'Redeal this hand? Cards played so far are discarded.',
    yes_quit: 'Quit', yes_redeal: 'Redeal', cancel: 'Cancel', close: 'Close',
    hand_over: 'Hand {n} over', wins: '{name} wins', win_pl: '{name} win', draw: 'Draw at 60–60',
    match: 'Match', first_to: 'first to {n}', next_hand: 'Next hand', new_match: 'New match', match_won: '{name} wins the match', match_won_pl: '{name} win the match',
    setup: 'Setup', cards_n: '{n} cards', team: '{a} & {b}',
    rank_1: 'Ace', rank_8: 'Jack', rank_9: 'Knight', rank_9fr: 'Queen', rank_10: 'King', of: 'of',
    suits_latin: ['Coins', 'Cups', 'Swords', 'Clubs'], suits_fr: ['Diamonds', 'Hearts', 'Spades', 'Clubs'],
    rules_html: `
      <h3>Goal</h3><p>Win tricks containing valuable cards. The deck holds 120 points; more than 60 wins the hand, 60 each is a draw.</p>
      <h3>Card values</h3>
      <table class="vals"><tr><td>Ace</td><td>11</td></tr><tr><td>Three</td><td>10</td></tr><tr><td>King</td><td>4</td></tr><tr><td>Knight (Queen in French decks)</td><td>3</td></tr><tr><td>Jack</td><td>2</td></tr><tr><td>7, 6, 5, 4, 2</td><td>0</td></tr></table>
      <p>Strength in a trick follows the same order: Ace, 3, King, Knight, Jack, 7, 6, 5, 4, 2.</p>
      <h3>Play</h3>
      <ul><li>Everyone gets three cards. The next card is turned face up: its suit is the <b>briscola</b> (trumps). It sits under the deck and is the last card drawn.</li>
      <li>The player after the dealer leads; play goes counter-clockwise. You may play any card: there is no need to follow suit.</li>
      <li>The highest briscola wins the trick. With no briscola, the highest card of the suit led wins.</li>
      <li>The winner draws first, then the others in turn, and leads the next trick. When the deck is gone, play out your hand.</li></ul>
      <h3>Three players</h3><p>The 2 of Cups is removed so the deck deals evenly. Each player plays alone.</p>
      <h3>Four players</h3><p>Two teams of two, partners opposite each other. Team points are added together. Optionally partners may look at each other’s hand once the deck is finished.</p>
      <h3>Swapping the briscola (optional)</h3><p>A common house rule: whoever holds the 2 (or 7) of trumps may exchange it for the face-up briscola on their turn, while cards remain to be drawn.</p>
      <h3>Playing on one phone</h3><p>With hands hidden, a pass-the-phone screen appears before each human turn. The table is public, so everyone can watch tricks being played. Empty seats can be filled by CPU players.</p>`,
  };

  const it = {
    tagline: 'Da 2 a 4 giocatori, su uno o pi\u00f9 telefoni',
    resume: 'Riprendi la partita', resume_d: 'Mano {hand} in corso · {names}',
    players: 'Giocatori', seat: 'Giocatore {n}', cpu_name: 'CPU {n}', human: 'Umano', cpu: 'CPU',
    easy: 'Facile', normal: 'Normale', hard: 'Difficile',
    teams_hint: 'In quattro si gioca a coppie. I compagni siedono di fronte: {a} e {c} contro {b} e {d}.',
    three_hint: 'In tre: ognuno gioca per sé e si toglie il 2 di Coppe dal mazzo.',
    need_human: 'Almeno un giocatore deve essere umano.',
    deck: 'Mazzo', change: 'Cambia', choose_deck: 'Scegli le carte regionali',
    sys_it: 'semi italiani', sys_es: 'semi spagnoli', sys_fr: 'semi francesi',
    double: 'figure a due teste', full: 'figure intere',
    options: 'Opzioni',
    opt_hide: 'Nascondi le carte tra i turni', opt_hide_d: 'Prima di ogni turno umano appare una schermata per passare il telefono, così nessuno vede le carte altrui.',
    opt_twotap: 'Doppio tocco per giocare', opt_twotap_d: 'Il primo tocco solleva la carta, il secondo la gioca. Evita errori passando il telefono.',
    opt_swap: 'Scambio della briscola scoperta', opt_swap_d: 'Regola della casa: chi ha questa carta di briscola può scambiarla con quella scoperta finché c’è il mazzo.',
    off: 'No',
    opt_partner: 'I compagni si mostrano le carte alla fine', opt_partner_d: 'In quattro: finito il mazzo, vedi le carte del compagno.',
    opt_score: 'Mostra i punti durante la mano', opt_score_d: 'Di solito i punti restano segreti fino alla fine della mano.',
    opt_match: 'Mani per vincere la partita',
    opt_speed: 'Velocità di gioco', slow: 'Lenta', fast: 'Veloce',
    opt_sound: 'Suoni',
    lang: 'Lingua',
    rules: 'Regole', deal: 'Distribuisci le carte',
    briscola: 'Briscola', in_deck: '{n} nel mazzo', last_card: 'ultima carta', deck_empty: 'mazzo finito',
    your_turn: 'Tocca a te, {name}', tap2: 'Tocca una carta per sollevarla, tocca ancora per giocarla', tap1: 'Tocca una carta per giocarla',
    thinking: '{name} sta giocando…', waiting: 'Si aspetta {name}',
    takes: '{name} prende {pts}', pts: '{n} punti', pt1: '1 punto', pt0: 'zero punti',
    last_trick: 'Ultima presa', no_trick: 'Nessuna presa ancora.', trick_of: 'Presa {i} di {n}',
    pass_to: 'Passa il telefono a', tap_reveal: 'Mostra le mie carte', you_lead: 'Inizi tu questa presa.', on_table: '{n} in tavola.',
    swap_btn: 'Scambia con il {card}', swapped: '{name} ha scambiato il {give} con il {took}',
    dealer: 'M', partner: 'compagno', you: 'tu',
    menu: 'Menu', back_game: 'Torna al gioco', redeal: 'Ridistribuisci la mano', quit: 'Esci',
    confirm_quit: 'Uscire dalla partita? La mano e il punteggio andranno persi.', confirm_redeal: 'Ridistribuire? Le carte giocate finora vengono scartate.',
    yes_quit: 'Esci', yes_redeal: 'Ridistribuisci', cancel: 'Annulla', close: 'Chiudi',
    hand_over: 'Fine della mano {n}', wins: 'Vince {name}', win_pl: 'Vincono {name}', draw: 'Pareggio, 60 a 60',
    match: 'Partita', first_to: 'chi arriva a {n}', next_hand: 'Prossima mano', new_match: 'Nuova partita', match_won: '{name} vince la partita', match_won_pl: '{name} vincono la partita',
    setup: 'Impostazioni', cards_n: '{n} carte', team: '{a} e {b}',
    rank_1: 'Asso', rank_8: 'Fante', rank_9: 'Cavallo', rank_9fr: 'Donna', rank_10: 'Re', of: 'di',
    suits_latin: ['Denari', 'Coppe', 'Spade', 'Bastoni'], suits_fr: ['Quadri', 'Cuori', 'Picche', 'Fiori'],
    rules_html: `
      <h3>Scopo</h3><p>Vincere prese con carte di valore. Il mazzo vale 120 punti: con più di 60 si vince la mano, 60 a testa è pareggio.</p>
      <h3>Valore delle carte</h3>
      <table class="vals"><tr><td>Asso</td><td>11</td></tr><tr><td>Tre</td><td>10</td></tr><tr><td>Re</td><td>4</td></tr><tr><td>Cavallo (Donna nei semi francesi)</td><td>3</td></tr><tr><td>Fante</td><td>2</td></tr><tr><td>7, 6, 5, 4, 2</td><td>0</td></tr></table>
      <p>La forza nella presa segue lo stesso ordine: Asso, 3, Re, Cavallo, Fante, 7, 6, 5, 4, 2.</p>
      <h3>Il gioco</h3>
      <ul><li>Si danno tre carte a testa. La carta successiva si scopre: il suo seme è la <b>briscola</b>. Va sotto il mazzo ed è l’ultima carta pescata.</li>
      <li>Inizia il giocatore dopo il mazziere; si gira in senso antiorario. Si può giocare qualsiasi carta: non c’è obbligo di rispondere al seme.</li>
      <li>Vince la briscola più alta. Senza briscole, vince la carta più alta del seme di uscita.</li>
      <li>Chi prende pesca per primo, poi gli altri in ordine, e apre la presa successiva. Finito il mazzo si giocano le carte rimaste.</li></ul>
      <h3>In tre</h3><p>Si toglie il 2 di Coppe perché le carte si dividano in parti uguali. Ognuno gioca per sé.</p>
      <h3>In quattro</h3><p>Due coppie, i compagni seduti di fronte. I punti della coppia si sommano. Se si vuole, finito il mazzo i compagni si mostrano le carte.</p>
      <h3>Scambio della briscola (facoltativo)</h3><p>Regola diffusa: chi ha il 2 (o il 7) di briscola può scambiarlo con la briscola scoperta nel proprio turno, finché ci sono carte da pescare.</p>
      <h3>Su un solo telefono</h3><p>Con le carte nascoste, prima di ogni turno umano appare una schermata per passare il telefono. La tavola è pubblica: tutti vedono le prese. I posti vuoti possono essere occupati dalla CPU.</p>`,
  };

  Object.assign(en, {
    phones: 'Separate phones',
    phones_d: 'Each player uses their own phone and sees only their own cards. Pair phones on the same Wi-Fi or hotspot with QR codes (no internet needed), or over the internet with a room code.',
    add_qr: 'Add a phone with QR', add_qr_d: 'offline, same Wi-Fi or hotspot',
    open_room: 'Open a room code', open_room_d: 'needs internet on both phones',
    join_game: 'Join someone else’s game',
    close_room: 'Close room', room_code: 'Room code',
    room_hint: 'On the other phone tap Join, then enter this code. Or scan this QR with the phone camera to open the game and join.',
    room_opening: 'Opening room…',
    this_phone: 'This phone', remote: 'Other phone', choose_phone: 'Phone',
    st_online: 'connected', st_offline: 'disconnected', remove: 'Remove',
    need_device: 'Pick a connected phone for every “Other phone” seat.',
    need_local: 'Keep at least one human seat on this phone.',
    pair_title: 'Add a phone',
    pair_s1: 'On the other phone open Briscola, tap Join someone else’s game → Scan host code, and point it here.',
    pair_s2: 'Then scan the code that appears on their screen.',
    cam_start: 'Starting camera…', cam_on: 'Point the camera at their code.',
    cam_denied: 'Camera unavailable. Allow camera access in browser settings, or use the text codes below.',
    trouble: 'Trouble scanning? Use text codes instead', copy: 'Copy', copied: 'Copied',
    paste_reply: 'Paste their reply code', connect: 'Connect',
    connecting: 'Connecting…', pair_ok: '{name} connected',
    pair_fail: 'Could not connect. Put both phones on the same Wi-Fi or hotspot and try again.',
    bad_code: 'That is not a Briscola pairing code.',
    join_title: 'Join a game', your_name: 'Your name', scan_host: 'Scan host code',
    scan_host_d: 'offline, same Wi-Fi or hotspot', or_room: 'Or join with a room code (internet)', join: 'Join',
    join_s2: 'Now show this code to the host so they can scan it.',
    paste_host: 'Paste the host code', use_code: 'Use code', your_reply: 'Your reply code',
    room_fail: 'No game found with that code. Check it with the host.',
    broker_fail: 'Cannot reach the matchmaking server. Use QR pairing instead: it works offline.',
    p2p_fail: 'Found the game but could not connect directly. Put both phones on the same Wi-Fi or hotspot, or use QR pairing.',
    lobby_title: 'Connected to {name}', lobby_wait: 'Waiting for {name} to deal.', leave: 'Leave game',
    seats_title: 'Seats', you_tag: 'this phone',
    lost: 'Connection lost.', reconnecting: 'Reconnecting…',
    repair_hint: 'Ask the host to add this phone again with QR, then scan their code.',
    rejoin: 'Rejoin room {code}',
    dev_off: '{name} disconnected', phones_menu: 'Phones',
    wait_remote: 'Waiting for {name}…', wait_off: 'Waiting for {name} to reconnect',
    ver_mismatch: 'The other phone has a different version of Briscola. Reload the page on both phones.',
    host_tag: 'host', on: 'On',
    guest_next: 'Next hand',
    no_webrtc: 'This browser cannot connect phones. Use Chrome on Android or Safari on iPhone.',
  });

  Object.assign(it, {
    phones: 'Telefoni separati',
    phones_d: 'Ogni giocatore usa il proprio telefono e vede solo le proprie carte. Collega i telefoni sulla stessa Wi-Fi o hotspot con i codici QR (senza internet), oppure via internet con un codice stanza.',
    add_qr: 'Aggiungi un telefono con QR', add_qr_d: 'offline, stessa Wi-Fi o hotspot',
    open_room: 'Apri un codice stanza', open_room_d: 'serve internet su entrambi i telefoni',
    join_game: 'Unisciti alla partita di un altro',
    close_room: 'Chiudi stanza', room_code: 'Codice stanza',
    room_hint: 'Sull’altro telefono tocca Unisciti e inserisci questo codice. Oppure inquadra questo QR con la fotocamera per aprire il gioco ed entrare.',
    room_opening: 'Apertura stanza…',
    this_phone: 'Questo telefono', remote: 'Altro telefono', choose_phone: 'Telefono',
    st_online: 'connesso', st_offline: 'disconnesso', remove: 'Rimuovi',
    need_device: 'Scegli un telefono connesso per ogni posto “Altro telefono”.',
    need_local: 'Tieni almeno un posto umano su questo telefono.',
    pair_title: 'Aggiungi un telefono',
    pair_s1: 'Sull’altro telefono apri Briscola, tocca Unisciti alla partita di un altro → Scansiona il codice, e inquadra qui.',
    pair_s2: 'Poi scansiona il codice che appare sul suo schermo.',
    cam_start: 'Avvio fotocamera…', cam_on: 'Inquadra il suo codice.',
    cam_denied: 'Fotocamera non disponibile. Consenti l’accesso nelle impostazioni del browser, oppure usa i codici di testo qui sotto.',
    trouble: 'Problemi con la scansione? Usa i codici di testo', copy: 'Copia', copied: 'Copiato',
    paste_reply: 'Incolla il codice di risposta', connect: 'Collega',
    connecting: 'Connessione…', pair_ok: '{name} connesso',
    pair_fail: 'Connessione non riuscita. Metti entrambi i telefoni sulla stessa Wi-Fi o hotspot e riprova.',
    bad_code: 'Questo non è un codice di Briscola.',
    join_title: 'Unisciti a una partita', your_name: 'Il tuo nome', scan_host: 'Scansiona il codice',
    scan_host_d: 'offline, stessa Wi-Fi o hotspot', or_room: 'Oppure entra con un codice stanza (internet)', join: 'Entra',
    join_s2: 'Ora mostra questo codice a chi ospita, che lo deve scansionare.',
    paste_host: 'Incolla il codice di chi ospita', use_code: 'Usa il codice', your_reply: 'Il tuo codice di risposta',
    room_fail: 'Nessuna partita con questo codice. Controllalo con chi ospita.',
    broker_fail: 'Server di collegamento irraggiungibile. Usa il QR: funziona offline.',
    p2p_fail: 'Partita trovata ma connessione diretta non riuscita. Metti i telefoni sulla stessa Wi-Fi o hotspot, oppure usa il QR.',
    lobby_title: 'Connesso a {name}', lobby_wait: 'Si aspetta che {name} distribuisca.', leave: 'Esci dalla partita',
    seats_title: 'Posti', you_tag: 'questo telefono',
    lost: 'Connessione persa.', reconnecting: 'Riconnessione…',
    repair_hint: 'Chiedi a chi ospita di aggiungere di nuovo questo telefono con il QR, poi scansiona il codice.',
    rejoin: 'Rientra nella stanza {code}',
    dev_off: '{name} disconnesso', phones_menu: 'Telefoni',
    wait_remote: 'Si aspetta {name}…', wait_off: 'Si aspetta che {name} si riconnetta',
    ver_mismatch: 'L’altro telefono ha una versione diversa di Briscola. Ricarica la pagina su entrambi.',
    host_tag: 'ospita', on: 'Sì',
    guest_next: 'Prossima mano',
    no_webrtc: 'Questo browser non può collegare i telefoni. Usa Chrome su Android o Safari su iPhone.',
  });
  root.BriscolaI18n = { en, it };
})(typeof self !== 'undefined' ? self : this);
