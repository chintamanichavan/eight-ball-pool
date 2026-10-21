import { describe, expect, it } from 'vitest'
import { COMPUTER, NO_FOUL, NO_HIT, OPEN, SCRATCH, SOLIDS, STRIPES, WRONG_BALL, YOU } from '../engine/engine'
import type { Status, Verdict } from '../engine/engine'
import { HOUSE_CUE } from './cues'
import { groupName, prompt, ruling, task } from './words'

const verdict = (over: Partial<Verdict>): Verdict => ({ foul: NO_FOUL, turnPasses: false, rerack: false, winner: -1, ...over })
const status = (over: Partial<Status>): Status => ({
  player: YOU,
  yourGroup: OPEN,
  computerGroup: OPEN,
  yourLeft: 7,
  computerLeft: 7,
  breaking: false,
  ballInHand: false,
  winner: -1,
  ...over,
})

describe('groupName', () => {
  it('names the three states of a table', () => {
    expect([groupName(OPEN), groupName(SOLIDS), groupName(STRIPES)]).toEqual(['Open table', 'Solids', 'Stripes'])
  })
})

describe('task', () => {
  it('counts what is left', () => {
    expect(task(SOLIDS, 3)).toBe('Solids · 3 left')
  })
  it('says when only the black remains', () => {
    expect(task(STRIPES, 0)).toBe('Stripes · on the black')
  })
  it('has nothing to count on an open table', () => {
    expect(task(OPEN, 7)).toBe('Open table')
  })
})

describe('ruling', () => {
  it('lets a pot keep the turn', () => {
    expect(ruling(verdict({}), YOU)).toBe('Good pot. Shoot again.')
    expect(ruling(verdict({}), COMPUTER)).toBe('The computer potted and shoots again.')
  })
  it('passes the turn after a miss', () => {
    expect(ruling(verdict({ turnPasses: true }), YOU)).toBe("No pot. The computer's turn.")
    expect(ruling(verdict({ turnPasses: true }), COMPUTER)).toBe('The computer missed. Your turn.')
  })
  it('names each foul and who gets the cue ball', () => {
    expect(ruling(verdict({ foul: SCRATCH, turnPasses: true }), YOU)).toBe('Foul: you potted the cue ball. The computer has the cue ball in hand.')
    expect(ruling(verdict({ foul: NO_HIT, turnPasses: true }), COMPUTER)).toBe('Foul: the computer hit nothing. You have the cue ball in hand.')
    expect(ruling(verdict({ foul: WRONG_BALL, turnPasses: true }), YOU)).toMatch(/hit the wrong ball first/)
  })
  it('announces a win by the shooter', () => {
    expect(ruling(verdict({ winner: YOU }), YOU)).toBe('You potted the black. You win.')
    expect(ruling(verdict({ winner: COMPUTER }), COMPUTER)).toBe('The computer potted the black and wins.')
  })
  it('explains a loss on the black', () => {
    expect(ruling(verdict({ winner: COMPUTER }), YOU)).toBe('You potted the black too early. The computer wins.')
    expect(ruling(verdict({ winner: YOU, foul: SCRATCH }), COMPUTER)).toBe('The computer potted the black with a foul. You win.')
  })
  it('explains a rerack', () => {
    expect(ruling(verdict({ rerack: true }), YOU)).toMatch(/racked again/)
  })
})

describe('prompt', () => {
  it('asks for the break, then for a shot', () => {
    expect(prompt(status({ breaking: true }), HOUSE_CUE)).toBe('Your break · House cue')
    expect(prompt(status({}), HOUSE_CUE)).toBe('Your shot · House cue')
  })
  it('explains ball in hand', () => {
    expect(prompt(status({ ballInHand: true }), HOUSE_CUE)).toMatch(/in hand/)
  })
  it('says when the computer is playing, and who won', () => {
    expect(prompt(status({ player: COMPUTER }), HOUSE_CUE)).toBe('Your opponent is at the table')
    expect(prompt(status({ winner: YOU }), HOUSE_CUE)).toBe('You won')
    expect(prompt(status({ winner: COMPUTER }), HOUSE_CUE)).toBe('The computer won')
  })
})
