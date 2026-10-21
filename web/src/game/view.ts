// Maps the table, in metres, onto the canvas, in pixels.
//
// The table picture shows 2.8 m across its width, centred on the cloth. Every
// position the page draws goes through the same scale, so balls line up with
// the picture's pockets.

/** Metres of table across the full width of the picture. */
export const METRES_ACROSS = 2.8

/** The picture's width divided by its height. */
export const ASPECT = 16 / 9

export interface View {
  /** Canvas size in CSS pixels. */
  width: number
  height: number
  /** CSS pixels per metre. */
  scale: number
}

export function viewFor(width: number): View {
  return { width, height: width / ASPECT, scale: width / METRES_ACROSS }
}

/** Table metres to canvas pixels. The canvas's y runs down, the table's up. */
export function toPixels(view: View, x: number, y: number): [number, number] {
  return [view.width / 2 + x * view.scale, view.height / 2 - y * view.scale]
}

export function toMetres(view: View, px: number, py: number): [number, number] {
  return [(px - view.width / 2) / view.scale, (view.height / 2 - py) / view.scale]
}
