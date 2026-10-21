import { beforeEach, describe, expect, it } from 'vitest'
import { CUES, HOUSE_CUE, cueById, saveCue, savedCue } from './cues'

const named = (id: string) => cueById(id)

describe('the six cues', () => {
  it('are six, starting with the house cue', () => {
    expect(CUES.map((c) => c.name)).toEqual(['House', 'Lakeshore', 'Monsoon', 'Neon', 'Atlas', 'Aurora'])
    expect(HOUSE_CUE.ownPower).toBe('')
  })

  it('give every cue after the first a power of its own', () => {
    for (const c of CUES.slice(1)) expect(c.ownPower).not.toBe('')
  })

  it('turn a higher rating into more of what it rates', () => {
    expect(named('atlas').maxSpeed).toBeGreaterThan(named('neon').maxSpeed)
    expect(named('neon').maxSpeed).toBeGreaterThan(named('house').maxSpeed)
    expect(named('monsoon').maxTip).toBeGreaterThan(named('lakeshore').maxTip)
    expect(named('neon').cueGuide).toBeGreaterThan(named('house').cueGuide)
  })

  it('never beat Aurora on any rating', () => {
    const best = named('aurora')
    for (const c of CUES) {
      expect(c.maxSpeed).toBeLessThanOrEqual(best.maxSpeed)
      expect(c.maxTip).toBeLessThanOrEqual(best.maxTip)
    }
  })

  it('give each named power to one cue only', () => {
    expect(CUES.filter((c) => c.bounces > 0).map((c) => c.id)).toEqual(['neon'])
    expect(CUES.filter((c) => c.breakBoost > 1).map((c) => c.id)).toEqual(['atlas'])
    expect(CUES.filter((c) => c.followsToRest).map((c) => c.id)).toEqual(['aurora'])
    expect(named('lakeshore').objectGuide).toBeGreaterThan(named('neon').objectGuide)
    expect(named('monsoon').cueGuide).toBeGreaterThan(named('neon').cueGuide)
  })
})

describe('the saved cue', () => {
  beforeEach(() => window.localStorage.clear())

  it('is the house cue on a first visit', () => {
    expect(savedCue()).toBe(HOUSE_CUE)
  })
  it('is whatever was chosen last', () => {
    saveCue(named('neon'))
    expect(savedCue().id).toBe('neon')
  })
  it('falls back to the house cue if the saved name means nothing', () => {
    window.localStorage.setItem('eight-ball:cue', 'excalibur')
    expect(savedCue()).toBe(HOUSE_CUE)
  })
})
