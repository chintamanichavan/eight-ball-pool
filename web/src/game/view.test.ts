import { describe, expect, it } from 'vitest'
import { METRES_ACROSS, toMetres, toPixels, viewFor } from './view'

describe('view', () => {
  const view = viewFor(1120)

  it('keeps the picture 16 by 9', () => {
    expect(view.height).toBe(630)
  })
  it('puts the centre of the cloth at the centre of the canvas', () => {
    expect(toPixels(view, 0, 0)).toEqual([560, 315])
  })
  it('shows 2.8 metres across', () => {
    expect(toPixels(view, METRES_ACROSS / 2, 0)[0]).toBeCloseTo(1120, 10)
  })
  it('draws up the table as up the screen', () => {
    expect(toPixels(view, 0, 0.5)[1]).toBeLessThan(315)
  })
  it('maps pixels back to the same metres', () => {
    const [px, py] = toPixels(view, -0.61, 0.27)
    const [x, y] = toMetres(view, px, py)
    expect(x).toBeCloseTo(-0.61, 12)
    expect(y).toBeCloseTo(0.27, 12)
  })
})
