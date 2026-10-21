// Draws one frame: the table picture, the balls, and while aiming the guide
// lines and the cue.

import { BALLS, CUE_BALL, FIELDS, ON_TABLE, X, Y } from '../engine/engine'
import type { Preview, Sizes } from '../engine/engine'
import type { Cue } from '../game/cues'
import { clip } from '../game/shot'
import { toPixels } from '../game/view'
import type { View } from '../game/view'
import { shade, spotFacing } from './balls'
import type { Orientation } from './balls'

/** The cue picture shows 1.6 m by 0.1 m, with the tip 0.06 m in from the left. */
const CUE_PICTURE = { length: 1.6, thickness: 0.1, tipInset: 0.06 }

/** How far the tip rests from the cue ball, and how far a full pull draws it back. */
const TIP_REST = 0.012
export const FULL_PULL = 0.34

export interface Aiming {
  angle: number
  /** 0 to 1: how far the cue is drawn back. */
  pull: number
  /** The shot played out ahead, or null to draw the cue alone (the computer needs no guide). */
  preview: Preview | null
  cue: Cue
}

/** A ball on its way down a pocket: it slides to the middle of the hole and shrinks out of sight. */
export interface Drop {
  ball: number
  /** Where it crossed the cushion line. */
  x: number
  y: number
  /** 0 when it has just dropped, 1 when it is gone. */
  progress: number
}

/** How long a ball takes to disappear down a pocket, in seconds. */
export const DROP_SECONDS = 0.22

/** The middle of the nearest pocket hole in the table picture. */
export function pocketNear(sizes: Sizes, x: number, y: number): [number, number] {
  const side = Math.abs(x) < sizes.length / 4
  const farY = Math.sign(y) * (sizes.width / 2)
  return side ? [0, farY + Math.sign(y) * 0.022] : [Math.sign(x) * (sizes.length / 2 - 0.012), farY - Math.sign(y) * 0.012]
}

export interface Art {
  /** One table picture per city, by the city's id: the same table in that city's cloth. */
  tables: Record<string, CanvasImageSource>
  /** One picture per cue, by the cue's id. */
  cues: Record<string, CanvasImageSource>
}

export class Scene {
  private sprite = document.createElement('canvas')
  private pixels: ImageData | null = null
  /** The city whose cloth the table is drawn in. */
  cloth = 'chicago'

  constructor(
    private art: Art,
    private sizes: Sizes,
  ) {}

  /**
   * `ctx` is scaled so one unit is one CSS pixel; `density` is device pixels
   * per CSS pixel, so the balls can be shaded at the screen's full sharpness.
   */
  draw(ctx: CanvasRenderingContext2D, view: View, density: number, state: Float64Array, turns: Orientation[], aiming: Aiming | null, drops: Drop[], placing: boolean): void {
    ctx.clearRect(0, 0, view.width, view.height)
    const table = this.art.tables[this.cloth] ?? Object.values(this.art.tables)[0]
    if (table) ctx.drawImage(table, 0, 0, view.width, view.height)

    const radius = this.sizes.ballRadius * view.scale
    this.drawDrops(ctx, view, density, turns, drops, radius)
    this.drawShadows(ctx, view, state, radius)
    if (aiming?.preview) this.drawGuide(ctx, view, aiming.preview, aiming.cue, radius)
    if (placing) this.drawHand(ctx, view, state, radius)
    this.drawBalls(ctx, view, density, state, turns, radius)
    if (aiming) this.drawCue(ctx, view, state, aiming)
  }

  private drawDrops(ctx: CanvasRenderingContext2D, view: View, density: number, turns: Orientation[], drops: Drop[], radius: number): void {
    for (const drop of drops) {
      const [holeX, holeY] = pocketNear(this.sizes, drop.x, drop.y)
      const [px, py] = toPixels(view, drop.x + (holeX - drop.x) * drop.progress, drop.y + (holeY - drop.y) * drop.progress)
      const size = this.sizeSprite(radius, density)
      shade(this.pixels!.data, size, drop.ball, turns[drop.ball]!)
      this.sprite.getContext('2d')!.putImageData(this.pixels!, 0, 0)
      const drawn = (size / density) * (1 - 0.4 * drop.progress)
      ctx.globalAlpha = 1 - drop.progress * drop.progress
      ctx.drawImage(this.sprite, px - drawn / 2, py - drawn / 2, drawn, drawn)
      ctx.globalAlpha = 1
    }
  }

  /** Makes the scratch picture one ball wide at the screen's sharpness. Returns its size in device pixels. */
  private sizeSprite(radius: number, density: number): number {
    const size = Math.max(8, Math.round(radius * 2 * density))
    if (!this.pixels || this.pixels.width !== size) {
      this.sprite.width = this.sprite.height = size
      this.pixels = new ImageData(size, size)
    }
    return size
  }

  private drawShadows(ctx: CanvasRenderingContext2D, view: View, state: Float64Array, radius: number): void {
    ctx.fillStyle = 'rgb(0 0 0 / 0.28)'
    for (let ball = 0; ball < BALLS; ball++) {
      if (!state[ball * FIELDS + ON_TABLE]) continue
      const [px, py] = toPixels(view, state[ball * FIELDS + X]!, state[ball * FIELDS + Y]!)
      ctx.beginPath()
      // Offset away from the light, which comes from the upper left.
      ctx.ellipse(px + radius * 0.28, py + radius * 0.34, radius * 0.98, radius * 0.9, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  private drawBalls(ctx: CanvasRenderingContext2D, view: View, density: number, state: Float64Array, turns: Orientation[], radius: number): void {
    const size = this.sizeSprite(radius, density)
    const pixels = this.pixels!
    const spriteCtx = this.sprite.getContext('2d')!
    const drawn = size / density

    for (let ball = 0; ball < BALLS; ball++) {
      if (!state[ball * FIELDS + ON_TABLE]) continue
      const [px, py] = toPixels(view, state[ball * FIELDS + X]!, state[ball * FIELDS + Y]!)
      shade(pixels.data, size, ball, turns[ball]!)
      spriteCtx.putImageData(pixels, 0, 0)
      ctx.drawImage(this.sprite, px - drawn / 2, py - drawn / 2, drawn, drawn)
      if (ball !== CUE_BALL) this.drawNumber(ctx, ball, turns[ball]!, px, py, radius)
    }
  }

  /** The number, on whichever spot faces the viewer, shrinking as it turns away. */
  private drawNumber(ctx: CanvasRenderingContext2D, ball: number, turned: Orientation, px: number, py: number, radius: number): void {
    const [fx, fy, fz] = spotFacing(turned)
    if (fz < 0.45) return
    ctx.save()
    ctx.translate(px + fx * radius, py - fy * radius)
    ctx.scale(fz, fz)
    ctx.fillStyle = '#161616'
    ctx.font = `600 ${radius * 0.82}px 'Geist Variable', sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(ball), 0, radius * 0.05)
    ctx.restore()
  }

  /** A dashed ring round the cue ball while the player is free to move it. */
  private drawHand(ctx: CanvasRenderingContext2D, view: View, state: Float64Array, radius: number): void {
    const [cx, cy] = toPixels(view, state[X]!, state[Y]!)
    ctx.save()
    ctx.strokeStyle = 'rgb(255 255 255 / 0.9)'
    ctx.lineWidth = 1.5
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.arc(cx, cy, radius * 1.9, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  /**
   * The guide: the cue ball's path to the first ball, a ring where it touches,
   * then as much of each ball's path after the hit as the cue shows.
   */
  private drawGuide(ctx: CanvasRenderingContext2D, view: View, preview: Preview, cue: Cue, radius: number): void {
    const trace = (path: number[]) => {
      if (path.length < 4) return
      ctx.beginPath()
      for (let i = 0; i + 1 < path.length; i += 2) {
        const [px, py] = toPixels(view, path[i]!, path[i + 1]!)
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.stroke()
    }

    ctx.save()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = 'rgb(255 255 255 / 0.9)'
    ctx.lineWidth = 1.5
    trace(preview.cueBefore)

    const end = preview.cueBefore.length
    if (preview.ball >= 0 && end >= 2) {
      // Red when the rules do not allow hitting this ball first.
      const [gx, gy] = toPixels(view, preview.cueBefore[end - 2]!, preview.cueBefore[end - 1]!)
      ctx.beginPath()
      ctx.arc(gx, gy, radius - 0.75, 0, Math.PI * 2)
      ctx.fillStyle = preview.legal ? 'rgb(255 255 255 / 0.14)' : 'rgb(230 60 50 / 0.45)'
      ctx.fill()
      if (!preview.legal) ctx.strokeStyle = 'rgb(255 120 110)'
      ctx.stroke()
      ctx.strokeStyle = 'rgb(255 255 255 / 0.9)'
    }

    ctx.setLineDash([5, 5])
    const object = clip(preview.object, cue.objectGuide)
    trace(object)
    trace(clip(preview.cueAfter, cue.cueGuide))

    // A cue that follows the ball all the way marks where it ends up.
    if (cue.followsToRest && object.length >= 4) {
      const [ex, ey] = toPixels(view, object[object.length - 2]!, object[object.length - 1]!)
      ctx.setLineDash([])
      ctx.beginPath()
      ctx.arc(ex, ey, preview.potted ? radius * 0.55 : radius - 0.75, 0, Math.PI * 2)
      if (preview.potted) {
        ctx.fillStyle = 'rgb(255 255 255 / 0.9)'
        ctx.fill()
      } else {
        ctx.stroke()
      }
    }
    ctx.restore()
  }

  private drawCue(ctx: CanvasRenderingContext2D, view: View, state: Float64Array, aiming: Aiming): void {
    const back = this.sizes.ballRadius + TIP_REST + aiming.pull * FULL_PULL
    const [tx, ty] = toPixels(view, state[X]! - Math.cos(aiming.angle) * back, state[Y]! - Math.sin(aiming.angle) * back)
    ctx.save()
    ctx.translate(tx, ty)
    // The picture runs tip to butt along +x; the butt points away from the aim.
    ctx.rotate(Math.PI - aiming.angle)
    ctx.shadowColor = 'rgb(0 0 0 / 0.35)'
    ctx.shadowBlur = 6
    ctx.shadowOffsetX = 3
    ctx.shadowOffsetY = 5
    ctx.drawImage(this.art.cues[aiming.cue.id] ?? this.art.cues.house!, -CUE_PICTURE.tipInset * view.scale, (-CUE_PICTURE.thickness / 2) * view.scale, CUE_PICTURE.length * view.scale, CUE_PICTURE.thickness * view.scale)
    ctx.restore()
  }
}
