---
name: add-quiz-content
description: Add or refresh questions in the BIO quiz's match mode — game music, game sounds, gameplay videos, game screenshots, game/anime/cartoon character pictures, anime images, console photos, anime and classic-cartoon (Spacetoon) theme songs, or text trivia — in gaming-pack.js. Use whenever the user asks to add more questions/songs/videos/pictures/categories, says a category is running out or repeating, wants specific games/anime/cartoons/characters added, reports a song snippet that says the show's name, or a clip that doesn't play.
---

# Adding quiz content (بايو — مباراة سين وجيم)

All match-mode content lives in **`gaming-pack.js`**, in three arrays: `gaming` (🎮 video games ONLY), `anime` (🎌), `cartoon` (📺 classic Arabic-dubbed cartoons, Spacetoon era). The legacy `videogames`/`cartoons` categories are regrouped there too.

**Board rule:** `points` is the difficulty — **200 easy · 400 medium · 600 hard**. The board takes **two different questions per difficulty** per category (one square per team, like سين وجيم), so every category needs ≥2 per tier; aim for **6–8 per tier** so matches don't repeat. Media questions in one column never share an answer (same game/character).

The players are Kuwaiti university students and their families at event booths. Questions must be fun, fair, and human: write in Gulf-friendly Arabic, with the English name in parentheses for games and anime: `a: "قاتل الشياطين (Demon Slayer)"`. Easy (200) = everyone at the booth knows it, hard (600) = real fans.

## Hard rules (the user asked for these explicitly)

1. **🎮 = only video games.** Anime and cartoons go in their own groups. Other topics go in the base packs.
2. **Songs never reveal the show's name.** Every audio question has `win: [[from, to], ...]`, which lists safe windows where the name is not sung. The game plays a random snippet inside them, **12/8/5 s for 200/400/600**. The booth hosts won't adjust anything, so the windows must be right. Never add a cartoon/anime theme without verified windows.
3. **Games mostly from 1994 onward** (popular console/PC). A few iconic older ones are fine.
4. **Pictures are not blurred.** Players recognize from the picture. Never use an image that shows the game/anime title or logo; use `zoom: 1.1–1.2` to crop a corner watermark.
5. **Characters = picture only** (`type: "image"`), no text description.
6. **Never download/rip YouTube media** (the site is public). Embed by `yt` ID only. Don't hotlink Fandom (it blocks it) or bypass any hotlink protection.
7. **No self-made/synthesized media.**

## Helpers inside gaming-pack.js

`music(points, yt, win, a)` · `sound(points, yt, seconds, a)` · `play(points, yt, startSec, a)` (gameplay, random 90 s window) · `shot(points, steamPath, a, zoom?)` · `hero(points, img, a)` · `device(points, commonsPath, a)` · `op(points, yt, lengthSec, a)` (anime opening, window [2, len-8]) · `theme(points, yt, win, a)` (cartoon theme) · `animeHero(points, anilistFile, a)` · `cartoonHero(points, anilistFile, a)` · `banner(points, anilistBannerFile, a)`, plus image bases `STEAM()`, `SMASH()`, `WP`, `COMMONS()`, `CHAR()`, `BANNER()`.

## Workflow (run from the repo root; all tools need internet)

### 1. Find media
- **YouTube** (music, sounds, gameplay, themes): `node tools/content/yt-search.js "<query>" 5` → `id | title | length | channel | embed-ok/NO-EMBED`. Use only `embed-ok`. Prefer official channels (Spacetoon, Crunchyroll, publishers, "- Topic"). Gameplay: search `"<game> gameplay no commentary 4k"` and pick a start deep into the video (no menus or loading screens with the logo).
- **Safe windows for songs with lyrics** (anime, cartoons):
  1. `node tools/content/safe-windows.js --song "<name>" --ban "<name words, comma-separated, include spelling variants>" --search "<youtube query>"`
     - Uses synced lyrics from lrclib.net and picks the YouTube upload whose length matches, so the timing is right.
     - Prints every line (✘ = contains a banned word) and `yt: "...", win: [...]`.
     - Trust it only when `فرق` (difference) ≤ 2 s.
  2. If there are no synced lyrics, use **YouTube's automatic transcript** in the browser pane:
     - Open the video on youtube.com.
     - Expand the description (`ytd-watch-metadata #expand`), then click `ytd-video-description-transcript-section-renderer button`.
     - Read `transcript-segment-view-model` texts (`m:ss text`).
     - Exclude every line containing the name (ASR misspells names, e.g. «جراندايزر», «كن» for كونان, so ban generously). Also exclude Spacetoon's spoken promo at the end («أعزائي أصدقاء سبيس تون…»).
     - Watch out: the panel can leak the previous video's lines, and ASR sometimes picks the wrong language. If a transcript looks wrong, use another upload.
  3. If neither gives trustworthy timing, **don't add the song**. Tell the user which ones you skipped.
- **Screenshots**: `node tools/content/steam-shots.js "<game>"` → `STEAM("...")` paths + previews.
- **Game characters**: `node tools/content/find-image.js smash <id>...` (official hi-res; `koopa`=Bowser, `rockman`=Mega Man, `pac_man`). Otherwise `find-image.js wiki "<Wikipedia_Title>"` (~300 px).
- **Consoles**: `find-image.js commons "<File>"` (Evan-Amos photos).
- **Anime/cartoon characters & anime banners**: `node tools/content/anime-image.js character "<name>"` / `anime "<title>"`. Check that the returned show is the right one (search can match a different show).

### 2. Look before adding
Build a contact sheet in the browser pane (inject `<img>`s into a fixed overlay and screenshot) and check every image. Reject any with a visible title/logo, menus, wrong character, or a misleading look. For gameplay, check frames near the start time.

### 3. Edit `gaming-pack.js`
Use the helpers. Keep tiers balanced. Don't duplicate an answer inside a category. A new category is an object `{ id: "g-xxx" | "a-xxx" | "c-xxx", name, icon, questions }` in the right array.

### 4. Verify
- `node tools/content/check-pack.js`: two per tier, duplicate answers, every YouTube ID embeddable, every image loads. ⚠ lines mean throttling; rerun later.
- `node --test tests/*.test.js`
- In the browser (`python -m http.server 8765`): start a match with the edited categories, open new questions, press play (check the snippet length and that it starts instantly).

### 5. Release
Bump `CACHE` in `sw.js` (`bio-vN` → `bio-vN+1`). Don't push to `main` without the user's OK (it deploys immediately).

## Reporting back (in Arabic)
Report counts per tier per category, anything rejected or skipped and why (especially songs without reliable timing), and which sources you used.
