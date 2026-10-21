import { CUES } from '../game/cues'
import type { Cue, Rating } from '../game/cues'
import { cityOf } from '../game/ladder'
import './CuePicker.css'

interface Props {
  chosen: Cue
  /** The cues the player has won. The rest are shown but cannot be picked. */
  won: Cue[]
  /** One picture per cue, by the cue's id. */
  art: Record<string, CanvasImageSource>
  onPick: (cue: Cue) => void
}

/** The rack of cues. Pick one to play with. */
export function CuePicker({ chosen, won, art, onPick }: Props) {
  const owned = (cue: Cue) => won.some((mine) => mine.id === cue.id)
  return (
    <section className="cues" aria-labelledby="cues-title">
      <div className="cues__head">
        <p className="label" id="cues-title">
          Cues
        </p>
        <p className="cues__note">
          {won.length} of {CUES.length} won. Beat every table in a city to win its cue.
        </p>
      </div>
      <div className="cues__rack" role="radiogroup" aria-label="Cue">
        {CUES.map((cue) => (
          <button
            key={cue.id}
            role="radio"
            aria-checked={cue.id === chosen.id}
            className={`cue ${cue.id === chosen.id ? 'cue--chosen' : ''} ${owned(cue) ? '' : 'cue--locked'}`}
            disabled={!owned(cue)}
            onClick={() => onPick(cue)}
          >
            <Picture source={art[cue.id]} />
            <span className="cue__name">{cue.name}</span>
            <span className="cue__won">{owned(cue) ? cue.wonIn : `Win ${cityOf(cue)?.name ?? 'its city'} to unlock`}</span>
            <span className="cue__ratings">
              <Bar label="Power" rating={cue.power} />
              <Bar label="Spin" rating={cue.spin} />
              <Bar label="Guide" rating={cue.guide} />
            </span>
            <span className="cue__own">{cue.ownPower || 'No power of its own'}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

/** The cue's picture, when it is one the page can show as an image. */
function Picture({ source }: { source: CanvasImageSource | undefined }) {
  const src = source instanceof HTMLImageElement ? source.src : ''
  return <span className="cue__picture">{src && <img src={src} alt="" draggable={false} />}</span>
}

function Bar({ label, rating }: { label: string; rating: Rating }) {
  return (
    <span className="cue__rating" role="img" aria-label={`${label} ${rating} of 5`}>
      <span className="cue__rating-name">{label}</span>
      <span className="cue__pips" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((pip) => (
          <i key={pip} className={pip <= rating ? 'cue__pip cue__pip--on' : 'cue__pip'} />
        ))}
      </span>
    </span>
  )
}
