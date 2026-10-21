import { describe, expect, it } from 'vitest'
import { pocketNear } from './scene'

const sizes = { length: 2.24, width: 1.12, ballRadius: 0.028575, cornerGap: 0.073, sideGap: 0.058 }

describe('pocketNear', () => {
  it('finds the corner pocket a ball dropped into', () => {
    const [x, y] = pocketNear(sizes, 1.12, 0.5)
    expect(x).toBeCloseTo(1.108, 10)
    expect(y).toBeCloseTo(0.548, 10)
  })
  it('finds the side pocket, which sits a little outside the cushion line', () => {
    const [x, y] = pocketNear(sizes, 0.03, -0.561)
    expect(x).toBe(0)
    expect(y).toBeCloseTo(-0.582, 10)
  })
  it('mirrors for the other corners', () => {
    expect(pocketNear(sizes, -1.12, -0.5)).toEqual([-1.108, -0.548].map((v) => expect.closeTo(v, 10)))
  })
})
