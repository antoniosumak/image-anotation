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

If you run the app from somewhere other than the project you're marking up, set
`UI_DIVERGENCE_PROJECT_DIR` to the project's absolute path. Reports are written
inside it, and it's where the session opens.

## Running it

```bash
npm install
npm run dev
```

The app serves on <http://localhost:3000>. It runs entirely on your machine;
nothing is uploaded and there is no login.

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
  Claude Code. `filesystem.ts` is the one server function — a browser page
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
