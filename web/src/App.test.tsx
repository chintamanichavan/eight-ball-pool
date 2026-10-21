import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { describe as describeTip } from './components/SpinPicker'
import { BALLS, COMPUTER, FIELDS, ON_TABLE, OPEN, SOLIDS, STRIPES, YOU } from './engine/engine'
import type { Engine, Status } from './engine/engine'
import { EVERYTHING, saveProgress } from './game/ladder'

const fresh: Status = {
  player: YOU,
  yourGroup: OPEN,
  computerGroup: OPEN,
  yourLeft: 7,
  computerLeft: 7,
  breaking: true,
  ballInHand: false,
  winner: -1,
}

/** An engine that stands still and reports `status`. The canvas has no drawing surface under test. */
function stillEngine(status: Status = fresh): Engine {
  const state = new Float64Array(BALLS * FIELDS)
  state[ON_TABLE] = 1 // the cue ball is on the table
  return {
    sizes: { length: 2.24, width: 1.12, ballRadius: 0.028575, cornerGap: 0.073, sideGap: 0.058 },
    match: {
      start: vi.fn(),
      status: () => status,
      placeCueBall: vi.fn(() => true),
      confirmPlacement: vi.fn(),
      strike: vi.fn(),
      advance: () => [],
      finishShot: () => ({ foul: 0, turnPasses: false, rerack: false, winner: -1 }),
      moving: () => false,
      state: () => state,
      guide: () => ({ ghostX: 0, ghostY: 0, ball: -1, legal: true, objectX: 0, objectY: 0, cueX: 0, cueY: 0 }),
      preview: () => ({ cueBefore: [], cueAfter: [], object: [], ball: -1, potted: false, legal: true }),
      think: () => false,
      computerPlan: () => ({ place: false, x: 0, y: 0, angle: 0, speed: 1 }),
    },
  }
}

const art = { tables: { chicago: new Image() }, cues: { house: new Image() } }
const show = (status?: Status) => render(<App engine={stillEngine(status)} art={art} />)
const sitDown = (name = 'Chicago, table 1') => userEvent.click(screen.getByRole('button', { name }))

beforeEach(() => window.localStorage.clear())

describe('the map', () => {
  it('opens on the ladder with only Chicago to play', () => {
    show()
    expect(screen.getByRole('heading', { name: 'Five cities, three tables each' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Chicago, table 1' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Mumbai, table 1' })).toBeDisabled()
    expect(screen.getByText('0 of 3 tables beaten · wins the Lakeshore cue')).toBeInTheDocument()
    expect(screen.getByText('1 of 6 cues won')).toBeInTheDocument()
  })

  it('offers no theme until a city is won, then the cities won', async () => {
    show()
    expect(screen.getByRole('combobox', { name: 'Table theme' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Open everything' }))
    const theme = screen.getByRole('combobox', { name: 'Table theme' })
    expect(theme).toBeEnabled()
    expect(within(theme).getAllByRole('option').map((o) => o.textContent)).toEqual(["Each city's own", 'Chicago', 'Mumbai', 'Tokyo', 'Marrakech', 'Reykjavik'])
  })

  it('opens everything, and starts again', async () => {
    show()
    await userEvent.click(screen.getByRole('button', { name: 'Open everything' }))
    expect(screen.getByRole('button', { name: 'Reykjavik, table 3, beaten' })).toBeEnabled()
    expect(screen.getByText('6 of 6 cues won')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Start again' }))
    expect(screen.getByRole('button', { name: 'Mumbai, table 1' })).toBeDisabled()
  })

  it('remembers progress between visits', () => {
    saveProgress({ chicago: [true, true, true], mumbai: [true, false, false] })
    show()
    expect(screen.getByText('Won · Lakeshore cue is yours')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mumbai, table 1, beaten' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Tokyo, table 1' })).toBeDisabled()
  })
})

describe('a table', () => {
  it('racks a game against that table\'s player and asks for the break', async () => {
    const engine = stillEngine()
    render(<App engine={engine} art={art} />)
    await sitDown()
    expect(engine.match.start).toHaveBeenCalledWith(2.6, expect.any(Number), expect.any(Number), expect.any(Number))
    expect(screen.getByText('Your break · House cue')).toBeInTheDocument()
    expect(screen.getByText('Chicago · table 1')).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Power' })).toHaveAttribute('aria-disabled', 'false')
  })

  it('shows each player\'s group and what is left', async () => {
    show({ ...fresh, breaking: false, yourGroup: SOLIDS, computerGroup: STRIPES, yourLeft: 3, computerLeft: 0 })
    await sitDown()
    expect(screen.getByText('Solids · 3 left')).toBeInTheDocument()
    expect(screen.getByText('Stripes · on the black')).toBeInTheDocument()
  })

  it('locks the power bar while the opponent is at the table', async () => {
    show({ ...fresh, breaking: false, player: COMPUTER })
    await sitDown()
    expect(screen.getByText('Your opponent is at the table')).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Power' })).toHaveAttribute('aria-disabled', 'true')
  })

  it('goes back to the map', async () => {
    show()
    await sitDown()
    await userEvent.click(screen.getByRole('button', { name: 'Map' }))
    expect(screen.getByRole('heading', { name: 'Five cities, three tables each' })).toBeInTheDocument()
  })

  it('lets only won cues be picked', async () => {
    show()
    await sitDown()
    expect(screen.getByRole('radio', { name: /House/ })).toBeChecked()
    expect(screen.getByRole('radio', { name: /Aurora/ })).toBeDisabled()
    expect(screen.getByText('Win Reykjavik to unlock')).toBeInTheDocument()
    expect(screen.getByText(/1 of 6 won/)).toBeInTheDocument()
  })

  it('remembers the cue picked', async () => {
    saveProgress(EVERYTHING)
    const { unmount } = show()
    await sitDown('Chicago, table 1, beaten')
    await userEvent.click(screen.getByRole('radio', { name: /Aurora/ }))
    expect(screen.getByText('Your break · Aurora cue')).toBeInTheDocument()
    unmount()

    show()
    await sitDown('Chicago, table 1, beaten')
    expect(screen.getByRole('radio', { name: /Aurora/ })).toBeChecked()
  })

  it('turns the sound off and on', async () => {
    show()
    await sitDown()
    await userEvent.click(screen.getByRole('button', { name: 'Sound on' }))
    expect(screen.getByRole('button', { name: 'Sound off' })).toBeInTheDocument()
  })
})

describe('the result', () => {
  it('records a win and offers the next table', async () => {
    show({ ...fresh, breaking: false, winner: YOU })
    await sitDown()
    const result = within(screen.getByRole('region', { name: 'Result' }))
    expect(result.getByText('Chicago, table 1 is beaten.')).toBeInTheDocument()
    expect(result.getByRole('button', { name: 'Next: Chicago, table 2' })).toBeInTheDocument()

    await userEvent.click(result.getByRole('button', { name: 'Map' }))
    expect(screen.getByRole('button', { name: 'Chicago, table 1, beaten' })).toBeInTheDocument()
    expect(screen.getByText('1 of 3 tables beaten · wins the Lakeshore cue')).toBeInTheDocument()
  })

  it('awards the cue and opens the next city on the third table', async () => {
    saveProgress({ chicago: [true, true, false] })
    show({ ...fresh, breaking: false, winner: YOU })
    await sitDown('Chicago, table 3')
    const result = within(screen.getByRole('region', { name: 'Result' }))
    expect(result.getByText(/You won the/)).toHaveTextContent("You won the Lakeshore cue: shows where the struck ball heads. Chicago's cloth is now yours to use as a theme.")
    expect(result.getByText('Mumbai is open.')).toBeInTheDocument()
    expect(result.getByRole('button', { name: 'Next: Mumbai, table 1' })).toBeInTheDocument()
    expect(screen.getByText('2 of 6 cues won')).toBeInTheDocument()
  })

  it('offers another try after a loss, and records nothing', async () => {
    show({ ...fresh, breaking: false, winner: COMPUTER })
    await sitDown()
    const result = within(screen.getByRole('region', { name: 'Result' }))
    expect(result.getByText('Chicago, table 1 goes to your opponent.')).toBeInTheDocument()
    expect(result.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    await userEvent.click(result.getByRole('button', { name: 'Map' }))
    expect(screen.getByText('0 of 3 tables beaten · wins the Lakeshore cue')).toBeInTheDocument()
  })
})

describe('describeTip', () => {
  it('names a centre strike', () => {
    expect(describeTip({ side: 0, height: 0.03 })).toBe('Centre ball')
  })
  it('names follow and draw', () => {
    expect(describeTip({ side: 0, height: 0.4 })).toBe('High: follow')
    expect(describeTip({ side: 0, height: -0.4 })).toBe('Low: draw')
  })
  it('names side, alone and combined', () => {
    expect(describeTip({ side: -0.3, height: 0 })).toBe('left side')
    expect(describeTip({ side: 0.3, height: -0.3 })).toBe('Low: draw, right side')
  })
})
