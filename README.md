# UI Divergence Feedback

A local, single-developer tool for pointing a coding agent at exactly where its
UI implementation drifted from the intended design. See `CONTEXT.md` for the
vocabulary and `docs/adr/` for the decisions behind it.

Nothing is built yet beyond the scaffold — the page it serves exists only to
prove the stack is wired.

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

Tests are Vitest. Right now there is exactly one, asserting that `cn` resolves
conflicting Tailwind classes — it exists to prove the harness runs, and it will
be replaced rather than built on.

The intended shape, once there is logic to test: cover only the editor core —
the one seam that carries value — and leave drag ergonomics, canvas
rasterization, clipboard writes and the server function's filesystem write
untested, as thin adapters that are cheap to verify by using the app and
expensive to test meaningfully.

## The stack

- **[TanStack Start](https://tanstack.com/start)**, pinned to an explicit
  version rather than tracking `latest`. Vite-based, so the dev loop stays fast
  while iterating on canvas interaction, and it provides the server functions
  this app needs to write a report to a local path.
- **[shadcn/ui](https://ui.shadcn.com/) on the [Base UI](https://base-ui.com/)
  foundation**, configured in `components.json`. Add components with:

  ```bash
  npx shadcn@latest add <component>
  ```

  They land in `src/components/ui/`. `src/components/ui/button.tsx` is vendored
  by hand rather than pulled from the registry — the sandbox this was scaffolded
  in cannot reach `ui.shadcn.com`.
- **[Tailwind CSS](https://tailwindcss.com/)** v4, via `@tailwindcss/vite`.
  Theme tokens live in `src/styles.css`.
- **[Vitest](https://vitest.dev/)**, the Vite-native choice.

Routing is file-based: a file in `src/routes/` becomes a route, and
`src/routeTree.gen.ts` is generated — don't edit it by hand. `#/*` imports
resolve to `src/*`.
