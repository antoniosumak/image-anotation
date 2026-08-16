import { describe, expect, it } from 'vitest'

import { fitScale, scaledSize } from '#/lib/capture-fit'

describe('fitScale', () => {
  it('leaves a capture that already fits at its natural pixels', () => {
    expect(fitScale({ width: 800, height: 600 }, { width: 1200, height: 900 })).toBe(1)
  })

  it('shrinks a capture too wide for the stage', () => {
    expect(fitScale({ width: 2000, height: 500 }, { width: 1000, height: 1000 })).toBe(0.5)
  })

  it('shrinks a capture too tall for the stage', () => {
    expect(fitScale({ width: 500, height: 2000 }, { width: 1000, height: 1000 })).toBe(0.5)
  })

  it('takes the tighter of the two, so the whole capture is on screen', () => {
    expect(fitScale({ width: 2000, height: 4000 }, { width: 1000, height: 1000 })).toBe(0.25)
  })

  it('draws at natural size until the stage has been measured', () => {
    expect(fitScale({ width: 4000, height: 4000 }, null)).toBe(1)
  })

  it('draws at natural size when the stage reports no room at all', () => {
    expect(fitScale({ width: 4000, height: 4000 }, { width: 0, height: 0 })).toBe(1)
  })
})

describe('scaledSize', () => {
  it('reports whole pixels, so the frame lands on the device grid', () => {
    expect(scaledSize({ width: 1001, height: 999 }, 0.5)).toEqual({
      width: 501,
      height: 500,
    })
  })
})
