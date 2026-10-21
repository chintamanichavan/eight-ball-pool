// The page's view of the C++ engine: the table, the rules of eight-ball and the
// computer's player. The engine decides everything; the page draws what it
// reports. The person is player 0 and the computer player 1. Distances are metres, angles radians, and
// the origin is the centre of the cloth with y pointing up the screen.

export interface Sizes {
  length: number
  width: number
  ballRadius: number
  cornerGap: number
  sideGap: number
}

/** Where a shot would go. Directions are unit vectors, or zero when unused. */
export interface Guide {
  ghostX: number
  ghostY: number
  /** The ball the cue ball meets first, or -1 for a cushion. */
  ball: number
  /** Whether the player to shoot may hit that ball first. */
  legal: boolean
  objectX: number
  objectY: number
  cueX: number
  cueY: number
}

/** A shot played out ahead of time. Each path is a flat list: x, y, x, y, ... */
export interface Preview {
  /** The cue ball, up to where it first touches a ball or the preview gave up. */
  cueBefore: number[]
  /** The cue ball and the touched ball, from the moment they meet. */
  cueAfter: number[]
  object: number[]
  /** The first ball touched, or -1. */
  ball: number
  /** Whether the touched ball went down a pocket. */
  potted: boolean
  /** Whether the player to shoot may hit that ball first. */
  legal: boolean
}

export const BALL_HIT = 0
export const CUSHION_HIT = 1
export const POCKETED = 2

export interface TableEvent {
  kind: typeof BALL_HIT | typeof CUSHION_HIT | typeof POCKETED
  ball: number
  other: number
  /** Closing speed in metres per second. */
  strength: number
}

export const BALLS = 16
export const CUE_BALL = 0

/** Numbers per ball in the array `state()` returns. */
export const FIELDS = 8
export const X = 0
export const Y = 1
export const ROLL_SPIN_X = 4
export const ROLL_SPIN_Y = 5
export const SIDE_SPIN = 6
export const ON_TABLE = 7

export const YOU = 0
export const COMPUTER = 1
export type Player = typeof YOU | typeof COMPUTER

export const OPEN = 0
export const SOLIDS = 1
export const STRIPES = 2
export type Group = typeof OPEN | typeof SOLIDS | typeof STRIPES

export interface Status {
  /** Whose turn it is. */
  player: Player
  yourGroup: Group
  computerGroup: Group
  /** Balls still to pot, the black not counted. */
  yourLeft: number
  computerLeft: number
  breaking: boolean
  /** The player to shoot may put the cue ball anywhere first. */
  ballInHand: boolean
  /** -1 while the game is on. */
  winner: Player | -1
}

export const NO_FOUL = 0
export const SCRATCH = 1
export const NO_HIT = 2
export const WRONG_BALL = 3

/** The rules' ruling on the shot just played. */
export interface Verdict {
  foul: typeof NO_FOUL | typeof SCRATCH | typeof NO_HIT | typeof WRONG_BALL
  turnPasses: boolean
  /** The black dropped on the break and the balls were racked again. */
  rerack: boolean
  winner: Player | -1
}

/** What the computer has decided to do. */
export interface Plan {
  /** Put the cue ball at (x, y) first. */
  place: boolean
  x: number
  y: number
  angle: number
  speed: number
}

export interface Match {
  /**
   * Racks a new game against a player with the given typical errors (aim in
   * degrees, pace as a share of the speed) and break speed.
   */
  start(aimErrorDegrees: number, speedError: number, breakSpeed: number, seed: number): void
  status(): Status
  /** Tries to put the cue ball down. False, and nothing moves, if the spot is taken. */
  placeCueBall(x: number, y: number): boolean
  confirmPlacement(): void
  strike(angle: number, speed: number, side: number, height: number): void
  advance(seconds: number): TableEvent[]
  /** Call once the balls have stopped: the rules judge the shot. */
  finishShot(): Verdict
  moving(): boolean
  /** A view of the engine's memory. Read it before the next call. */
  state(): Float64Array
  guide(angle: number): Guide
  /** Plays a shot out on a copy of the table, for the guide lines. */
  preview(angle: number, speed: number, side: number, height: number, bounces: number, seconds: number): Preview
  /** The computer thinks a little. Call each frame until it returns true. */
  think(shots: number): boolean
  computerPlan(): Plan
}

export interface Engine {
  match: Match
  sizes: Sizes
}

/** Loads the WebAssembly engine. Call `match.start` to rack a game. */
export async function loadEngine(): Promise<Engine> {
  const { default: createEngine } = await import('./wasm/engine.js')
  const module = await createEngine()
  return { match: new module.Match(), sizes: module.sizes() }
}
