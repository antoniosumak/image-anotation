import { describe, expect, it } from 'vitest'

import { createEditor } from '#/editor/createEditor'
import type { Capture } from '#/editor/types'

const capture: Capture = {
  src: 'blob:capture',
  width: 800,
  height: 600,
}

describe('drawing a region', () => {
  it('commits the dragged rectangle as a region', () => {
    const editor = createEditor(capture)

    editor.beginRegion({ x: 100, y: 50 })
    editor.updateRegion({ x: 260, y: 170 })
    editor.commitRegion()

    expect(editor.regions()).toEqual([
      expect.objectContaining({
        bounds: { x: 100, y: 50, width: 160, height: 120 },
      }),
    ])
  })

  it('exposes the region being dragged before it is committed', () => {
    const editor = createEditor(capture)

    editor.beginRegion({ x: 100, y: 50 })
    editor.updateRegion({ x: 260, y: 170 })

    expect(editor.draftRegion()?.bounds).toEqual({
      x: 100,
      y: 50,
      width: 160,
      height: 120,
    })
    expect(editor.regions()).toEqual([])
  })

  it('drops the draft once the drag is committed', () => {
    const editor = createEditor(capture)

    editor.beginRegion({ x: 100, y: 50 })
    editor.updateRegion({ x: 260, y: 170 })
    editor.commitRegion()

    expect(editor.draftRegion()).toBeNull()
  })

  it('discards a drag that never left its starting point', () => {
    const editor = createEditor(capture)

    editor.beginRegion({ x: 100, y: 50 })
    editor.commitRegion()

    expect(editor.regions()).toEqual([])
    expect(editor.draftRegion()).toBeNull()
  })

  it('normalizes a drag made up and to the left', () => {
    const editor = createEditor(capture)

    editor.beginRegion({ x: 260, y: 170 })
    editor.updateRegion({ x: 100, y: 50 })
    editor.commitRegion()

    expect(editor.regions()[0]?.bounds).toEqual({
      x: 100,
      y: 50,
      width: 160,
      height: 120,
    })
  })

  it('keeps a region dragged past the edge inside the capture', () => {
    const editor = createEditor(capture)

    editor.beginRegion({ x: 700, y: 500 })
    editor.updateRegion({ x: 1200, y: 900 })
    editor.commitRegion()

    expect(editor.regions()[0]?.bounds).toEqual({
      x: 700,
      y: 500,
      width: 100,
      height: 100,
    })
  })

  it('replaces the previous region — v1 reports one region per capture', () => {
    const editor = createEditor(capture)

    editor.beginRegion({ x: 10, y: 10 })
    editor.updateRegion({ x: 20, y: 20 })
    editor.commitRegion()

    editor.beginRegion({ x: 300, y: 200 })
    editor.updateRegion({ x: 400, y: 260 })
    editor.commitRegion()

    expect(editor.regions()).toHaveLength(1)
    expect(editor.regions()[0]?.bounds).toEqual({
      x: 300,
      y: 200,
      width: 100,
      height: 60,
    })
  })

  it('discards the drag when the gesture is cancelled', () => {
    const editor = createEditor(capture)

    editor.beginRegion({ x: 100, y: 50 })
    editor.updateRegion({ x: 260, y: 170 })
    editor.cancelRegion()

    expect(editor.draftRegion()).toBeNull()
    expect(editor.regions()).toEqual([])
  })

  it('leaves an already-committed region alone when a later drag is cancelled', () => {
    const editor = createEditor(capture)

    editor.beginRegion({ x: 100, y: 50 })
    editor.updateRegion({ x: 260, y: 170 })
    editor.commitRegion()

    editor.beginRegion({ x: 10, y: 10 })
    editor.updateRegion({ x: 40, y: 40 })
    editor.cancelRegion()

    expect(editor.regions()[0]?.bounds).toEqual({
      x: 100,
      y: 50,
      width: 160,
      height: 120,
    })
  })

  it('gives each committed region its own id', () => {
    const editor = createEditor(capture)

    editor.beginRegion({ x: 10, y: 10 })
    editor.updateRegion({ x: 40, y: 40 })
    editor.commitRegion()
    const first = editor.regions()[0]?.id

    editor.beginRegion({ x: 100, y: 100 })
    editor.updateRegion({ x: 140, y: 140 })
    editor.commitRegion()

    expect(editor.regions()[0]?.id).not.toBe(first)
  })

  it('records who drew the region', () => {
    const editor = createEditor(capture)

    editor.beginRegion({ x: 100, y: 50 })
    editor.updateRegion({ x: 260, y: 170 })
    editor.commitRegion()

    expect(editor.regions()[0]?.source).toBe('human')
    expect(editor.regions()[0]?.confidence).toBeUndefined()
  })
})

describe('building a report', () => {
  it('plans the capture at its natural size', () => {
    const editor = createEditor(capture)

    const { plan } = editor.buildReport()

    expect(plan.width).toBe(800)
    expect(plan.height).toBe(600)
    expect(plan.capture).toEqual({ src: 'blob:capture' })
  })

  it('plans a committed region at the bounds it was drawn at', () => {
    const editor = createEditor(capture)

    editor.beginRegion({ x: 100, y: 50 })
    editor.updateRegion({ x: 260, y: 170 })
    editor.commitRegion()

    const { plan } = editor.buildReport()

    expect(plan.regions).toEqual([
      { bounds: { x: 100, y: 50, width: 160, height: 120 } },
    ])
  })

  it('leaves a region still being dragged out of the plan', () => {
    const editor = createEditor(capture)

    editor.beginRegion({ x: 100, y: 50 })
    editor.updateRegion({ x: 260, y: 170 })

    expect(editor.buildReport().plan.regions).toEqual([])
  })
})
