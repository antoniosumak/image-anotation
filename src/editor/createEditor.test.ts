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

  it('keeps every region drawn on the capture, in the order they were drawn', () => {
    const editor = createEditor(capture)

    editor.beginRegion({ x: 10, y: 10 })
    editor.updateRegion({ x: 20, y: 20 })
    editor.commitRegion()

    editor.beginRegion({ x: 300, y: 200 })
    editor.updateRegion({ x: 400, y: 260 })
    editor.commitRegion()

    expect(editor.regions().map((region) => region.bounds)).toEqual([
      { x: 10, y: 10, width: 10, height: 10 },
      { x: 300, y: 200, width: 100, height: 60 },
    ])
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

    editor.beginRegion({ x: 100, y: 100 })
    editor.updateRegion({ x: 140, y: 140 })
    editor.commitRegion()

    const [first, second] = editor.regions()
    expect(first?.id).not.toBe(second?.id)
  })

  it('numbers each region by the order it was drawn', () => {
    const editor = createEditor(capture)

    for (const start of [10, 100, 200]) {
      editor.beginRegion({ x: start, y: start })
      editor.updateRegion({ x: start + 40, y: start + 40 })
      editor.commitRegion()
    }

    expect(editor.regions().map((region) => region.number)).toEqual([1, 2, 3])
  })

  it('numbers the region being dragged as the one it is about to become', () => {
    const editor = createEditor(capture)

    editor.beginRegion({ x: 10, y: 10 })
    editor.updateRegion({ x: 40, y: 40 })
    editor.commitRegion()

    editor.beginRegion({ x: 100, y: 100 })

    expect(editor.draftRegion()?.number).toBe(2)
  })

  it('does not spend a number on a drag that never became a region', () => {
    const editor = createEditor(capture)

    editor.beginRegion({ x: 10, y: 10 })
    editor.commitRegion()

    editor.beginRegion({ x: 100, y: 100 })
    editor.updateRegion({ x: 140, y: 140 })
    editor.commitRegion()

    expect(editor.regions().map((region) => region.number)).toEqual([1])
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

describe('noting what is wrong', () => {
  function editorWithTwoRegions() {
    const editor = createEditor(capture)
    for (const start of [10, 100]) {
      editor.beginRegion({ x: start, y: start })
      editor.updateRegion({ x: start + 40, y: start + 40 })
      editor.commitRegion()
    }
    return editor
  }

  it('starts a region with no note — the region says where, not what', () => {
    const editor = editorWithTwoRegions()

    expect(editor.regions().map((region) => region.note)).toEqual(['', ''])
  })

  it('writes a note against the region it names', () => {
    const editor = editorWithTwoRegions()
    const [first, second] = editor.regions()

    editor.annotate(second!.id, 'Submit button sits 8px too low')

    expect(editor.regions()).toEqual([
      expect.objectContaining({ id: first!.id, note: '' }),
      expect.objectContaining({
        id: second!.id,
        note: 'Submit button sits 8px too low',
      }),
    ])
  })

  it('replaces a note without touching the region it belongs to', () => {
    const editor = editorWithTwoRegions()
    const [first] = editor.regions()

    editor.annotate(first!.id, 'Padding is wrong')
    editor.annotate(first!.id, 'Padding is wrong on the right — 24px, not 16px')

    expect(editor.regions()[0]).toEqual(
      expect.objectContaining({
        note: 'Padding is wrong on the right — 24px, not 16px',
        bounds: { x: 10, y: 10, width: 40, height: 40 },
      }),
    )
  })

  it('ignores a note against a region that is not there', () => {
    const editor = editorWithTwoRegions()
    const before = editor.regions()

    editor.annotate('region-99', 'Nothing to attach this to')

    expect(editor.regions()).toEqual(before)
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
      { bounds: { x: 100, y: 50, width: 160, height: 120 }, number: 1, note: '' },
    ])
  })

  it('plans every region carrying the number and note it was given', () => {
    const editor = createEditor(capture)

    editor.beginRegion({ x: 10, y: 10 })
    editor.updateRegion({ x: 50, y: 50 })
    editor.commitRegion()
    editor.beginRegion({ x: 300, y: 200 })
    editor.updateRegion({ x: 400, y: 260 })
    editor.commitRegion()

    const [first, second] = editor.regions()
    editor.annotate(first!.id, 'Card padding is wrong on the right')
    editor.annotate(second!.id, 'Submit button sits 8px too low')

    expect(editor.buildReport().plan.regions).toEqual([
      {
        bounds: { x: 10, y: 10, width: 40, height: 40 },
        number: 1,
        note: 'Card padding is wrong on the right',
      },
      {
        bounds: { x: 300, y: 200, width: 100, height: 60 },
        number: 2,
        note: 'Submit button sits 8px too low',
      },
    ])
  })

  it('leaves a region still being dragged out of the plan', () => {
    const editor = createEditor(capture)

    editor.beginRegion({ x: 100, y: 50 })
    editor.updateRegion({ x: 260, y: 170 })

    expect(editor.buildReport().plan.regions).toEqual([])
  })

  it('lists every region by number with its note', () => {
    const editor = createEditor(capture)

    editor.beginRegion({ x: 10, y: 10 })
    editor.updateRegion({ x: 50, y: 50 })
    editor.commitRegion()
    editor.beginRegion({ x: 300, y: 200 })
    editor.updateRegion({ x: 400, y: 260 })
    editor.commitRegion()

    const [first, second] = editor.regions()
    editor.annotate(first!.id, 'Card padding is wrong on the right')
    editor.annotate(second!.id, 'Submit button sits 8px too low')

    expect(editor.buildReport().text).toBe(
      '1. Card padding is wrong on the right\n2. Submit button sits 8px too low',
    )
  })

  it('still lists a region nothing was written against', () => {
    const editor = createEditor(capture)

    editor.beginRegion({ x: 10, y: 10 })
    editor.updateRegion({ x: 50, y: 50 })
    editor.commitRegion()

    expect(editor.buildReport().text).toBe('1. (no note)')
  })

  it('has nothing to say when no region was drawn', () => {
    const editor = createEditor(capture)

    expect(editor.buildReport().text).toBe('')
  })

  it('builds the same report every time from the same regions and notes', () => {
    const editor = createEditor(capture)

    editor.beginRegion({ x: 10, y: 10 })
    editor.updateRegion({ x: 50, y: 50 })
    editor.commitRegion()
    editor.annotate(editor.regions()[0]!.id, 'Card padding is wrong')

    expect(editor.buildReport()).toEqual(editor.buildReport())
  })
})
