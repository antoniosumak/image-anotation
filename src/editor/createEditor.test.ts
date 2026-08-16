import { describe, expect, it } from 'vitest'

import { createEditor } from '#/editor/createEditor'
import type { Capture, DesignReference } from '#/editor/types'

const capture: Capture = {
  src: 'blob:capture',
  width: 800,
  height: 600,
}

/** Taller and wider than the capture, so the report has to make room for it. */
const designReference: DesignReference = {
  src: 'blob:design',
  width: 900,
  height: 700,
}

/** An editor carrying a 40×40 region drawn at each position given. */
function editorWithRegionsAt(...starts: number[]) {
  const editor = createEditor(capture)
  for (const start of starts) {
    editor.beginRegion({ x: start, y: start })
    editor.updateRegion({ x: start + 40, y: start + 40 })
    editor.commitRegion()
  }
  return editor
}

/** An editor carrying one region, big enough to be moved and resized about. */
function editorWithARegion() {
  const editor = createEditor(capture)
  editor.beginRegion({ x: 100, y: 50 })
  editor.updateRegion({ x: 260, y: 170 })
  editor.commitRegion()
  return editor
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

  it('does not spend a number on a cancelled drag', () => {
    const editor = createEditor(capture)

    editor.beginRegion({ x: 10, y: 10 })
    editor.updateRegion({ x: 50, y: 50 })
    editor.commitRegion()

    editor.beginRegion({ x: 100, y: 100 })
    editor.updateRegion({ x: 140, y: 140 })
    editor.cancelRegion()

    editor.beginRegion({ x: 200, y: 200 })
    editor.updateRegion({ x: 240, y: 240 })
    editor.commitRegion()

    expect(editor.regions().map((region) => region.number)).toEqual([1, 2])
    expect(editor.buildReport().text).toBe('1. (no note)\n2. (no note)')
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
  const editorWithTwoRegions = () => editorWithRegionsAt(10, 100)

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

describe('moving a region', () => {
  it('shifts the region by the distance it was dragged', () => {
    const editor = editorWithARegion()

    editor.moveRegion(editor.regions()[0]!.id, { x: 30, y: -20 })

    expect(editor.regions()[0]?.bounds).toEqual({
      x: 130,
      y: 30,
      width: 160,
      height: 120,
    })
  })

  it('takes the note with the region it belongs to', () => {
    const editor = editorWithARegion()
    const [region] = editor.regions()
    editor.annotate(region!.id, 'Submit button sits 8px too low')

    editor.moveRegion(region!.id, { x: 30, y: 30 })

    expect(editor.buildReport().plan.regions).toEqual([
      {
        bounds: { x: 130, y: 80, width: 160, height: 120 },
        number: 1,
        note: 'Submit button sits 8px too low',
      },
    ])
  })

  it('keeps a region dragged past the edge on the capture, at its full size', () => {
    const editor = editorWithARegion()

    editor.moveRegion(editor.regions()[0]!.id, { x: 900, y: 700 })

    expect(editor.regions()[0]?.bounds).toEqual({
      x: 640,
      y: 480,
      width: 160,
      height: 120,
    })
  })

  it('leaves the other regions where they were drawn', () => {
    const editor = editorWithARegion()
    editor.beginRegion({ x: 10, y: 10 })
    editor.updateRegion({ x: 50, y: 50 })
    editor.commitRegion()

    editor.moveRegion(editor.regions()[0]!.id, { x: 30, y: 30 })

    expect(editor.regions()[1]?.bounds).toEqual({
      x: 10,
      y: 10,
      width: 40,
      height: 40,
    })
    expect(editor.regions().map((region) => region.number)).toEqual([1, 2])
  })

  it('ignores a move naming a region that is not there', () => {
    const editor = editorWithARegion()
    const before = editor.regions()

    editor.moveRegion('region-99', { x: 30, y: 30 })

    expect(editor.regions()).toEqual(before)
  })
})

describe('resizing a region', () => {
  it('tightens the region onto the bounds it was pulled to', () => {
    const editor = editorWithARegion()

    editor.resizeRegion(editor.regions()[0]!.id, {
      x: 120,
      y: 60,
      width: 100,
      height: 80,
    })

    expect(editor.regions()[0]?.bounds).toEqual({
      x: 120,
      y: 60,
      width: 100,
      height: 80,
    })
  })

  it('keeps the note and the number the region was carrying', () => {
    const editor = editorWithARegion()
    const [region] = editor.regions()
    editor.annotate(region!.id, 'Card padding is wrong on the right')

    editor.resizeRegion(region!.id, { x: 120, y: 60, width: 100, height: 80 })

    expect(editor.buildReport().text).toBe(
      '1. Card padding is wrong on the right',
    )
    expect(editor.regions()[0]).toEqual(
      expect.objectContaining({ id: region!.id, number: 1 }),
    )
  })

  it('normalizes an edge pulled past the one opposite it', () => {
    const editor = editorWithARegion()

    editor.resizeRegion(editor.regions()[0]!.id, {
      x: 260,
      y: 170,
      width: -160,
      height: -120,
    })

    expect(editor.regions()[0]?.bounds).toEqual({
      x: 100,
      y: 50,
      width: 160,
      height: 120,
    })
  })

  it('keeps a region pulled past the edge inside the capture', () => {
    const editor = editorWithARegion()

    editor.resizeRegion(editor.regions()[0]!.id, {
      x: 700,
      y: 500,
      width: 300,
      height: 300,
    })

    expect(editor.regions()[0]?.bounds).toEqual({
      x: 700,
      y: 500,
      width: 100,
      height: 100,
    })
  })

  it('refuses a resize that would collapse the region to nothing', () => {
    const editor = editorWithARegion()

    editor.resizeRegion(editor.regions()[0]!.id, {
      x: 120,
      y: 60,
      width: 0,
      height: 80,
    })

    expect(editor.regions()[0]?.bounds).toEqual({
      x: 100,
      y: 50,
      width: 160,
      height: 120,
    })
  })

  it('ignores a resize naming a region that is not there', () => {
    const editor = editorWithARegion()
    const before = editor.regions()

    editor.resizeRegion('region-99', { x: 0, y: 0, width: 10, height: 10 })

    expect(editor.regions()).toEqual(before)
  })
})

describe('deleting a region', () => {
  const editorWithThreeRegions = () => editorWithRegionsAt(10, 100, 200)

  it('drops the region it names, and the note written against it', () => {
    const editor = editorWithThreeRegions()
    const [first, second, third] = editor.regions()
    editor.annotate(second!.id, 'Not a divergence after all')

    editor.removeRegion(second!.id)

    expect(editor.regions().map((region) => region.id)).toEqual([
      first!.id,
      third!.id,
    ])
    expect(
      editor.regions().some((region) => region.note.includes('after all')),
    ).toBe(false)
  })

  it('closes the gap in the numbering the deleted region left', () => {
    const editor = editorWithThreeRegions()

    editor.removeRegion(editor.regions()[0]!.id)

    expect(editor.regions().map((region) => region.number)).toEqual([1, 2])
  })

  it('keeps every note with the region it was written against', () => {
    const editor = editorWithThreeRegions()
    const [first, second, third] = editor.regions()
    editor.annotate(first!.id, 'Card padding is wrong')
    editor.annotate(second!.id, 'Nothing wrong here')
    editor.annotate(third!.id, 'Submit button sits 8px too low')

    editor.removeRegion(second!.id)

    expect(editor.buildReport().text).toBe(
      '1. Card padding is wrong\n2. Submit button sits 8px too low',
    )
  })

  it('numbers the next region drawn after the ones left behind', () => {
    const editor = editorWithThreeRegions()

    editor.removeRegion(editor.regions()[1]!.id)
    editor.beginRegion({ x: 400, y: 400 })
    editor.updateRegion({ x: 440, y: 440 })
    editor.commitRegion()

    expect(editor.regions().map((region) => region.number)).toEqual([1, 2, 3])
  })

  it('still tells the regions apart after one is deleted and another drawn', () => {
    const editor = editorWithThreeRegions()

    editor.removeRegion(editor.regions()[2]!.id)
    editor.beginRegion({ x: 400, y: 400 })
    editor.updateRegion({ x: 440, y: 440 })
    editor.commitRegion()

    const ids = editor.regions().map((region) => region.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('ignores a deletion naming a region that is not there', () => {
    const editor = editorWithThreeRegions()
    const before = editor.regions()

    editor.removeRegion('region-99')

    expect(editor.regions()).toEqual(before)
  })
})

describe('building a report', () => {
  it('plans the capture at its natural size', () => {
    const editor = createEditor(capture)

    const { plan } = editor.buildReport()

    expect(plan.width).toBe(800)
    expect(plan.height).toBe(600)
    expect(plan.capture).toEqual({
      src: 'blob:capture',
      bounds: { x: 0, y: 0, width: 800, height: 600 },
    })
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

  it('keeps a note written over several lines under its own number', () => {
    const editor = createEditor(capture)

    editor.beginRegion({ x: 10, y: 10 })
    editor.updateRegion({ x: 50, y: 50 })
    editor.commitRegion()
    editor.beginRegion({ x: 100, y: 100 })
    editor.updateRegion({ x: 140, y: 140 })
    editor.commitRegion()

    editor.annotate(editor.regions()[0]!.id, 'Padding is wrong\nand so is the gap')
    editor.annotate(editor.regions()[1]!.id, 'Button sits too low')

    // Every line that starts an entry starts with its number — a second line
    // of a note can't be mistaken for the next region.
    expect(editor.buildReport().text).toBe(
      '1. Padding is wrong\n   and so is the gap\n2. Button sits too low',
    )
  })

  it('treats a note of nothing but whitespace as unwritten', () => {
    const editor = createEditor(capture)

    editor.beginRegion({ x: 10, y: 10 })
    editor.updateRegion({ x: 50, y: 50 })
    editor.commitRegion()
    editor.annotate(editor.regions()[0]!.id, '   ')

    const report = editor.buildReport()

    expect(report.text).toBe('1. (no note)')
    expect(report.plan.regions[0]?.note).toBe('')
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

  it('plans no design reference when none is attached', () => {
    const editor = editorWithARegion()

    const { plan } = editor.buildReport()

    expect(plan.designReference).toBeNull()
    expect(plan.width).toBe(800)
    expect(plan.height).toBe(600)
  })

  it('says nothing about sides when no design reference is attached', () => {
    const editor = editorWithARegion()
    editor.annotate(editor.regions()[0]!.id, 'Card padding is wrong')

    expect(editor.buildReport().text).toBe('1. Card padding is wrong')
  })
})

describe('attaching a design reference', () => {
  it('has none until one is attached', () => {
    const editor = createEditor(capture)

    expect(editor.designReference()).toBeNull()
  })

  it('attaches the design reference it is given', () => {
    const editor = createEditor(capture)

    editor.attachDesignReference(designReference)

    expect(editor.designReference()).toEqual(designReference)
  })

  it('replaces one attached in error, keeping every region and note', () => {
    const editor = editorWithARegion()
    editor.annotate(editor.regions()[0]!.id, 'Card padding is wrong')
    editor.attachDesignReference(designReference)

    editor.attachDesignReference({
      src: 'blob:the-right-design',
      width: 400,
      height: 300,
    })

    expect(editor.designReference()?.src).toBe('blob:the-right-design')
    expect(editor.regions()).toEqual([
      expect.objectContaining({
        number: 1,
        note: 'Card padding is wrong',
        bounds: { x: 100, y: 50, width: 160, height: 120 },
      }),
    ])
  })

  it('removes it, leaving the capture with none, and the regions untouched', () => {
    const editor = editorWithARegion()
    editor.annotate(editor.regions()[0]!.id, 'Card padding is wrong')
    editor.attachDesignReference(designReference)

    editor.removeDesignReference()

    expect(editor.designReference()).toBeNull()
    expect(editor.buildReport().text).toBe('1. Card padding is wrong')
  })

  it('lets regions be drawn with one attached, on the capture as before', () => {
    const editor = createEditor(capture)
    editor.attachDesignReference(designReference)

    editor.beginRegion({ x: 100, y: 50 })
    editor.updateRegion({ x: 260, y: 170 })
    editor.commitRegion()

    // The design reference is wider and taller than the capture, and a region
    // still cannot be drawn off the capture and onto it.
    editor.beginRegion({ x: 700, y: 500 })
    editor.updateRegion({ x: 1500, y: 1200 })
    editor.commitRegion()

    expect(editor.regions().map((region) => region.bounds)).toEqual([
      { x: 100, y: 50, width: 160, height: 120 },
      { x: 700, y: 500, width: 100, height: 100 },
    ])
  })
})

describe('building a report with a design reference', () => {
  const editorWithBothSides = () => {
    const editor = editorWithARegion()
    editor.annotate(editor.regions()[0]!.id, 'Card padding is wrong')
    editor.attachDesignReference(designReference)
    return editor
  }

  it('plans the design reference beside the capture, at its natural size', () => {
    const { plan } = editorWithBothSides().buildReport()

    expect(plan.designReference).toEqual({
      src: 'blob:design',
      bounds: { x: 824, y: 0, width: 900, height: 700 },
    })
  })

  it('makes room for both sides, and for the taller of the two', () => {
    const { plan } = editorWithBothSides().buildReport()

    expect(plan.width).toBe(1724)
    expect(plan.height).toBe(700)
  })

  it('leaves the capture at the origin, so regions stay where they were drawn', () => {
    const { plan } = editorWithBothSides().buildReport()

    expect(plan.capture).toEqual({
      src: 'blob:capture',
      bounds: { x: 0, y: 0, width: 800, height: 600 },
    })
    expect(plan.regions).toEqual([
      {
        bounds: { x: 100, y: 50, width: 160, height: 120 },
        number: 1,
        note: 'Card padding is wrong',
      },
    ])
  })

  it('tells the coding agent which side is which', () => {
    const text = editorWithBothSides().buildReport().text

    expect(text).toBe(
      'The implementation capture is on the left, and the design reference it should match is on the right. The numbered regions mark divergences on the implementation capture.\n\n1. Card padding is wrong',
    )
  })

  it('still says which side is which with nothing marked up yet', () => {
    const editor = createEditor(capture)
    editor.attachDesignReference(designReference)

    expect(editor.buildReport().text).toBe(
      'The implementation capture is on the left, and the design reference it should match is on the right. The numbered regions mark divergences on the implementation capture.',
    )
  })

  it('drops it from the report once it is removed', () => {
    const editor = editorWithBothSides()

    editor.removeDesignReference()

    const { plan } = editor.buildReport()
    expect(plan.designReference).toBeNull()
    expect(plan.width).toBe(800)
    expect(plan.height).toBe(600)
  })

  it('builds the same report every time from the same two sides', () => {
    const editor = editorWithBothSides()

    expect(editor.buildReport()).toEqual(editor.buildReport())
  })
})
