import { cueById } from '../game/cues'
import { CITIES, TABLES_PER_CITY, beaten, cityOpen, cityWon, roomBackground } from '../game/ladder'
import type { Fixture, Progress } from '../game/ladder'
import './CityMap.css'

interface Props {
  progress: Progress
  /** One table picture per city, by the city's id. */
  art: Record<string, CanvasImageSource>
  /** The chosen theme: a city's id, or 'own' for each table's own city. */
  theme: string
  onPlay: (fixture: Fixture) => void
  onTheme: (theme: string) => void
  onOpenEverything: () => void
  onStartAgain: () => void
}

/** The ladder: five cities, their tables, and what has been won. */
export function CityMap({ progress, art, theme, onPlay, onTheme, onOpenEverything, onStartAgain }: Props) {
  const won = CITIES.filter((city) => cityWon(progress, city.id))

  return (
    <section className="map" aria-labelledby="map-title">
      <div className="map__head">
        <div>
          <p className="label">The ladder</p>
          <h1 className="section-title" id="map-title">
            Five cities, three tables each
          </h1>
        </div>
        <label className="map__theme">
          <span>Table theme</span>
          <select value={won.some((city) => city.id === theme) ? theme : 'own'} onChange={(event) => onTheme(event.target.value)} disabled={won.length === 0}>
            <option value="own">{won.length === 0 ? 'Win a city to choose' : "Each city's own"}</option>
            {won.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <ol className="map__cities">
        {CITIES.map((city) => {
          const open = cityOpen(progress, city.id)
          const done = cityWon(progress, city.id)
          const picture = art[city.id]
          return (
            <li key={city.id} className={`city ${open ? '' : 'city--shut'}`}>
              <div className="city__room" style={{ background: roomBackground(city) }}>
                {picture instanceof HTMLImageElement && <img src={picture.src} alt="" draggable={false} />}
              </div>
              <div className="city__about">
                <h2 className="city__name">{city.name}</h2>
                <p className="city__look">{city.look}</p>
                <p className="city__state">
                  {done ? `Won · ${cueById(city.cueId).name} cue is yours` : open ? `${beaten(progress, city.id)} of ${TABLES_PER_CITY} tables beaten · wins the ${cueById(city.cueId).name} cue` : 'Win the city before to open'}
                </p>
                <div className="city__tables">
                  {Array.from({ length: TABLES_PER_CITY }, (_, table) => {
                    const beat = progress[city.id]?.[table] === true
                    return (
                      <button
                        key={table}
                        className={`button button--small ${beat ? 'city__table--beaten' : 'button--primary'}`}
                        disabled={!open}
                        onClick={() => onPlay({ cityId: city.id, table })}
                        aria-label={`${city.name}, table ${table + 1}${beat ? ', beaten' : ''}`}
                      >
                        Table {table + 1}
                        {beat && ' ✓'}
                      </button>
                    )
                  })}
                </div>
              </div>
            </li>
          )
        })}
      </ol>

      <p className="map__dev">
        For looking around while the game is being built:{' '}
        <button className="map__link" onClick={onOpenEverything}>
          Open everything
        </button>{' '}
        ·{' '}
        <button className="map__link" onClick={onStartAgain}>
          Start again
        </button>
      </p>
    </section>
  )
}
