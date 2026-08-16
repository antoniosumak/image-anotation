import { describe, expect, it } from 'vitest'

import { claudeCodeLink } from '#/lib/claude-deep-link'

/** What the link carries, read back the way the operating system reads it. */
function parametersOf(link: string): URLSearchParams {
  return new URLSearchParams(link.slice(link.indexOf('?') + 1))
}

describe('claudeCodeLink', () => {
  it('opens Claude Code in the project the capture was taken of', () => {
    const link = claudeCodeLink({
      prompt: 'Fix it',
      directory: '/Users/dev/projects/storefront',
    })

    expect(link.startsWith('claude-cli://open?')).toBe(true)
    expect(parametersOf(link).get('cwd')).toBe('/Users/dev/projects/storefront')
    expect(parametersOf(link).get('q')).toBe('Fix it')
  })

  it('percent-escapes spaces rather than writing them as plus signs', () => {
    // The whole reason the query string is assembled by hand: Claude Code's
    // handler reads percent-escapes, so a `+` would reach the prompt box as a
    // literal plus sign between every pair of words.
    const link = claudeCodeLink({ prompt: 'the heading is too big', directory: '/tmp' })

    expect(link).toContain('q=the%20heading%20is%20too%20big')
    expect(link).not.toContain('+')
  })

  it('carries a multi-line prompt, notes and all', () => {
    const prompt = '1. Too much padding\n2. Wrong colour'
    const link = claudeCodeLink({ prompt, directory: '/tmp' })

    expect(link).toContain('%0A')
    expect(parametersOf(link).get('q')).toBe(prompt)
  })

  it('escapes a path with a space in it', () => {
    const link = claudeCodeLink({ prompt: 'x', directory: '/Users/dev/My Projects/app' })

    expect(parametersOf(link).get('cwd')).toBe('/Users/dev/My Projects/app')
  })

  it('escapes the ampersands and equals signs a note can contain', () => {
    // A note is prose the developer typed, so it can hold anything a query
    // string uses as punctuation — unescaped, it would read as another
    // parameter and the rest of the report would be dropped.
    const prompt = 'the "Terms & Conditions" link is styled as width=full'
    const link = claudeCodeLink({ prompt, directory: '/tmp' })

    expect(parametersOf(link).get('q')).toBe(prompt)
  })
})
