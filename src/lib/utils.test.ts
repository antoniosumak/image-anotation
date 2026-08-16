import { describe, expect, it } from 'vitest'

import { cn } from '#/lib/utils'

describe('cn', () => {
  it('lets a later Tailwind class win over an earlier one it conflicts with', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })
})
