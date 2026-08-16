import { describe, expect, it } from 'vitest'

import { fitScale, scaledSize, zoomedBy } from '#/lib/capture-fit'

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

describe('zoomedBy', () => {
  it('zooms in on a wheel turned up, out on one turned down', () => {
    expect(zoomedBy(1, -100)).toBeGreaterThan(1)
    expect(zoomedBy(1, 100)).toBeLessThan(1)
  })

  it('moves by the same proportion wherever the wheel is turned', () => {
    expect(zoomedBy(2, -100) / 2).toBeCloseTo(zoomedBy(0.5, -100) / 0.5)
  })

  it('comes back to where it started when the wheel is turned back', () => {
    expect(zoomedBy(zoomedBy(1, -100), 100)).toBeCloseTo(1)
  })

  it('stops at the ends rather than running off them', () => {
    expect(zoomedBy(8, -100000)).toBe(8)
    expect(zoomedBy(0.1, 100000)).toBe(0.1)
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
