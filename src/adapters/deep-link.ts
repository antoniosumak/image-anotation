/**
 * Follows a link the operating system is meant to handle rather than the
 * browser.
 *
 * Assigning `location.href` rather than opening a window: a scheme nothing is
 * registered for leaves the page exactly where it was, so a developer whose
 * Claude Code has never registered its handler is left looking at the app —
 * and at the path the report was written to — rather than at a blank tab.
 */
export function followDeepLink(url: string): void {
  window.location.href = url
}
