# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"لَمة" (Lamma, formerly جمعة/jam3a — repo and Firebase ids keep the jam3a name) — Arabic RTL two-team trivia party game (host-judged, like seenjeem). Fully static site: vanilla HTML/CSS/JS, no build step, no dependencies, no backend. Deployed via GitHub Pages from `main` (https://ahmed921x-art.github.io/jam3a-game/). Installable PWA with offline support.

## Commands

```bash
# Run locally (a server is required for the service worker; opening index.html directly also works for everything else)
python -m http.server 8765   # then open http://localhost:8765

# Syntax-check after editing JS (no test suite exists)
node --check game.js

# Validate question data integrity (counts, per-tier coverage, duplicate questions)
node -e "const fs=require('fs');let s=['questions.js','questions-extra.js','questions-kuwait.js','questions-pack2.js'].map(f=>fs.readFileSync(f,'utf8')).join('\n').replace('const CATEGORIES','var CATEGORIES');eval(s);console.log(CATEGORIES.length+' cats, '+CATEGORIES.reduce((n,c)=>n+c.questions.length,0)+' questions')"
```

Pushing to `main` deploys to production immediately.

## Architecture

All scripts are plain IIFE modules attached as globals, loaded in a strict order set in `index.html` (bottom of body):

```
questions.js → questions-extra.js → questions-kuwait.js → questions-pack2.js
→ i18n.js → auth.js → sounds.js → effects.js → game.js
```

- **`questions.js`** declares `const CATEGORIES = [...]` (the base packs). The other three question files **extend it via `CATEGORIES.push(...)`**, so they must load after it and before `game.js`. Each category: `{ id, name, icon, img?, questions: [{ points: 200|400|600, q, a, img?, aImg? }] }` with **at least 2 questions per point tier** (the game picks 2 per tier per board). `img`/`aImg` are optional image URLs (category card, question image, answer image) — rendered when present, icon/text-only otherwise. Run the validation one-liner above after touching question files; also watch for duplicate questions across categories (same question in two categories can appear twice in one game).
- **`game.js`** — single `Game` IIFE holding all game state (`state` object) and screen logic. Screens are `<section class="screen">` elements toggled with `.active`; modals are `.modal` divs toggled with `.active`. HTML calls into it via `onclick="Game.xxx()"`, so any new handler must be exported in the `return {...}` block at the bottom. `state.answerShown` is the single source of truth for whether the current answer is revealed (do not re-check DOM classes).
- **`auth.js`** — Firebase Auth (Google sign-in + guest mode) behind the original synchronous surface (`Auth.current()`, `Auth.key()`, `Auth.onChange()`). Firebase project: `jam3a-game` (config in `firebase-config.js`, compat SDK from CDN — no build step). Per-user storage keys come from `Auth.key(base)` → `sj_u_<uid>_<base>`; game.js `uWrite` writes localStorage first then `Auth.cloudSet()` debounce-syncs stats/history/custom/ach to Firestore `users/{uid}` (guest = local only). On login, cloud data wins; missing fields are uploaded from local. Security rules in `firestore.rules` (deploy: `firebase deploy --only firestore:rules`).
- **`i18n.js`** — `I18N` dictionary (ar/en). Static UI text uses `data-i18n` attributes; dynamic strings built in game.js are Arabic-only. New static labels need keys in **both** languages.
- **`sounds.js`** (`Sound`, Web Audio synth — no audio files), **`effects.js`** (`FX`, starfield/confetti canvas).
- **`sw.js`** — precache list `ASSETS` + cache-first fetch. **Any new file must be added to `ASSETS`, and `CACHE` must be bumped (`jam3a-vN`) on every release**, otherwise installed PWAs keep serving stale code.

Legacy note: localStorage keys and the password-hash salt still use the `sj_`/seenjeem prefix from the project this was forked from. Do not "clean these up" — renaming them wipes existing users' accounts, stats, and custom categories.

## Game flow (game.js)

landing → setup (teams, 4–6 categories, timer, theme, golden-round toggle) → `start()` builds board from `pickQuestions()` → cells open `openQuestion()` with countdown (timeout auto-reveals the answer) → host awards points (`award()`, keyboard 1/2/0 only after reveal) → when board completes: optional **golden round** (`openGolden()` — each team wagers up to its score on one final question) → tie triggers `startTieBreaker()` → `endGame()` records stats/history/achievements. In-progress games persist via `saveGame()`/`resume()` per user.
