import { useCallback, useRef, useState } from 'react'
import { CityMap } from './components/CityMap'
import { MatchView } from './components/MatchView'
import { ResultCard } from './components/ResultCard'
import type { Engine } from './engine/engine'
import { EVERYTHING, NO_PROGRESS, cuesWon, loadProgress, loadTheme, nextFixture, opponentFor, recordWin, saveProgress, saveTheme, themeFor } from './game/ladder'
import type { Fixture, Progress, Reward } from './game/ladder'
import type { Art } from './render/scene'
import './App.css'

interface Props {
  engine: Engine
  art: Art
}

/** A game that has ended, and what it brought. */
interface Result {
  youWon: boolean
  reward: Reward | null
}

export function App({ engine, art }: Props) {
  const [progress, setProgress] = useState<Progress>(loadProgress)
  const [theme, setTheme] = useState(loadTheme)
  /** The table being played, or null while the map is showing. */
  const [fixture, setFixture] = useState<Fixture | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  /** Counts games started, so playing the same table again racks a fresh one. */
  const [game, setGame] = useState(0)

  // The game's end is reported from inside the frame loop, which must not be
  // rebuilt every time progress changes. It reads the latest progress from here.
  const latest = useRef(progress)
  latest.current = progress

  const keep = (next: Progress) => {
    setProgress(next)
    saveProgress(next)
  }

  const play = (next: Fixture) => {
    setFixture(next)
    setResult(null)
    setGame((count) => count + 1)
    window.scrollTo({ top: 0 })
  }

  const over = useCallback(
    (youWon: boolean) => {
      if (!fixture) return
      if (!youWon) {
        setResult({ youWon, reward: null })
        return
      }
      const { progress: after, reward } = recordWin(latest.current, fixture)
      setProgress(after)
      saveProgress(after)
      setResult({ youWon, reward })
    },
    [fixture],
  )

  const toMap = useCallback(() => {
    setFixture(null)
    setResult(null)
  }, [])

  return (
    <>
      <header className="topbar">
        <div className="topbar__inner">
          <p className="topbar__name">Eight Ball</p>
          <p className="topbar__step">{cuesWon(progress).length} of 6 cues won</p>
        </div>
      </header>

      <main className="page">
        {fixture === null ? (
          <CityMap
            progress={progress}
            art={art.tables}
            theme={theme}
            onPlay={play}
            onTheme={(next) => {
              setTheme(next)
              saveTheme(next)
            }}
            onOpenEverything={() => keep(EVERYTHING)}
            onStartAgain={() => keep(NO_PROGRESS)}
          />
        ) : (
          <>
            {result && <ResultCard fixture={fixture} youWon={result.youWon} reward={result.reward} next={nextFixture(progress)} onPlay={play} onMap={toMap} />}
            <MatchView
              key={game}
              engine={engine}
              art={art}
              fixture={fixture}
              opponent={opponentFor(fixture)}
              theme={themeFor(progress, theme, fixture)}
              cues={cuesWon(progress)}
              onOver={over}
              onLeave={toMap}
            />
          </>
        )}

        <section className="about">
          <p className="label">How to play</p>
          <h2 className="section-title">Eight-ball, city by city</h2>
          <p>
            You break. The first ball potted after the break decides who has solids (1 to 7) and who has stripes (9 to
            15). Pot one of yours and you shoot again. Clear your group, then pot the black to win.
          </p>
          <p>
            A foul gives the other player the cue ball in hand. It is a foul to pot the cue ball, to hit nothing, or to
            hit a ball that is not yours first: the ring at the end of the guide turns red to warn you. Pot the black
            early and you lose.
          </p>
          <p>
            Beat all three tables in a city to win its cue and open the next city. A city you have won lends its cloth
            to any table, from the theme list on the map. Your progress is kept in this browser only.
          </p>
        </section>
      </main>
    </>
  )
}
