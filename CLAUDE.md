# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"بايو" (BIO; formerly لَمة/Lamma and جمعة/jam3a — repo and Firebase ids keep the jam3a name) — Arabic RTL (+ English LTR UI) two-team science/trivia party game (host-judged, like seenjeem). Brand = the Biological Sciences Club logo in `assets/logo.png` (white text → always shown on a dark plate). Fully static site: vanilla HTML/CSS/JS, no build step, no dependencies, no backend. Deployed via GitHub Pages from `main` (https://ahmed921x-art.github.io/jam3a-game/). Installable PWA with offline support.

## Commands

```bash
# Run locally (a server is required for the service worker; opening index.html directly also works for everything else)
python -m http.server 8765   # then open http://localhost:8765

# Syntax-check after editing JS (no test suite exists)
node --check game.js

# Validate question data integrity (counts, per-tier coverage, duplicate questions)
node -e "const fs=require('fs');let s=['questions.js','questions-extra.js','questions-kuwait.js','questions-pack2.js','questions-bio.js'].map(f=>fs.readFileSync(f,'utf8')).join('\n').replace('const CATEGORIES','var CATEGORIES');eval(s);console.log(CATEGORIES.length+' cats, '+CATEGORIES.reduce((n,c)=>n+c.questions.length,0)+' questions')"
```

Pushing to `main` deploys to production immediately.

## Architecture

All scripts are plain IIFE modules attached as globals, loaded in a strict order set in `index.html` (bottom of body):

```
questions.js → questions-extra.js → questions-kuwait.js → questions-pack2.js → questions-bio.js → gaming-pack.js
→ i18n.js → auth.js → catalog.js → sounds.js → effects.js → game-logic.js → game.js → match-logic.js → match.js → bio-ui.js
```

- **`questions.js`** declares `const CATEGORIES = [...]` (the base packs). The other three question files **extend it via `CATEGORIES.push(...)`**, so they must load after it and before `game.js`. Each category: `{ id, name, icon, img?, questions: [{ points: 200|400|600, q, a, img?, aImg? }] }` with **at least 2 questions per point tier** (the game picks 2 per tier per board). `img`/`aImg` are optional image URLs (category card, question image, answer image) — rendered when present, icon/text-only otherwise. Run the validation one-liner above after touching question files; also watch for duplicate questions across categories (same question in two categories can appear twice in one game).
- **`game.js`** — single `Game` IIFE holding all game state (`state` object) and screen logic. Screens are `<section class="screen">` elements toggled with `.active`; modals are `.modal` divs toggled with `.active`. HTML calls into it via `onclick="Game.xxx()"`, so any new handler must be exported in the `return {...}` block at the bottom. `state.answerShown` is the single source of truth for whether the current answer is revealed (do not re-check DOM classes).
- **`auth.js`** — Firebase Auth (Google sign-in + guest mode) behind the original synchronous surface (`Auth.current()`, `Auth.key()`, `Auth.onChange()`). Firebase project: `jam3a-game` (config in `firebase-config.js`, compat SDK from CDN — no build step). Per-user storage keys come from `Auth.key(base)` → `sj_u_<uid>_<base>`; game.js `uWrite` writes localStorage first then `Auth.cloudSet()` debounce-syncs stats/history/custom/ach to Firestore `users/{uid}` (guest = local only). On login, cloud data wins; missing fields are uploaded from local. Security rules in `firestore.rules` (deploy: `firebase deploy --only firestore:rules`).
- **`questions-bio.js`** must load **last** among question files: it pushes the biology packs, sets `group` (`bio`/`kuwait`/`general`) on every category, and sorts `CATEGORIES` (bio first). Content sources/human-review list: `CONTENT-REVIEW.md`.
- **`i18n.js`** — `I18N` dictionary (ar/en). `I18N.t(key, vars)` fills `{placeholders}`. Static UI uses `data-i18n` (text only — it replaces textContent), `data-i18n-ph`, `data-i18n-aria`, `data-i18n-title`, `data-i18n-alt`; fires `i18n:change`. Dynamic strings built in game.js are still Arabic-only — ready-made `js_*` keys exist for them. New static labels need keys in **both** languages.
- **`bio-ui.js`** — presentation-only layer (never mutates game state, never calls `Game.*`): category search/filter (`#catSearch`, `#catFilters`, `.cat-tile[data-group]`), setup start bar (`#setupStatus`, parses `#catCounter` "x / y"), theme labels, golden-round wager chips/steps, modal focus trap/restore, achievements count, editor empty state. It observes DOM that game.js renders — keep those class names in sync.
- **Design system** — tokens at the top of `style.css` (logo colors, ink surfaces, `--accent` per theme, `body[data-mode="light"]`). Surface tokens (`--surface`, `--surface-2`) are declared on `body`, not `:root`, so light mode can override them. `landing.css` holds landing/result/auth/profile/help/editor. Note: `updateCounter()` writes into the first `.hint b` in the document — keep `#catsHint` first.
- **`sounds.js`** (`Sound`, Web Audio synth — no audio files), **`effects.js`** (`FX`, starfield/confetti canvas).
- **`sw.js`** — precache list `ASSETS` + cache-first fetch. **Any new file must be added to `ASSETS`, and `CACHE` must be bumped (`bio-vN`) on every release**, otherwise installed PWAs keep serving stale code.

- **`game-logic.js`** (`BioRules`) — pure rules (board picking without duplicate questions, swap replacement, award, wager clamp, golden round, drift-free timer, save-snapshot validation, custom-category sanitising). Loaded before `game.js`; tested with `node --test tests/content.test.js tests/game-logic.test.js`.
- **Admin (`admin.html` + `admin.js` + `admin.css`)** — Google sign-in; admins are `config/admins` `{owners, editors}` in Firestore (owners added in the Firebase console only; owners manage editors in the page). Writes `categories/{id}` (admin categories, per-question `img`/`aImg`) and `catalog/overrides` `{hidden, images}`; enforced by `firestore.rules` (deploy: `firebase deploy --only firestore:rules`). **`catalog.js`** (loaded after `auth.js`, before `game.js`) applies the cached catalog synchronously (`localStorage` `bio_catalog_v1`), then fetches Firestore and calls `Game.refreshCatalog()` if it changed. Image paths must start with `assets/` or `https://`; files go in `assets/categories/` and `assets/questions/` (see their READMEs).
- **`sw.js`** cache name is now `bio-vN` (network-first for same-origin files, cache fallback offline; only deletes its own `bio-`/`jam3a-v` caches).

Legacy note: localStorage keys and the password-hash salt still use the `sj_`/seenjeem prefix from the project this was forked from. Do not "clean these up" — renaming them wipes existing users' accounts, stats, and custom categories.

## «سين وجيم» match mode (default from the landing page)

- **`match-logic.js`** (`MatchRules`) — pure, immutable rules (every action returns a new state). `buildBoard(cats, {values})`: each column is **two different questions per difficulty** — data `points` 200/400/600 = easy/medium/hard, shown with the chosen value preset (`VALUES`: 100·200·300 … 500·1000·1500) — so both teams get equal chances in every category (سين جيم fairness). Media questions in one column never share an answer. `newMatch` (snapshot version 2), `open` → `reveal` / `judge(correct)` / `skip` → `close`. A wrong answer applies the optional penalty and, if steal is on **and the answer is not yet revealed**, moves to `stage: "steal"` for the other side. A cell becomes `used` exactly once; `close` passes the turn to the side that did *not* choose and rotates its player. `pickClip(q, len)` picks a random snippet fully inside a safe window (`win`). Tested in `tests/match-logic.test.js`.
- **`match.js`** (`Match`) — UI only: setup (`#matchSetupScreen`: mode teams/1v1, names, colors, players, **exactly 3/4/5/6 categories**, value preset, timers, steal, penalty, song-snippet length), board (`#matchBoardScreen`, one `.mb-tier` row of two cells per value), question (`#mqModal`), result (`#matchResultScreen`). Saves to `Auth.key("match")`; undo restores the snapshot before the last `open`. Stats/history via `Game.recordMatch`. Keys: Space reveal (even with focus on a button), 1 correct, 2 wrong, 0 no one, Enter back to board.
- **Clips** (`clipSpec` in match.js): songs play `rules.clip` seconds or auto by tier (`CLIP_AUTO` 12/8/5 s), videos 30/20/12 s, from a random start inside `win` each time. The host can add 5 s (➕) or pin a start per device (📌, `localStorage` `bio_clip_starts`). Images are unblurred; `zoom`/`focus` crop until reveal. Board images are prefetched at low priority and the YouTube API loads when the board opens.
- `Game.show()` hides **all** `.screen` elements (`Game.showScreen(id)`), so classic and match screens never stack. The classic picker hides categories that fail `BioRules.validCategory`.
- **YouTube media**: a question with `yt: "<11-char id>"` (+ `start`/`end` seconds) plays through the YouTube IFrame API (`loadYT()` in match.js, `youtube-nocookie` host, `controls: 0`, captions unloaded). `type: "audio"` hides the player behind `.mq-yt-cover` until reveal; `type: "video"` crops the frame (`scale(1.45)`) and covers it with `.mq-yt-pause` whenever it isn't playing (YouTube shows the title/thumbnail while paused). Both use the same custom controls via the `media` adapter (`ytAdapter` / `elementAdapter`). Embed-blocked videos (errors 101/150) show a message + "open on YouTube" link. Clips are never downloaded. Character/cover images hotlink `upload.wikimedia.org`.
- **Content** (`gaming-pack.js`): three groups — `gaming` (video games only), `anime`, `cartoon` (+ legacy `videogames`/`cartoons` regrouped). Setup lists categories in sections by group (`GROUPS` in match.js). Song `win` windows come from synced lyrics (lrclib) or YouTube auto-transcripts and exclude every line that sings the show's name. Images hotlink Steam, smashbros.com, Wikimedia, AniList. Add content with the project skill `.claude/skills/add-quiz-content/` and `tools/content/*.js`; run `node tools/content/check-pack.js` before release.
- `effects.js` exposes `FX.pauseBackground(bool)`; match.js pauses the animated background while a question is open (it competed with video playback). The YouTube adapter pre-buffers muted on ready so playback starts without stalling.

## Classic game flow (game.js)

landing → setup (teams, 4–6 categories, theme, golden-round toggle) → `start()` builds board from `pickQuestions()` (each board category also keeps `pool: c.questions` for the swap lifeline) → cells open `openQuestion()` with a count-**up** stopwatch (pause/reset, no auto-reveal) → the question frame `#qFrame` switches views via `data-view`: `q` (question, green «الإجابة» button) → `a` (answer, «أي فريق ؟» / «ارجع للسؤال») → `j` (judge: red team buttons + «ولا أحد») → `award()` (keyboard 1/2/0 only after reveal) → when board completes: optional **golden round** (`openGolden()`) → tie triggers `startTieBreaker()` → `endGame()` records stats/history/achievements. In-progress games persist via `saveGame()`/`resume()` per user.

Lifelines (one each per team, seenjeem-style): clicking a circular icon opens a sidebar card (`#llCard`, replaces the team panels) with a description and a start button — `swap` (replace current question from `cat.pool`, same tier), `phone` (60s green-ring countdown that pauses the question stopwatch), `two` (team may give two answers; shows a note under the question). A light/dark mode toggle lives in the in-game header (`Game.toggleMode()`, key `sj_mode`).
