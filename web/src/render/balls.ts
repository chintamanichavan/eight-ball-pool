// Draws the balls as lit, turning spheres.
//
// A flat circle cannot show a ball rolling or spinning, and that motion is
// most of what makes a shot feel real. So each ball keeps an orientation, and
// every pixel of it is shaded from where that pixel sits on the turned sphere.
// At about 40 pixels across, sixteen balls cost some 25,000 pixels a frame.

type Rgb = [number, number, number]

const WHITE: Rgb = [246, 243, 234]
const DOT: Rgb = [200, 40, 50]
const COLOURS: Rgb[] = [
  [245, 191, 26], // 1 and 9: yellow
  [28, 77, 191], // 2 and 10: blue
  [217, 33, 38], // 3 and 11: red
  [107, 51, 153], // 4 and 12: purple
  [242, 115, 26], // 5 and 13: orange
  [26, 133, 77], // 6 and 14: green
  [128, 31, 36], // 7 and 15: maroon
  [18, 18, 18], // 8: black
]

/** Ball 0 is the cue ball, 1 to 7 solids, 8 the black, 9 to 15 stripes. */
export const isStripe = (ball: number) => ball >= 9

export function colourOf(ball: number): Rgb {
  return ball === 0 ? WHITE : COLOURS[(ball - 1) % 8]!
}

// ─── Orientation ────────────────────────────────────────────────────────

/** A rotation, row by row: where the ball's own x, y and z axes now point. */
export type Orientation = Float64Array

export function upright(): Orientation {
  return Float64Array.of(1, 0, 0, 0, 1, 0, 0, 0, 1)
}

/**
 * Turns `m` by spinning at (wx, wy, wz) radians per second for `dt` seconds.
 * Exact for a constant spin: one turn about the spin's own axis.
 */
export function turn(m: Orientation, wx: number, wy: number, wz: number, dt: number): void {
  const rate = Math.hypot(wx, wy, wz)
  const angle = rate * dt
  if (angle < 1e-9) return

  const ax = wx / rate
  const ay = wy / rate
  const az = wz / rate
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const k = 1 - c

  // The turn as a matrix, then applied in front of the current orientation.
  const r00 = c + ax * ax * k, r01 = ax * ay * k - az * s, r02 = ax * az * k + ay * s
  const r10 = ay * ax * k + az * s, r11 = c + ay * ay * k, r12 = ay * az * k - ax * s
  const r20 = az * ax * k - ay * s, r21 = az * ay * k + ax * s, r22 = c + az * az * k
  for (let col = 0; col < 3; col++) {
    const a = m[col]!
    const b = m[3 + col]!
    const d = m[6 + col]!
    m[col] = r00 * a + r01 * b + r02 * d
    m[3 + col] = r10 * a + r11 * b + r12 * d
    m[6 + col] = r20 * a + r21 * b + r22 * d
  }
}

// ─── Shading ────────────────────────────────────────────────────────────

// Light from the upper left, a little towards the viewer.
const LIGHT = normalise(-0.4, 0.5, 0.77)
// Halfway between the light and the viewer, who looks straight down.
const HALF = normalise(LIGHT[0], LIGHT[1], LIGHT[2] + 1)

function normalise(x: number, y: number, z: number): Rgb {
  const len = Math.hypot(x, y, z)
  return [x / len, y / len, z / len]
}

const STRIPE_HALF_WIDTH = 0.5 // of the radius
const SPOT = 0.8 // how close to a pole a point must be to sit on the number spot
const CUE_DOT = 0.975

/** The paint at a point on the ball, given in the ball's own axes. */
function paint(ball: number, x: number, y: number, z: number): Rgb {
  if (ball === 0) {
    // Six small red dots, so the cue ball's spin can be seen.
    return Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) > CUE_DOT ? DOT : WHITE
  }
  if (Math.abs(z) > SPOT) return WHITE
  if (isStripe(ball) && Math.abs(y) > STRIPE_HALF_WIDTH) return WHITE
  return colourOf(ball)
}

/** Shades one ball into `pixels`, a square of `size` by `size`. */
export function shade(pixels: Uint8ClampedArray, size: number, ball: number, m: Orientation): void {
  const radius = size / 2
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const at = (row * size + col) * 4
      const nx = (col + 0.5 - radius) / radius
      const ny = -(row + 0.5 - radius) / radius // the screen's y runs down
      const flat = nx * nx + ny * ny
      if (flat >= 1) {
        pixels[at + 3] = 0
        continue
      }
      const nz = Math.sqrt(1 - flat)

      // The same point in the ball's own axes: the orientation, reversed.
      const lx = m[0]! * nx + m[3]! * ny + m[6]! * nz
      const ly = m[1]! * nx + m[4]! * ny + m[7]! * nz
      const lz = m[2]! * nx + m[5]! * ny + m[8]! * nz
      const base = paint(ball, lx, ly, lz)

      const lit = 0.46 + 0.6 * Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2])
      const shine = 150 * Math.pow(Math.max(0, nx * HALF[0] + ny * HALF[1] + nz * HALF[2]), 60)
      pixels[at] = base[0] * lit + shine
      pixels[at + 1] = base[1] * lit + shine
      pixels[at + 2] = base[2] * lit + shine
      // Fade the last pixel of the rim, so the edge is smooth.
      pixels[at + 3] = 255 * Math.min(1, (1 - Math.sqrt(flat)) * radius)
    }
  }
}

/** Where a ball's number spots face: the ball's own z axis, both ways. */
export function spotFacing(m: Orientation): Rgb {
  const flip = m[8]! >= 0 ? 1 : -1 // the pole that faces the viewer
  return [m[2]! * flip, m[5]! * flip, m[8]! * flip]
}
