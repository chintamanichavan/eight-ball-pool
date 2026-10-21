// The ladder: five cities of three tables each, and what the player has won.
//
// Everything here is plain data and pure functions. Saving and loading sit at
// the bottom, and are the only part that touches the browser.

import { CUES, cueById } from './cues'
import type { Cue } from './cues'

export const TABLES_PER_CITY = 3

export interface City {
  id: string
  name: string
  /** A few words on its cloth and its room. */
  look: string
  /** The room behind the table, as a CSS background. */
  room: string
  /** The cue its players carry, won by beating all its tables. */
  cueId: string
  /** How far off each table's player typically aims, in degrees: tables 1, 2, 3. */
  aimErrors: [number, number, number]
}

export const CITIES: City[] = [
  { id: 'chicago', name: 'Chicago', look: 'Classic green cloth. A lakefront room at dusk.', room: 'linear-gradient(160deg, #5d7186, #2f3d4d)', cueId: 'lakeshore', aimErrors: [2.6, 2.2, 1.9] },
  { id: 'mumbai', name: 'Mumbai', look: 'Sea green cloth. A monsoon evening.', room: 'linear-gradient(160deg, #b9aa98, #7d7166)', cueId: 'monsoon', aimErrors: [1.6, 1.4, 1.2] },
  { id: 'tokyo', name: 'Tokyo', look: 'Indigo cloth. A neon night.', room: 'linear-gradient(160deg, #3a1a4d, #0d0d16)', cueId: 'neon', aimErrors: [1.0, 0.85, 0.7] },
  { id: 'marrakech', name: 'Marrakech', look: 'Brick red cloth. A tiled courtyard.', room: 'linear-gradient(160deg, #e3c9a1, #c79a63)', cueId: 'atlas', aimErrors: [0.55, 0.45, 0.38] },
  { id: 'reykjavik', name: 'Reykjavik', look: 'Slate blue cloth. Northern lights.', room: 'linear-gradient(160deg, #1b6b6a, #0b1626)', cueId: 'aurora', aimErrors: [0.3, 0.22, 0.15] },
]

/**
 * The room as it is drawn behind a table: the city's colours, a pool of
 * lamplight over the middle, and darker corners.
 */
export function roomBackground(city: City): string {
  const lamp = 'radial-gradient(ellipse 62% 70% at 50% 46%, rgb(255 244 214 / 0.22), transparent 70%)'
  const corners = 'radial-gradient(ellipse 85% 95% at 50% 50%, transparent 55%, rgb(0 0 0 / 0.38))'
  return `${lamp}, ${corners}, ${city.room}`
}

export function cityById(id: string): City {
  return CITIES.find((city) => city.id === id) ?? CITIES[0]!
}

/** One table in one city: which game to play. */
export interface Fixture {
  cityId: string
  /** 0, 1 or 2. */
  table: number
}

/** The player a fixture is against, in the terms the engine wants. */
export interface Opponent {
  aimErrorDegrees: number
  /** Error in pace, as a share of the speed: looser players misjudge pace more. */
  speedError: number
  cue: Cue
  breakSpeed: number
}

/** The speed the computer breaks at with the house cue; a better cue adds to it. */
const HOUSE_BREAK = 7.0

export function opponentFor(fixture: Fixture): Opponent {
  const city = cityById(fixture.cityId)
  const aimErrorDegrees = city.aimErrors[fixture.table] ?? city.aimErrors[0]
  const cue = cueById(city.cueId)
  return {
    aimErrorDegrees,
    speedError: 0.03 + 0.02 * Math.min(aimErrorDegrees, 2.5),
    cue,
    breakSpeed: Math.max(HOUSE_BREAK, cue.maxSpeed * cue.breakBoost * 0.85),
  }
}

// ─── Progress ───────────────────────────────────────────────────────────

/** For each city, which of its three tables have been beaten. */
export type Progress = Record<string, boolean[]>

export const NO_PROGRESS: Progress = {}

export function beaten(progress: Progress, cityId: string): number {
  return (progress[cityId] ?? []).filter(Boolean).length
}

export function cityWon(progress: Progress, cityId: string): boolean {
  return beaten(progress, cityId) >= TABLES_PER_CITY
}

/** A city is open once the city before it is won. The first is always open. */
export function cityOpen(progress: Progress, cityId: string): boolean {
  const at = CITIES.findIndex((city) => city.id === cityId)
  return at <= 0 || cityWon(progress, CITIES[at - 1]!.id)
}

/** The cues the player may use: the house cue, and one per city won. */
export function cuesWon(progress: Progress): Cue[] {
  return CUES.filter((cue) => cue.id === 'house' || CITIES.some((city) => city.cueId === cue.id && cityWon(progress, city.id)))
}

/** The city whose tables win `cue`, if any. */
export function cityOf(cue: Cue): City | undefined {
  return CITIES.find((city) => city.cueId === cue.id)
}

/** What beating a table brought, beyond the win itself. */
export interface Reward {
  /** The cue won, if this win completed the city. */
  cue: Cue | null
  /** The city this win opened, if any. */
  opened: City | null
  /** True when the last table of the last city has just been beaten. */
  ladderDone: boolean
}

/** Marks a table beaten. Returns the new progress and what the win unlocked. */
export function recordWin(progress: Progress, fixture: Fixture): { progress: Progress; reward: Reward } {
  const wasWon = cityWon(progress, fixture.cityId)
  const tables = [...(progress[fixture.cityId] ?? [])]
  tables[fixture.table] = true
  const next = { ...progress, [fixture.cityId]: tables }

  const justWon = !wasWon && cityWon(next, fixture.cityId)
  const at = CITIES.findIndex((city) => city.id === fixture.cityId)
  return {
    progress: next,
    reward: {
      cue: justWon ? cueById(cityById(fixture.cityId).cueId) : null,
      opened: justWon ? (CITIES[at + 1] ?? null) : null,
      ladderDone: justWon && at === CITIES.length - 1,
    },
  }
}

/** The table to offer after `fixture`: the next unbeaten one, in ladder order. Null when all are beaten. */
export function nextFixture(progress: Progress): Fixture | null {
  for (const city of CITIES) {
    if (!cityOpen(progress, city.id)) return null
    for (let table = 0; table < TABLES_PER_CITY; table++) {
      if (!progress[city.id]?.[table]) return { cityId: city.id, table }
    }
  }
  return null
}

export const EVERYTHING: Progress = Object.fromEntries(CITIES.map((city) => [city.id, [true, true, true]]))

/** The cloth and room a table is shown in: the chosen theme if that city is won, else the table's own city. */
export function themeFor(progress: Progress, chosen: string, fixture: Fixture): City {
  return chosen !== 'own' && cityWon(progress, chosen) ? cityById(chosen) : cityById(fixture.cityId)
}

// ─── Saving, in the browser only ────────────────────────────────────────

const PROGRESS_KEY = 'eight-ball:progress'
const THEME_KEY = 'eight-ball:theme'

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null // storage can be switched off; the game still plays
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Nothing to do: it lasts for this visit only.
  }
}

/** Only what looks like progress is kept: a saved record from another version must not break the page. */
export function parseProgress(saved: string | null): Progress {
  if (!saved) return NO_PROGRESS
  try {
    const raw: unknown = JSON.parse(saved)
    if (typeof raw !== 'object' || raw === null) return NO_PROGRESS
    const progress: Progress = {}
    for (const city of CITIES) {
      const tables = (raw as Record<string, unknown>)[city.id]
      if (Array.isArray(tables)) progress[city.id] = [0, 1, 2].map((table) => tables[table] === true)
    }
    return progress
  } catch {
    return NO_PROGRESS
  }
}

export const loadProgress = (): Progress => parseProgress(read(PROGRESS_KEY))
export const saveProgress = (progress: Progress): void => write(PROGRESS_KEY, JSON.stringify(progress))
export const loadTheme = (): string => read(THEME_KEY) ?? 'own'
export const saveTheme = (theme: string): void => write(THEME_KEY, theme)
