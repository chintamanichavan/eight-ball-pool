// Turns what the player does with the cue into a shot for the engine.

import type { Cue } from './cues'

/** Where the tip strikes: both in ball radii, positive right and positive up. */
export interface Tip {
  side: number
  height: number
}

export const CENTRE: Tip = { side: 0, height: 0 }

/** A pull shorter than this is a change of mind, not a shot. */
export const SMALLEST_SHOT = 0.04

/** How far back the cue is pulled, as a share of a full pull, 0 to 1. */
export function powerFromPull(pulled: number, fullPull: number): number {
  return Math.min(Math.max(pulled / fullPull, 0), 1)
}

/**
 * The speed the cue ball leaves at. The curve is gentle at the bottom, so
 * half a pull is a soft shot and only the last third reaches break speed.
 */
export function speedFor(power: number, cue: Cue, breaking = false): number {
  const boost = breaking ? cue.breakBoost : 1
  return cue.maxSpeed * boost * (0.04 + 0.96 * Math.pow(power, 1.7))
}

/** The pull the guide assumes while the cue is at rest: a medium shot. */
export const RESTING_PULL = 0.45

/**
 * The first `metres` of a path given as x, y, x, y, ... The last point is
 * placed exactly at that distance, so a clipped line ends cleanly.
 */
export function clip(path: number[], metres: number): number[] {
  const out = path.slice(0, 2)
  let left = metres
  for (let i = 2; i + 1 < path.length && left > 0; i += 2) {
    const dx = path[i]! - path[i - 2]!
    const dy = path[i + 1]! - path[i - 1]!
    const step = Math.hypot(dx, dy)
    if (step <= left) {
      out.push(path[i]!, path[i + 1]!)
    } else {
      out.push(path[i - 2]! + (dx * left) / step, path[i - 1]! + (dy * left) / step)
    }
    left -= step
  }
  return out
}

/** The pull that gives `speed`: the reverse of `speedFor`. Used to draw the computer's cue. */
export function powerFor(speed: number, cue: Cue): number {
  const share = (speed / cue.maxSpeed - 0.04) / 0.96
  return Math.min(Math.max(Math.pow(Math.max(share, 0), 1 / 1.7), 0), 1)
}

/** Keeps a strike point inside the circle the cue allows. */
export function clampTip(side: number, height: number, cue: Cue): Tip {
  const off = Math.hypot(side, height)
  if (off <= cue.maxTip) return { side, height }
  return { side: (side / off) * cue.maxTip, height: (height / off) * cue.maxTip }
}
