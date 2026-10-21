import { describe, expect, it } from 'vitest'
import { HOUSE_CUE, cueById } from './cues'
import { clampTip, clip, powerFor, powerFromPull, speedFor } from './shot'

describe('powerFromPull', () => {
  it('is the share of a full pull', () => {
    expect(powerFromPull(60, 240)).toBe(0.25)
  })
  it('stops at zero and at full', () => {
    expect(powerFromPull(-30, 240)).toBe(0)
    expect(powerFromPull(999, 240)).toBe(1)
  })
})

describe('speedFor', () => {
  it('reaches the cue\'s top speed at a full pull', () => {
    expect(speedFor(1, HOUSE_CUE)).toBeCloseTo(HOUSE_CUE.maxSpeed, 10)
  })
  it('still moves the ball at the lightest touch', () => {
    expect(speedFor(0, HOUSE_CUE)).toBeGreaterThan(0.2)
  })
  it('keeps half a pull soft', () => {
    expect(speedFor(0.5, HOUSE_CUE)).toBeLessThan(HOUSE_CUE.maxSpeed * 0.4)
  })
  it('always rises with the pull', () => {
    for (let p = 0; p < 1; p += 0.05) expect(speedFor(p + 0.05, HOUSE_CUE)).toBeGreaterThan(speedFor(p, HOUSE_CUE))
  })
})

describe('the break', () => {
  it('is a fifth faster with the Atlas cue, and only on the break', () => {
    const atlas = cueById('atlas')
    expect(speedFor(1, atlas, true)).toBeCloseTo(atlas.maxSpeed * 1.2, 10)
    expect(speedFor(1, atlas, false)).toBeCloseTo(atlas.maxSpeed, 10)
    expect(speedFor(1, HOUSE_CUE, true)).toBeCloseTo(HOUSE_CUE.maxSpeed, 10)
  })
})

describe('clip', () => {
  const path = [0, 0, 1, 0, 1, 2] // one metre right, then two metres up

  it('keeps a path shorter than the limit whole', () => {
    expect(clip(path, 10)).toEqual(path)
  })
  it('ends exactly at the limit, part way along a step', () => {
    expect(clip(path, 2)).toEqual([0, 0, 1, 0, 1, 1])
    expect(clip(path, 0.25)).toEqual([0, 0, 0.25, 0])
  })
  it('gives just the start for no length, and nothing for no path', () => {
    expect(clip(path, 0)).toEqual([0, 0])
    expect(clip([], 1)).toEqual([])
  })
})

describe('powerFor', () => {
  it('undoes speedFor', () => {
    for (const power of [0.1, 0.35, 0.8, 1]) expect(powerFor(speedFor(power, HOUSE_CUE), HOUSE_CUE)).toBeCloseTo(power, 10)
  })
  it('stays between nothing and a full pull', () => {
    expect(powerFor(0, HOUSE_CUE)).toBe(0)
    expect(powerFor(99, HOUSE_CUE)).toBe(1)
  })
})

describe('clampTip', () => {
  it('leaves a strike inside the allowed circle alone', () => {
    expect(clampTip(0.2, -0.3, HOUSE_CUE)).toEqual({ side: 0.2, height: -0.3 })
  })
  it('pulls a strike outside the circle back to its edge, in the same direction', () => {
    const tip = clampTip(0.9, 1.2, HOUSE_CUE)
    expect(Math.hypot(tip.side, tip.height)).toBeCloseTo(HOUSE_CUE.maxTip, 10)
    expect(tip.height / tip.side).toBeCloseTo(1.2 / 0.9, 10)
  })
})
