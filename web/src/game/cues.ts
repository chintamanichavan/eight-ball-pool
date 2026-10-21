// The six cues. A cue changes what the player is able to do; it never changes
// how the table behaves.

/** A rating from 1 (weakest) to 5. */
export type Rating = 1 | 2 | 3 | 4 | 5

// What each rating is worth. See docs/DESIGN.md, step 3.
const TOP_SPEED = [6.4, 7.3, 8.2, 9.1, 10.0] // metres per second
const TIP_REACH = [0.37, 0.44, 0.51, 0.58, 0.65] // ball radii from centre
const GUIDE_LENGTH = [0.05, 0.1, 0.22, 0.4, 0.7] // metres

/** How long Lakeshore's and Monsoon's own lines are, in metres. */
const LONG_LINE = 0.8

export interface Cue {
  id: string
  name: string
  /** The city whose tables must be beaten to win it. */
  wonIn: string
  power: Rating
  spin: Rating
  guide: Rating
  /** What this cue alone can do, in a sentence. Empty for the house cue. */
  ownPower: string

  /** Fastest the cue ball can leave, in metres per second. */
  maxSpeed: number
  /** Furthest from centre the tip may strike, in ball radii. */
  maxTip: number
  /** How far the guide follows the struck ball and the cue ball after the hit, in metres. */
  objectGuide: number
  cueGuide: number
  /** Cushions the guide follows the cue ball off before the hit. */
  bounces: number
  /** How much faster the break shot is: 1 is no faster. */
  breakBoost: number
  /** Whether the guide follows the struck ball until it stops or drops. */
  followsToRest: boolean
}

type Extra = Partial<Pick<Cue, 'objectGuide' | 'cueGuide' | 'bounces' | 'breakBoost' | 'followsToRest'>>

function cue(id: string, name: string, wonIn: string, power: Rating, spin: Rating, guide: Rating, ownPower: string, extra: Extra = {}): Cue {
  return {
    id,
    name,
    wonIn,
    power,
    spin,
    guide,
    ownPower,
    maxSpeed: TOP_SPEED[power - 1]!,
    maxTip: TIP_REACH[spin - 1]!,
    objectGuide: GUIDE_LENGTH[guide - 1]!,
    cueGuide: GUIDE_LENGTH[guide - 1]! * 0.6,
    bounces: 0,
    breakBoost: 1,
    followsToRest: false,
    ...extra,
  }
}

export const CUES: Cue[] = [
  cue('house', 'House', 'You start with it', 2, 2, 2, ''),
  cue('lakeshore', 'Lakeshore', 'Chicago', 3, 2, 3, 'Shows where the struck ball heads', { objectGuide: LONG_LINE }),
  cue('monsoon', 'Monsoon', 'Mumbai', 3, 4, 3, 'Shows where the cue ball goes after the hit, spin included', { cueGuide: LONG_LINE }),
  cue('neon', 'Neon', 'Tokyo', 4, 3, 4, 'The guide follows one bounce off a cushion', { bounces: 1 }),
  cue('atlas', 'Atlas', 'Marrakech', 5, 3, 3, 'The break shot is a fifth faster', { breakBoost: 1.2 }),
  cue('aurora', 'Aurora', 'Reykjavik', 5, 5, 5, 'Shows the whole path of the struck ball, into the pocket', { followsToRest: true, objectGuide: Infinity }),
]

export const HOUSE_CUE = CUES[0]!

export function cueById(id: string | null): Cue {
  return CUES.find((c) => c.id === id) ?? HOUSE_CUE
}

// The player's choice is kept in the browser, so it is still there next visit.
const SAVED_AS = 'eight-ball:cue'

export function savedCue(): Cue {
  try {
    return cueById(window.localStorage.getItem(SAVED_AS))
  } catch {
    return HOUSE_CUE // storage can be switched off; the game still plays
  }
}

export function saveCue(chosen: Cue): void {
  try {
    window.localStorage.setItem(SAVED_AS, chosen.id)
  } catch {
    // Nothing to do: the choice lasts for this visit only.
  }
}
