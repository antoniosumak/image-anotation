#!/usr/bin/env node
/**
 * Serves the built app from wherever it was started.
 *
 * The directory matters more than it looks: the server function that writes a
 * report resolves the project from `process.cwd()`, so running this inside the
 * project being marked up is what makes reports land in its `reports/` and the
 * session open against its code. That is the whole reason this ships as a
 * command rather than a hosted page — see `docs/adr/0004`.
 */
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { serve } from 'srvx'
import { serveStatic } from 'srvx/static'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Where the app serves unless told otherwise.
 *
 * Deliberately not a random port and deliberately nowhere near 3000, 5173 or
 * 8080: the developer running this has their own app on one of those, and a
 * port that moves every run is a tab that can't be reloaded and a link that
 * goes stale. This one is fixed, memorable, below the ephemeral range the OS
 * hands out for outbound connections, and not registered to anything.
 */
const DEFAULT_PORT = 24680

/**
 * How far to walk up from the wanted port before giving up. Covers a second
 * copy of this tool already running; past a handful, something is wrong that
 * picking another number won't fix.
 */
const PORT_ATTEMPTS = 20

const requested = portArgument() ?? DEFAULT_PORT
const port = await firstFreePort(requested)

if (port === null) {
  console.error(
    `No free port between ${requested} and ${requested + PORT_ATTEMPTS - 1}.`,
  )
  process.exit(1)
}

const app = await import(
  pathToFileURL(resolve(packageRoot, 'dist/server/server.js')).href
)

serve({
  port,
  hostname: '127.0.0.1',
  silent: true,
  // The built client's assets are files on disk; everything else is the app.
  middleware: [serveStatic({ dir: resolve(packageRoot, 'dist/client') })],
  fetch: (request) => app.default.fetch(request),
})

const url = `http://localhost:${port}`
console.log(`UI Divergence Feedback  ${url}`)
console.log(`Reports are written to  ${resolve(process.cwd(), 'reports')}`)
if (port !== requested) console.log(`(${requested} was taken)`)
openBrowser(url)

/** The port asked for on the command line, if one was. */
function portArgument() {
  const index = process.argv.indexOf('--port')
  if (index === -1) return null
  const value = Number(process.argv[index + 1])
  return Number.isInteger(value) && value > 0 && value < 65536 ? value : null
}

/**
 * The first port from `wanted` upwards that nothing is listening on.
 *
 * Asked before serving rather than by catching the failure, so the message
 * about which port was taken is written once, by the code that chose the
 * next one.
 */
async function firstFreePort(wanted) {
  for (let port = wanted; port < wanted + PORT_ATTEMPTS; port++) {
    if (await isFree(port)) return port
  }
  return null
}

function isFree(port) {
  return new Promise((settle) => {
    const probe = createServer()
    probe.once('error', () => settle(false))
    probe.listen(port, '127.0.0.1', () => probe.close(() => settle(true)))
  })
}

/**
 * Opens the app in whatever the machine treats as its browser. Best-effort: a
 * machine with no opener still has the URL printed above, so nothing here is
 * worth failing the command over.
 */
function openBrowser(url) {
  const [command, args] =
    process.platform === 'win32'
      ? ['cmd', ['/c', 'start', '', url]]
      : process.platform === 'darwin'
        ? ['open', [url]]
        : ['xdg-open', [url]]
  try {
    spawn(command, args, { stdio: 'ignore', detached: true }).unref()
  } catch {
    // The URL is printed; that is enough.
  }
}
