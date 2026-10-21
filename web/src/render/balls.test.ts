import { describe, expect, it } from 'vitest'
import { colourOf, isStripe, shade, spotFacing, turn, upright } from './balls'

describe('turn', () => {
  it('leaves a ball alone when it is not spinning', () => {
    const m = upright()
    turn(m, 0, 0, 0, 1)
    expect(Array.from(m)).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1])
  })

  it('carries the x axis onto the y axis after a quarter turn about z', () => {
    const m = upright()
    turn(m, 0, 0, Math.PI / 2, 1)
    // The ball's own x axis is the first column.
    expect(m[0]).toBeCloseTo(0, 12)
    expect(m[3]).toBeCloseTo(1, 12)
    expect(m[6]).toBeCloseTo(0, 12)
  })

  it('stays a pure rotation after many small turns', () => {
    const m = upright()
    for (let i = 0; i < 20_000; i++) turn(m, 31, -17, 9, 1 / 120)
    for (let a = 0; a < 3; a++) {
      for (let b = 0; b < 3; b++) {
        const dot = m[a]! * m[b]! + m[3 + a]! * m[3 + b]! + m[6 + a]! * m[6 + b]!
        expect(dot).toBeCloseTo(a === b ? 1 : 0, 9)
      }
    }
  })

  it('gives the same result in one step or two', () => {
    const once = upright()
    const twice = upright()
    turn(once, 3, 4, 5, 0.2)
    turn(twice, 3, 4, 5, 0.1)
    turn(twice, 3, 4, 5, 0.1)
    twice.forEach((value, i) => expect(value).toBeCloseTo(once[i]!, 12))
  })
})

describe('shade', () => {
  const size = 24
  const pixel = (pixels: Uint8ClampedArray, col: number, row: number) => Array.from(pixels.slice((row * size + col) * 4, (row * size + col) * 4 + 4))

  it('leaves the corners of the square clear and fills the middle', () => {
    const pixels = new Uint8ClampedArray(size * size * 4)
    shade(pixels, size, 3, upright())
    expect(pixel(pixels, 0, 0)[3]).toBe(0)
    expect(pixel(pixels, 12, 12)[3]).toBe(255)
  })

  it('shows the number spot face on, then the ball\'s colour once it has turned away', () => {
    const facing = new Uint8ClampedArray(size * size * 4)
    shade(facing, size, 3, upright())
    const [r, g, b] = pixel(facing, 12, 12)
    expect(Math.min(r!, g!, b!)).toBeGreaterThan(180) // white spot

    const turned = upright()
    turn(turned, Math.PI / 2, 0, 0, 1)
    const side = new Uint8ClampedArray(size * size * 4)
    shade(side, size, 3, turned)
    const [r2, g2] = pixel(side, 12, 12)
    expect(r2!).toBeGreaterThan(g2! * 2) // red
  })
})

describe('ball set', () => {
  it('has seven solids, the black, and seven stripes in matching colours', () => {
    expect(isStripe(7)).toBe(false)
    expect(isStripe(8)).toBe(false)
    expect(isStripe(9)).toBe(true)
    expect(colourOf(9)).toEqual(colourOf(1))
    expect(colourOf(15)).toEqual(colourOf(7))
  })
})

describe('spotFacing', () => {
  it('always names the pole that faces the viewer', () => {
    const m = upright()
    turn(m, Math.PI * 0.9, 0, 0, 1) // nearly upside down
    expect(spotFacing(m)[2]).toBeGreaterThan(0)
  })
})
