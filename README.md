# UI Divergence Feedback

A local, single-developer tool for pointing a coding agent at exactly where its
UI implementation drifted from the intended design. See `CONTEXT.md` for the
vocabulary and `docs/adr/` for the decisions behind it.

The path that works today: paste or drop an implementation capture, drag a
rectangle over each thing that is wrong, write a note against each, and click
**Send to Claude Code**. Attach a design reference beside it — optional, and
paste or drop it the same way — and the report carries both sides.

## Sending

Send to Claude Code writes the annotated report into `reports/` and follows a
`claude-cli://` deep link, which opens a new Claude Code session in the project
with the prompt already typed into it. Nothing is sent until you read it and
press Enter: the session is yours, in your terminal, under your own permission
rules. This tool never runs a coding agent — see `docs/adr/0004`.

Two things have to be true for the link to land:

- **Claude Code has registered its URL handler on that machine.** It does this
  the first time you send a prompt in an interactive session. If the button
  appears to do nothing, that's why — start `claude`, send anything, and try
  again.
- **The browser and the app are on the same computer.** The image is written by
  the server; the session opens where you clicked. Locally that's one machine,
  which is the only way this tool is meant to be run.

The other two buttons are what to reach for when neither is true. **Copy Image**
puts the annotated PNG on your clipboard. **Write Image, Copy Text** writes the
same image and copies a text block naming its path, so one paste carries the
picture and the notes as words.

## Picking a report back up

Every report the app produces carries the **session** that made it — the
original capture, the design reference, and every region and note — written
into the PNG as a `tEXt` chunk. Drop a report from `reports/` back on the page
and it opens where you left it: the clean capture with its regions still on it,
ready to be moved, renoted, added to and handed over again. Nothing is stored
outside the file, so a report you keep is a report you can still edit.

The chunk is metadata every other tool ignores, so a report is still an
ordinary PNG anywhere else.

**Copy Image** round-trips too. The clipboard sanitizes `image/png` — it
decodes the pixels and encodes them afresh, which drops everything around them
— so the report goes on the clipboard twice: as that image, and as one line of
HTML with the same PNG inline, which is handed over as written. Pasting into
this app takes the copy out of the HTML and reopens the session; pasting
anywhere else gets the image, from the HTML in a rich-text editor and from the
PNG everywhere else.

HTML rather than a web custom format, which is the other way to get bytes
across untouched: custom formats are Chromium's alone, and reading one back
means asking the clipboard for it, which needs permission on every paste.
`text/html` is carried by every browser and arrives on the paste event without
being asked for. Verified round-tripping in Chrome and in Zen.

The project a report belongs to is the directory the app was started in, which
is why it's run as a command from inside that project rather than opened as a
page. If you do start it somewhere else, set `UI_DIVERGENCE_PROJECT_DIR` to the
project's absolute path. Reports are written inside it, and it's where the
session opens.

## Running it

From the project you're marking up:

```bash
npx ui-divergence-feedback
```

It serves on <http://localhost:24680> and opens a browser there. Not port 3000
or 5173 — those belong to the app you're marking up. If 24680 is taken it walks
up until it finds a free one and says so; `--port` overrides.

Everything runs on your machine: nothing is uploaded, there is no login, and
the only thing written anywhere is the report, in this project's `reports/`.

## Working on it

```bash
pnpm install
pnpm dev
```

The dev server is on <http://localhost:3000>, and reports land in this repo
rather than in whatever you're marking up — set `UI_DIVERGENCE_PROJECT_DIR`
when that isn't what you want.

`pnpm build` then `pnpm start` runs the built app exactly as `npx` users get
it, which is the one way to check the packaged server rather than the dev one.

## Releasing

Bump `version` in `package.json` and push to `main`. The publish workflow tests,
typechecks and builds every push, and publishes only when that version isn't on
npm yet — so the version field is the release switch and an ordinary push is
never a release. Publishing needs an `NPM_TOKEN` secret on the repository.

## Testing

```bash
npm test          # single run
npm run test:watch
npm run typecheck
```

Tests are Vitest, and they cover the editor core in `src/editor/` — the one
seam that carries value. They drive it with intents and assert on what it
reports: the committed regions and the contents of the render plan. No canvas
polyfill, no jsdom, no pixel comparison.

Drag ergonomics, canvas rasterization and clipboard writes are deliberately
untested — thin adapters that are cheap to verify by using the app and
expensive to test in a way that would actually catch anything.

## How it fits together

One seam and a ring of thin adapters around it.

- **`src/editor/`** — the editor core. `createEditor(capture)` takes *intents*
  (`beginRegion`, `updateRegion`, `commitRegion`) rather than pointer events and
  never touches the DOM, so a test can drive a whole drag. `buildReport()`
  returns a **declarative render plan** — what to draw, never pixels.
- **`src/adapters/`** — the only code that touches browser APIs. `canvas.ts` is
  the single thing that rasterizes a plan; `transfer.ts` picks the image out of
  a paste or a drop; `clipboard.ts` writes the annotated PNG back; `image.ts`
  decodes an image's natural size; `deep-link.ts` follows the URL that opens
  Claude Code; `session-png.ts` writes the session into a report and reads it
  back out. `filesystem.ts` is the one server function — a browser page
  can't write to a local path, and a path is the whole point.
- **`src/components/capture-editor.tsx`** — translates pointer events into
  intents and draws what the core reports. It holds no region state of its own,
  and owns the object URL behind the design reference the core names. It also
  owns the **stage**: the capture is drawn to fit a fixed area of the screen
  rather than at its own size, so a 3000px export can't lay the app out. See
  `docs/adr/0002` and `src/lib/capture-fit.ts`.

Nothing here resolves a region to code — no CSS selectors, no component names,
no coordinates standing in for them. See `docs/adr/0001`.

## The stack

- **[TanStack Start](https://tanstack.com/start)**, pinned to an explicit
  version rather than tracking `latest`. Vite-based, so the dev loop stays fast
  while iterating on canvas interaction, and it provides the server functions
  this app needs to write a report to a local path.
- **`@plerivo/ui`** on the [Base UI](https://base-ui.com/) foundation, with
  `@plerivo/tokens` and `@plerivo/tailwind-config` behind it. Import a component
  from its own entry point — `import { Button } from '@plerivo/ui/button'`.
  `src/components/ui/alert-dialog.tsx` is the one primitive still kept locally:
  the library ships a `Dialog`, and an alert dialog is deliberately not one —
  it cannot be dismissed by clicking away from it.
- **[Tailwind CSS](https://tailwindcss.com/)** v4, via `@tailwindcss/vite`.
  `src/styles.css` imports the plerivo preset and adds only what is this app's
  own — the stage surface, the drop targets, the scrollbars. Two things about
  that preset are worth knowing before editing styles:

  - it resets `--color-*`, so Tailwind's stock palette (`bg-neutral-500`,
    `border-white`) does not exist. Fixed colours are stated as constants —
    see `src/lib/region-style.ts`.
  - `@source` is required for the library's own classes. Tailwind skips
    `node_modules` when scanning for classes to generate, and without it every
    component renders unstyled with no warning.
- **[Vitest](https://vitest.dev/)**, the Vite-native choice.

Routing is file-based: a file in `src/routes/` becomes a route, and
`src/routeTree.gen.ts` is generated — don't edit it by hand. `#/*` imports
resolve to `src/*`.
