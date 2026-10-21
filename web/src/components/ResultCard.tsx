import { cityById } from '../game/ladder'
import type { Fixture, Reward } from '../game/ladder'
import './ResultCard.css'

interface Props {
  fixture: Fixture
  youWon: boolean
  /** What the win unlocked. Null after a loss. */
  reward: Reward | null
  /** The next unbeaten table, or null when there is none to offer. */
  next: Fixture | null
  onPlay: (fixture: Fixture) => void
  onMap: () => void
}

/** Shown when a game ends: who won, what was won, and where to go next. */
export function ResultCard({ fixture, youWon, reward, next, onPlay, onMap }: Props) {
  const city = cityById(fixture.cityId)
  const where = `${city.name}, table ${fixture.table + 1}`

  return (
    <section className={`result ${youWon ? 'result--won' : ''}`} aria-label="Result" aria-live="polite">
      <div>
        <p className="label">{youWon ? 'You won' : 'You lost'}</p>
        <h2 className="section-title">{youWon ? `${where} is beaten.` : `${where} goes to your opponent.`}</h2>
        {reward?.cue && (
          <p className="result__reward">
            You won the <b>{reward.cue.name}</b> cue: {reward.cue.ownPower.toLowerCase()}. {city.name}'s cloth is now yours to use as a theme.
          </p>
        )}
        {reward?.opened && <p className="result__reward">{reward.opened.name} is open.</p>}
        {reward?.ladderDone && <p className="result__reward">That was the last table of the last city. The ladder is yours.</p>}
      </div>
      <div className="result__buttons">
        {youWon && next && (
          <button className="button button--primary" onClick={() => onPlay(next)}>
            Next: {cityById(next.cityId).name}, table {next.table + 1}
          </button>
        )}
        <button className={`button ${youWon ? '' : 'button--primary'}`} onClick={() => onPlay(fixture)}>
          {youWon ? 'Play it again' : 'Try again'}
        </button>
        <button className="button" onClick={onMap}>
          Map
        </button>
      </div>
    </section>
  )
}
