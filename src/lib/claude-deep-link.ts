/**
 * The link that hands a report to the developer's own Claude Code.
 *
 * `claude-cli://` is a URL scheme Claude Code registers with the operating
 * system, so following one opens a new terminal session in a directory the
 * link names, with a prompt already typed into its input box. The tool never
 * runs Claude itself and nothing is sent until the developer presses Enter —
 * see ADR-0004.
 */

/** The only path Claude Code's handler accepts. */
const HANDLER = 'claude-cli://open'

/**
 * How much prompt a link carries. Past this Claude Code truncates, and a
 * truncated report is one whose last few notes went missing without saying so
 * — which is why the caller drops the whole text block rather than let it be
 * cut short. The notes survive that: every one of them is drawn on a note card
 * beside its pin on the report image itself.
 */
export const PROMPT_LIMIT = 5000

/**
 * Where the session opens, and what is waiting in it.
 *
 * The directory is what makes the report actionable — the prompt describes a
 * UI, and the code that produces it is in a particular checkout. A session
 * opened anywhere else would be handed a picture of a project it cannot see.
 */
export function claudeCodeLink({
  prompt,
  directory,
}: {
  prompt: string
  /** Absolute path to the project the capture was taken of. */
  directory: string
}): string {
  // Assembled by hand rather than with `URLSearchParams`, which writes a space
  // as `+`. Claude Code's handler reads percent-escapes, so every space in the
  // prompt would arrive as a literal plus sign.
  return [
    HANDLER,
    '?cwd=',
    encodeURIComponent(directory),
    '&q=',
    encodeURIComponent(prompt),
  ].join('')
}
