import { describe, expect, it } from 'vitest'
import {
  CITIES,
  EVERYTHING,
  NO_PROGRESS,
  beaten,
  cityOf,
  cityOpen,
  cityWon,
  cuesWon,
  nextFixture,
  opponentFor,
  parseProgress,
  recordWin,
  roomBackground,
  themeFor,
} from './ladder'
import type { Progress } from './ladder'
import { CUES } from './cues'

const win = (progress: Progress, cityId: string, table: number) => recordWin(progress, { cityId, table })
const winCity = (progress: Progress, cityId: string) => [0, 1, 2].reduce((p, table) => win(p, cityId, table).progress, progress)

describe('the cities', () => {
  it('are five, each giving a different cue, in the order of the cue rack', () => {
    expect(CITIES.map((c) => c.name)).toEqual(['Chicago', 'Mumbai', 'Tokyo', 'Marrakech', 'Reykjavik'])
    expect(CITIES.map((c) => c.cueId)).toEqual(CUES.slice(1).map((c) => c.id))
  })

  it('get harder at every table, from the first to the last', () => {
    const errors = CITIES.flatMap((c) => c.aimErrors)
    for (let i = 1; i < errors.length; i++) expect(errors[i]).toBeLessThan(errors[i - 1]!)
  })
})

describe('roomBackground', () => {
  it('lays lamplight and dark corners over the city\'s own colours', () => {
    const room = roomBackground(CITIES[2]!)
    expect(room.endsWith(CITIES[2]!.room)).toBe(true)
    expect(room.split('radial-gradient')).toHaveLength(3)
  })
})

describe('opponentFor', () => {
  it('gives each table its own aim', () => {
    expect(opponentFor({ cityId: 'chicago', table: 0 }).aimErrorDegrees).toBe(2.6)
    expect(opponentFor({ cityId: 'reykjavik', table: 2 }).aimErrorDegrees).toBe(0.15)
  })
  it('hands the player that city\'s cue, which sets how hard they break', () => {
    const marrakech = opponentFor({ cityId: 'marrakech', table: 0 })
    const chicago = opponentFor({ cityId: 'chicago', table: 0 })
    expect(marrakech.cue.name).toBe('Atlas')
    expect(marrakech.breakSpeed).toBeGreaterThan(chicago.breakSpeed)
  })
  it('makes a looser player misjudge pace more', () => {
    expect(opponentFor({ cityId: 'chicago', table: 0 }).speedError).toBeGreaterThan(opponentFor({ cityId: 'reykjavik', table: 2 }).speedError)
  })
})

describe('progress', () => {
  it('starts with only Chicago open and only the house cue', () => {
    expect(cityOpen(NO_PROGRESS, 'chicago')).toBe(true)
    expect(cityOpen(NO_PROGRESS, 'mumbai')).toBe(false)
    expect(cuesWon(NO_PROGRESS).map((c) => c.id)).toEqual(['house'])
    expect(nextFixture(NO_PROGRESS)).toEqual({ cityId: 'chicago', table: 0 })
  })

  it('counts tables beaten, in any order, and does not count one twice', () => {
    let p = win(NO_PROGRESS, 'chicago', 2).progress
    p = win(p, 'chicago', 2).progress
    expect(beaten(p, 'chicago')).toBe(1)
    expect(cityWon(p, 'chicago')).toBe(false)
    expect(nextFixture(p)).toEqual({ cityId: 'chicago', table: 0 })
  })

  it('does not change the progress it was given', () => {
    const before: Progress = { chicago: [true] }
    win(before, 'chicago', 1)
    expect(before).toEqual({ chicago: [true] })
  })

  it('wins the cue and opens the next city on the third table', () => {
    const two = win(win(NO_PROGRESS, 'chicago', 0).progress, 'chicago', 1)
    expect(two.reward).toEqual({ cue: null, opened: null, ladderDone: false })

    const three = win(two.progress, 'chicago', 2)
    expect(three.reward.cue?.name).toBe('Lakeshore')
    expect(three.reward.opened?.name).toBe('Mumbai')
    expect(cityOpen(three.progress, 'mumbai')).toBe(true)
    expect(cityOpen(three.progress, 'tokyo')).toBe(false)
    expect(cuesWon(three.progress).map((c) => c.id)).toEqual(['house', 'lakeshore'])
    expect(nextFixture(three.progress)).toEqual({ cityId: 'mumbai', table: 0 })
  })

  it('gives no second reward for replaying a table in a city already won', () => {
    const won = winCity(NO_PROGRESS, 'chicago')
    expect(win(won, 'chicago', 1).reward.cue).toBeNull()
  })

  it('finishes the ladder on the last table of the last city', () => {
    let p = NO_PROGRESS
    for (const city of CITIES.slice(0, 4)) p = winCity(p, city.id)
    p = win(win(p, 'reykjavik', 0).progress, 'reykjavik', 1).progress
    const last = win(p, 'reykjavik', 2)
    expect(last.reward.cue?.name).toBe('Aurora')
    expect(last.reward.opened).toBeNull()
    expect(last.reward.ladderDone).toBe(true)
    expect(nextFixture(last.progress)).toBeNull()
    expect(cuesWon(last.progress)).toHaveLength(6)
  })

  it('has a record with everything won', () => {
    expect(CITIES.every((c) => cityWon(EVERYTHING, c.id))).toBe(true)
  })
})

describe('cityOf', () => {
  it('names the city a cue is won in, and none for the house cue', () => {
    expect(cityOf(CUES[3]!)?.name).toBe('Tokyo')
    expect(cityOf(CUES[0]!)).toBeUndefined()
  })
})

describe('themeFor', () => {
  const fixture = { cityId: 'mumbai', table: 0 }
  it('shows a table in its own city\'s cloth by default', () => {
    expect(themeFor(EVERYTHING, 'own', fixture).id).toBe('mumbai')
  })
  it('uses the chosen theme once that city is won', () => {
    expect(themeFor(EVERYTHING, 'tokyo', fixture).id).toBe('tokyo')
  })
  it('ignores a theme from a city not yet won', () => {
    expect(themeFor(winCity(NO_PROGRESS, 'chicago'), 'tokyo', fixture).id).toBe('mumbai')
  })
})

describe('parseProgress', () => {
  it('reads back what was saved', () => {
    const p = win(NO_PROGRESS, 'chicago', 1).progress
    expect(parseProgress(JSON.stringify(p))).toEqual({ chicago: [false, true, false] })
  })
  it('treats nothing, nonsense and other shapes as no progress', () => {
    expect(parseProgress(null)).toEqual({})
    expect(parseProgress('not json')).toEqual({})
    expect(parseProgress('42')).toEqual({})
    expect(parseProgress('{"atlantis":[true,true,true],"chicago":"yes"}')).toEqual({})
  })
  it('accepts only real wins', () => {
    expect(parseProgress('{"chicago":[1,"true",true,true]}')).toEqual({ chicago: [false, false, true] })
  })
})
