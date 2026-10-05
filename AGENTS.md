# AGENTS.md

Pac-Man clone, vanilla JS + canvas. No `package.json`, no build step, no bundler, no tests, no linter.
**Verification is manual: open `src/index.html` in a browser (`file://` works) and play.**
Do not introduce a toolchain, module bundler, or test framework unless the user asks.

## Workflow: spec-driven development

This repo exists to practice spec-driven development. Two skills are vendored in `.agents/skills/`
(from `pedleo93/itses-skill`, pinned by `skills-lock.json`):

- `/spec` — writes `specs/NN-slug.md` (kebab slug, sequential, zero-padded). Never writes code.
- `/spec-impl` — implements one spec, requires a state meaning "Approved", pauses for diff review
  after every step, never commits on its own.

`specs/` does not exist yet. `/spec` creates `specs/` implicitly and seeds `specs/.spec-config.yml`
(`AutoCreateBranch`) on first run — never overwrite that config if it already exists.

Read the vendored `SKILL.md` files before running either skill; they carry hard rules the agent must
not improvise on (no code in `/spec`, no auto-commit in `/spec-impl`, reply in the user's prompt
language, etc.).

Docs and code comments in this repo are in **Spanish**; match that. `/spec` writes the spec in the
language of the existing `specs/` files — keep the set consistent (English `Draft`/`Approved` or
Spanish `Borrador`/`Aprobado`, not mixed).

## Architecture: four classic scripts wired by `window` globals

`src/index.html` loads plain `<script>` tags in dependency order — there is no `type="module"` and no
import/export. The order **is** the wiring; changing it breaks the page.

1. `src/js/maze.js` — maze data only. Exports `window.MAZE`, `TUNNEL_ROW`, `PACMAN_START`, `GHOST_STARTS`.
2. `src/js/game.js` — rules/state. Depends on maze globals. Exports `window.createGame`, `update`, `DIRS`.
3. `src/js/render.js` — pure drawing. Exports `window.draw`. Reads `DIRS` from game.js.
4. `src/js/main.js` — rAF loop, keyboard, overlay screens. Calls `createGame`/`update`/`draw`.

**When adding a cross-file symbol, attach it to `window` and add the script tag in the right position.**

## Maze geometry — four places must stay in sync

The level is authored as 31 readable strings of 28 chars in `maze.js`, then parsed to numbers.
`#` wall=1 · `.` dot=2 · ` ` walkable empty=0 · `-` pen door=3 · `o` power pellet=4.

If you change the grid, update **all** of these or rendering desynchronizes:

- `MAZE_STR` row count/length (`maze.js`)
- `TILE = 20` in `render.js`
- `width="560" height="620"` on `<canvas id="game">` (`index.html`)
- `#game-wrap { width: 560px; height: 620px }` (`style.css`)

Tile value `3` (pen door) is a wall for Pac-Man but passable for ghosts — that asymmetry lives in
`isWall(grid, x, y, actor)`. Tile numbers are duplicated as literals across maze/game/render; there is
no constants module.

## Movement invariants

- Positions are **floating point sub-cell** coordinates; turning, dot-eating and ghost decisions only
  run when the actor is within `1e-3` of a cell center (`aligned()` in `game.js`).
- Speeds (`PACMAN_SPEED`, `GHOST_SPEED`, `FRIGHTENED_SPEED`) must be **exactly `1/n` cells per logical step** — `1/12`,
  `1/16`, `1/32`, … Never an arbitrary decimal. The actor must land on *every* cell center, because that
  is the only place turning and dot-eating happen. `0.13` (=13/100) does realign, but only every 100
  steps after 13 cells: it would eat 1 dot in 13 and turn 13 cells late. Change the denominator only.
- When changing a ghost's speed on the fly (e.g., entering/leaving frightened state), its position must be explicitly rounded to the nearest cell. A floating point position with a new speed will never hit a cell center again, trapping the actor between cells.
- The logical step is decoupled from the display refresh: `main.js` runs `update()` at a fixed
  `STEP_MS = 1000 / 60` via an accumulator, while `draw()` runs on every `requestAnimationFrame`.
  Changing `PACMAN_SPEED`/`GHOST_SPEED` changes gameplay speed; changing `STEP_MS` changes how often
  the game advances. They are not the same knob.
- Tunnel wrap (`wrapTunnel`) only applies on `TUNNEL_ROW = 14`; the row string has open ends.
- Reversing 180° is disallowed for ghosts except in dead ends (`decideGhost` fallback).
- `game.state` is one of `start | playing | won | lost`; `main.js` switches the overlay on `won`/`lost`.

## Pristine vs mutable maze

`MAZE` is the never-mutated source of truth. `createGame()` deep-copies rows into `game.grid`, which is
what eating modifies. Anything that reads "is there a dot here" must use `game.grid`, and
`render.js` must draw from `game.grid` (not `MAZE`) or eaten dots keep reappearing.

## Style

Match existing files exactly — they are Prettier-formatted with spaces inside brackets/parens:
`grid[ y ][ x ]`, `isWall( grid, x, y, 'pacman' )`, `{ x: -1, y: 0 }`, single quotes, semicolons.

Comments are **Spanish, no accents, sentence-per-file header** (`// game.js` + a line describing the
file's role). Follow that for new files and for inline notes.

## Junk to ignore

`__MACOSX/` is macOS zip resource-fork garbage. Never edit or reference files inside it.