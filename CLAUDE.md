# Hardwood GM

Dustin's personal basketball GM game: run a franchise from any NBA season 1990–2026 with real players, rated from their real stats. Plain HTML/CSS/JS, no build step, no framework. Built over many sessions in Claude chat and published there as a private artifact (playable on his phone); this folder is the full source, moved here to keep developing in Claude Code.

## Hard rules

- **All code here is original.** Never copy Basketball GM (zengm) code, text, UI wording or assets into this project, even though the player data was originally sourced from its public real-player files. Reimplementing a feature idea with our own code is fine.
- Personal use only. Don't add analytics, accounts, or anything that sends data anywhere. The one exception, Dustin's call: game recaps send one box score to Claude through the site's own `/api/recap` function, and only when he taps "Write a game recap".
- **Old saves must keep working.** Saves live in the browser (localStorage + IndexedDB). Any change to the save shape needs a step in `migrate()` in app.js, and a test that loads a save from an older version (see Testing).
- Dustin mostly plays on his phone. Keep layouts working at 390px wide, tap targets big, and UI text in plain language (say what a setting does, not jargon).

## Files

- `index.html` – page shell and all CSS.
- `app.js` – everything else (~240 KB, one file, sections marked with `/* ---------- name ---------- */`): league setup, ratings, the possession-by-possession game engine (`makeGame`), coach mode, team strategy and player styles, schedule/playoffs, draft and lottery, free agency (30 days), re-signing, trades, finances, player development, awards, history, settings, UI views (`vHome`, `vRoster`, `vLeague`, `vMoves`, `vMore`, pop-up sheets in `vSheet`), click handlers, `migrate()`, and `window.HG` (test hooks).
- `data.json` – per-season rosters and ratings for 1990–2026 plus draft classes. Rebuilt by `tools/build_data.py` (source files are not in this folder; see the top of that script). Don't hand-edit.
- `hist.json` – real career stats for player pages.
- `NOTES.md` – the build log, stage by stage, with the exact formulas, constants and measurements. **Read the relevant part before changing the engine, ratings, development, free agency or finances**; append a new stage entry when you finish a change.
- `old/v20`, `old/v21` – two earlier published versions, used by the save-compatibility tests.
- `tests/` – headless-browser tests (Puppeteer). `tests/stale/` holds three tests that no longer match the game; ignore them.

## Running

```
npm install          # once; installs Puppeteer (it downloads its own Chrome)
npm start            # serves the game at http://localhost:3400
```

Open http://localhost:3400 in a browser. To check the phone layout, use the browser's device mode at 390×844.

## Testing

Start the server first (`npm start` in another terminal). Tests assume port 3400 and print `ERRORS []` when the page had no errors.

- One test: `node tests/t28.mjs` (strategy screen, roster style line, player page, box score plans, coached game).
- Season realism: `node tests/test.mjs 2016 2` (season, number of seasons). Compare league stats and leaders with real NBA numbers for that era; NOTES.md has the last measured values.
- Coaching balance: `node tests/mc.mjs 2024 1500` (effect of each tactic, in points per game).
- Old saves: `npm run serve:old` (serves old/v20 on 3420 and old/v21 on 3421), then `node tests/t26.mjs` and `node tests/t27.mjs`.
- Full regression: `npm run test:all` (takes several minutes).
- Set `CHROME=/path/to/chrome` to use an installed Chrome instead of Puppeteer's.

Before calling a change done: run the tests that touch it, run a multi-season `test.mjs` if the engine, ratings or development changed, and check the screens you changed at phone size.

## Publishing

The game is hosted on Netlify at https://hardwoodgm-ug2o.netlify.app, linked to this repo: every push to `main` deploys
it (`netlify.toml`: the folder as is, no build step). The site is private to Dustin's Netlify team, so it asks for a
Netlify login. Saves stay in the browser per site, so leagues from the older Claude-artifact version (slug
`9e5b01fe-9189-4488-8d97-3f7ce24ec211`) move over with Export and Import a league file.

## Game recaps (Claude)

`netlify/functions/recap.mjs`, served at `/api/recap`, asks Claude (`claude-haiku-5-5`) for a short game story from
one box score. The key is `ANTHROPIC_API_KEY` in Netlify's environment, never in the repo. The function takes box-score
facts only (no free text), checks the origin, and rate-limits. In the game, `recapFetch`/`recapHtml` in app.js; recaps
live in memory for the visit, not in the save. Test: `node tests/t29.mjs` (stubs the function, so no key needed).

## Where things stand

Recent work (newest first): team strategy and player tendencies (Stage 16), development moved to after the offseason with bigger swings (15), sortable lists and a clearer draft (14), development report, contract details, free agency over 30 days, coach mode, box scores and game logs, league settings. Not built yet: a team stats page (pace, efficiency, how often each team uses each game plan).
