import { useCallback, useEffect, useRef, useState } from 'react'
import { Sounds } from '../audio/sounds'
import { BALLS, BALL_HIT, COMPUTER, CUE_BALL, CUSHION_HIT, FIELDS, ON_TABLE, POCKETED, ROLL_SPIN_X, ROLL_SPIN_Y, SIDE_SPIN, X, Y, YOU } from '../engine/engine'
import type { Engine, Player, Preview, Status } from '../engine/engine'
import { saveCue, savedCue } from '../game/cues'
import type { Cue } from '../game/cues'
import { cityById, roomBackground } from '../game/ladder'
import type { City, Fixture, Opponent } from '../game/ladder'
import { CENTRE, RESTING_PULL, SMALLEST_SHOT, clampTip, powerFor, powerFromPull, speedFor } from '../game/shot'
import type { Tip } from '../game/shot'
import { toMetres, viewFor } from '../game/view'
import type { View } from '../game/view'
import { prompt, ruling, task } from '../game/words'
import { turn, upright } from '../render/balls'
import type { Orientation } from '../render/balls'
import { DROP_SECONDS, FULL_PULL, Scene } from '../render/scene'
import type { Art, Drop } from '../render/scene'
import { CuePicker } from './CuePicker'
import { PowerBar } from './PowerBar'
import { SpinPicker } from './SpinPicker'
import './MatchView.css'

interface Props {
  engine: Engine
  art: Art
  /** The table being played, and the player it is against. */
  fixture: Fixture
  opponent: Opponent
  /** The city whose cloth and room the table is shown in. */
  theme: City
  /** The cues the player has won and may use. */
  cues: Cue[]
  /** Called once when the game ends. */
  onOver: (youWon: boolean) => void
  onLeave: () => void
}

/** How long the cue takes to travel from its pulled position to the ball. */
const STRIKE_SECONDS = 0.07
/** One press of an arrow key turns the aim by this much; Shift turns it faster. */
const FINE_TURN = (0.25 * Math.PI) / 180
/** A frame longer than this is a stalled tab, not time the table should replay. */
const LONGEST_FRAME = 0.05
/** The computer never shoots sooner than this, however fast it decides. */
const SHORTEST_THINK = 0.7
/** How long the computer takes to swing its cue round, then to draw it back. */
const SWING_SECONDS = 0.55
const DRAW_SECONDS = 0.45

/** How long the guide follows the balls after the hit: to rest for a cue that shows it all, else a short while. */
const SHORT_PREVIEW = 2
const FULL_PREVIEW = 30

/**
 * aiming    the person lines up a shot
 * placing   the person has the cue ball in hand and is moving it
 * thinking  the computer is choosing a shot
 * showing   the computer swings its cue round and draws it back
 * striking  a cue is travelling forward to the ball
 * rolling   balls are moving
 * over      someone has won
 */
type Phase = 'aiming' | 'placing' | 'thinking' | 'showing' | 'striking' | 'rolling' | 'over'

/**
 * Everything that changes many times a second lives here, outside React, so a
 * moving ball never causes a re-render.
 */
interface Live {
  phase: Phase
  shooter: Player
  angle: number
  pull: number
  /** Where a table drag started, in canvas pixels, while the cue is being pulled. */
  pullFrom: [number, number] | null
  tip: Tip
  /** The shot the cue is on its way to play. */
  speed: number
  strikePull: number
  /** Seconds left in the current phase, for the phases that run on a clock. */
  clock: number
  /** The computer's shot: where its cue swings from and to, and how far it draws back. */
  swingFrom: number
  swingTo: number
  drawTo: number
  view: View
  turns: Orientation[]
  drops: Drop[]
  /** The cue the person is playing with. */
  cue: Cue
  breaking: boolean
  /** The last guide worked out, and the shot it was worked out for. */
  preview: Preview | null
  previewFor: string
}

/** The shortest way round from one angle to another. */
function swing(from: number, to: number, share: number): number {
  const turnBy = Math.atan2(Math.sin(to - from), Math.cos(to - from))
  return from + turnBy * share
}

/** A match of eight-ball against the computer. */
export function MatchView({ engine, art, fixture, opponent, theme, cues, onOver, onLeave }: Props) {
  const { match, sizes } = engine
  const city = cityById(fixture.cityId)
  // A saved cue the player has not won here (after starting again, say) falls back to the first they have.
  const startingCue = () => cues.find((owned) => owned.id === savedCue().id) ?? cues[0]!
  const canvas = useRef<HTMLCanvasElement>(null)
  const sounds = useRef(new Sounds())
  const live = useRef<Live>({
    phase: 'aiming',
    shooter: YOU,
    angle: 0,
    pull: 0,
    pullFrom: null,
    tip: CENTRE,
    speed: 0,
    strikePull: 0,
    clock: 0,
    swingFrom: 0,
    swingTo: 0,
    drawTo: 0,
    view: viewFor(960),
    turns: Array.from({ length: BALLS }, upright),
    drops: [],
    cue: startingCue(),
    breaking: true,
    preview: null,
    previewFor: '',
  })

  // What the controls around the table show.
  const [status, setStatus] = useState<Status>(() => match.status())
  const [message, setMessage] = useState('You break.')
  const [power, setPower] = useState(0)
  const [tip, setTip] = useState<Tip>(CENTRE)
  const [busy, setBusy] = useState(false)
  const [muted, setMuted] = useState(false)
  const [cue, setCue] = useState<Cue>(() => live.current.cue)

  const setPull = useCallback((pull: number) => {
    live.current.pull = pull
    setPower(pull)
  }, [])

  const chooseTip = useCallback((next: Tip) => {
    live.current.tip = next
    setTip(next)
  }, [])

  /** Hands the table to whoever shoots next. */
  const beginTurn = useCallback(() => {
    const now = live.current
    const next = match.status()
    setStatus(next)
    now.pull = 0
    now.breaking = next.breaking
    now.previewFor = '' // the balls have moved: the old guide no longer holds
    setPower(0)
    chooseTip(CENTRE)

    if (next.winner !== -1) {
      now.phase = 'over'
      setBusy(true)
      onOver(next.winner === YOU)
      return
    }
    // A cue ball that went down a pocket comes back on the head spot, or the
    // nearest free cloth to it, for the player to move.
    if (!match.state()[CUE_BALL * FIELDS + ON_TABLE]) {
      for (let back = 0; back < 40 && !match.placeCueBall(-sizes.length / 4 - back * sizes.ballRadius, 0); back++);
    }
    now.shooter = next.player
    if (next.player === YOU) {
      now.phase = next.ballInHand ? 'placing' : 'aiming'
      setBusy(false)
    } else {
      now.phase = 'thinking'
      now.clock = SHORTEST_THINK
      setBusy(true)
    }
  }, [match, sizes, chooseTip, onOver])

  const newMatch = useCallback(() => {
    match.start(opponent.aimErrorDegrees, opponent.speedError, opponent.breakSpeed, Math.floor(Math.random() * 2 ** 31))
    const now = live.current
    now.angle = 0
    now.turns = Array.from({ length: BALLS }, upright)
    now.drops = []
    setMessage('You break.')
    beginTurn()
  }, [match, opponent, beginTurn])

  // Rack the game once, when the table appears.
  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    newMatch()
  }, [newMatch])

  /** Lets go of the cue: it runs forward, and strikes when it reaches the ball. */
  const release = useCallback(() => {
    const now = live.current
    now.pullFrom = null
    if (now.phase !== 'aiming') return
    if (now.pull < SMALLEST_SHOT) {
      setPull(0)
      return
    }
    now.phase = 'striking'
    now.clock = STRIKE_SECONDS
    now.strikePull = now.pull
    now.speed = speedFor(now.pull, now.cue, now.breaking)
    setBusy(true)
  }, [setPull])

  // The frame loop: move the match forward, play what happened, draw.
  useEffect(() => {
    const element = canvas.current
    const ctx = element?.getContext('2d')
    if (!element || !ctx) return

    const scene = new Scene(art, sizes)
    scene.cloth = theme.id
    let density = 1
    const resize = () => {
      const width = element.clientWidth
      if (width === 0) return
      density = window.devicePixelRatio || 1
      live.current.view = viewFor(width)
      element.width = Math.round(width * density)
      element.height = Math.round((width * density * 9) / 16)
    }
    resize()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize)
    observer?.observe(element)

    /** One frame of whichever phase the match is in. */
    const advance = (now: Live, dt: number) => {
      switch (now.phase) {
        case 'thinking': {
          now.clock -= dt
          const decided = match.think(3)
          if (!decided || now.clock > 0) return
          const plan = match.computerPlan()
          if (plan.place) match.placeCueBall(plan.x, plan.y)
          match.confirmPlacement()
          now.swingFrom = now.angle
          now.swingTo = plan.angle
          now.speed = plan.speed
          now.drawTo = powerFor(plan.speed, opponent.cue)
          now.tip = CENTRE
          now.phase = 'showing'
          now.clock = SWING_SECONDS + DRAW_SECONDS
          return
        }
        case 'showing': {
          now.clock -= dt
          const swung = Math.min(1, (SWING_SECONDS + DRAW_SECONDS - now.clock) / SWING_SECONDS)
          const drawn = Math.min(1, Math.max(0, (DRAW_SECONDS - now.clock) / DRAW_SECONDS))
          now.angle = swing(now.swingFrom, now.swingTo, swung * swung * (3 - 2 * swung))
          now.pull = now.drawTo * drawn
          if (now.clock > 0) return
          now.phase = 'striking'
          now.clock = STRIKE_SECONDS
          now.strikePull = now.drawTo
          return
        }
        case 'striking': {
          now.clock -= dt
          now.pull = now.strikePull * Math.max(0, now.clock / STRIKE_SECONDS)
          if (now.clock > 0) return
          match.strike(now.angle, now.speed, now.tip.side, now.tip.height)
          sounds.current.cueHit(now.speed)
          now.phase = 'rolling'
          now.pull = 0
          setPower(0)
          return
        }
        case 'rolling': {
          for (const event of match.advance(dt)) {
            if (event.kind === BALL_HIT) sounds.current.ballHit(event.strength)
            else if (event.kind === CUSHION_HIT) sounds.current.cushionHit(event.strength)
            else if (event.kind === POCKETED) {
              sounds.current.pocketed()
              const at = event.ball * FIELDS
              const where = match.state()
              now.drops.push({ ball: event.ball, x: where[at + X]!, y: where[at + Y]!, progress: 0 })
            }
          }
          if (match.moving()) return
          const verdict = match.finishShot()
          setMessage(ruling(verdict, now.shooter))
          if (verdict.rerack) now.turns = Array.from({ length: BALLS }, upright)
          beginTurn()
          return
        }
        default:
          return
      }
    }

    let frame = 0
    let last = performance.now()
    const tick = (time: number) => {
      const dt = Math.min((time - last) / 1000, LONGEST_FRAME)
      last = time
      const now = live.current
      advance(now, dt)

      for (const drop of now.drops) drop.progress += dt / DROP_SECONDS
      now.drops = now.drops.filter((drop) => drop.progress < 1)

      const state = match.state()
      for (let ball = 0; ball < BALLS; ball++) {
        const at = ball * FIELDS
        turn(now.turns[ball]!, state[at + ROLL_SPIN_X]!, state[at + ROLL_SPIN_Y]!, state[at + SIDE_SPIN]!, dt)
      }

      // The cue shows while someone is lining up or striking. Only the person gets guide lines.
      const cueShown = now.phase === 'aiming' || now.phase === 'showing' || now.phase === 'striking'
      const yours = now.shooter === YOU
      if (now.phase === 'aiming') {
        // Work the guide out again only when the shot it shows has changed.
        const speed = speedFor(now.pull > 0 ? now.pull : RESTING_PULL, now.cue, now.breaking)
        const shot = [now.angle, speed, now.tip.side, now.tip.height, now.cue.id, state[X], state[Y]].join()
        if (shot !== now.previewFor) {
          const seconds = now.cue.followsToRest ? FULL_PREVIEW : SHORT_PREVIEW
          now.preview = match.preview(now.angle, speed, now.tip.side, now.tip.height, now.cue.bounces, seconds)
          now.previewFor = shot
        }
      }
      const guided = now.phase === 'aiming' || (now.phase === 'striking' && yours)
      const aiming = cueShown ? { angle: now.angle, pull: now.pull, preview: guided ? now.preview : null, cue: yours ? now.cue : opponent.cue } : null

      ctx.setTransform(density, 0, 0, density, 0, 0)
      scene.draw(ctx, now.view, density, state, now.turns, aiming, now.drops, now.phase === 'placing')
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
      observer?.disconnect()
    }
  }, [match, sizes, art, theme, opponent, beginTurn])

  // Arrow keys nudge the aim: the mouse gets close, the keys get exact.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      if (live.current.phase !== 'aiming') return
      const step = FINE_TURN * (event.shiftKey ? 4 : 1)
      live.current.angle += event.key === 'ArrowLeft' ? step : -step
      event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /** The pointer's place on the canvas, in CSS pixels. */
  const pointerAt = (event: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const box = event.currentTarget.getBoundingClientRect()
    return [event.clientX - box.left, event.clientY - box.top]
  }

  /** Points the cue from the cue ball towards the pointer. */
  const aimAt = (px: number, py: number) => {
    const state = match.state()
    const [x, y] = toMetres(live.current.view, px, py)
    const dx = x - state[X]!
    const dy = y - state[Y]!
    if (Math.hypot(dx, dy) > sizes.ballRadius) live.current.angle = Math.atan2(dy, dx)
  }

  /** Moves the cue ball under the pointer, if the rules and the other balls allow. */
  const carryTo = (px: number, py: number) => {
    const [x, y] = toMetres(live.current.view, px, py)
    match.placeCueBall(x, y)
  }

  const putDown = () => {
    match.confirmPlacement()
    live.current.phase = 'aiming'
    setStatus(match.status())
  }

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    sounds.current.wake()
    const now = live.current
    const at = pointerAt(event)
    if (now.phase === 'placing') {
      carryTo(...at)
      if (event.pointerType === 'mouse') putDown() // a finger puts it down by lifting
      else event.currentTarget.setPointerCapture(event.pointerId)
      return
    }
    if (now.phase !== 'aiming') return
    event.currentTarget.setPointerCapture(event.pointerId)
    if (event.pointerType === 'mouse') now.pullFrom = at
    else aimAt(...at) // a finger aims; the power bar pulls
  }

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const now = live.current
    const [px, py] = pointerAt(event)
    if (now.phase === 'placing') {
      if (event.pointerType === 'mouse' || event.buttons !== 0) carryTo(px, py)
      return
    }
    if (now.phase !== 'aiming') return

    if (now.pullFrom) {
      // Dragging away from the aim draws the cue back along its own line.
      const back = (now.pullFrom[0] - px) * Math.cos(now.angle) - (now.pullFrom[1] - py) * Math.sin(now.angle)
      setPull(powerFromPull(back, FULL_PULL * now.view.scale))
    } else if (event.pointerType === 'mouse' || event.buttons !== 0) {
      aimAt(px, py)
    }
  }

  const onPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (live.current.phase === 'placing' && event.pointerType !== 'mouse') putDown()
    else release()
  }

  const pickCue = (next: Cue) => {
    live.current.cue = next
    saveCue(next)
    setCue(next)
    // A cue with less spin cannot keep a strike point only a better one reaches.
    chooseTip(clampTip(live.current.tip.side, live.current.tip.height, next))
  }

  const yourTurn = status.winner === -1 && status.player === YOU
  const theirTurn = status.winner === -1 && status.player === COMPUTER

  return (
    <section className="match" aria-label="Pool table">
      <header className="match__head">
        <div className={`match__player ${yourTurn ? 'match__player--turn' : ''}`}>
          <p className="match__name">You</p>
          <p className="match__task">{task(status.yourGroup, status.yourLeft)}</p>
        </div>
        <div className="match__middle">
          <p className="label">{prompt(status, cue)}</p>
          <p className="match__message" aria-live="polite">
            {message}
          </p>
        </div>
        <div className={`match__player match__player--them ${theirTurn ? 'match__player--turn' : ''}`}>
          <p className="match__name">
            {city.name} · table {fixture.table + 1}
          </p>
          <p className="match__task">{task(status.computerGroup, status.computerLeft)}</p>
        </div>
      </header>

      <canvas
        ref={canvas}
        className="match__canvas"
        style={{ background: roomBackground(theme) }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          live.current.pullFrom = null
          setPull(0)
        }}
      />

      <footer className="match__controls">
        <PowerBar power={power} disabled={busy || status.ballInHand} onPull={setPull} onRelease={release} />
        <SpinPicker tip={tip} cue={cue} onChange={chooseTip} />
        <div className="match__buttons">
          <button className="button button--small" onClick={onLeave}>
            Map
          </button>
          <button
            className="button button--small"
            onClick={() => {
              sounds.current.muted = !muted
              setMuted(!muted)
            }}
          >
            {muted ? 'Sound off' : 'Sound on'}
          </button>
          <button className="button button--small" onClick={newMatch}>
            Rack again
          </button>
        </div>
      </footer>
      <p className="match__hint match__hint--mouse">
        Move to aim. Press and drag back to pull the cue. Let go to shoot. <kbd>←</kbd> <kbd>→</kbd> for a fine aim.
      </p>
      <p className="match__hint match__hint--touch">Touch the table to aim. Drag along the power bar and let go to shoot.</p>

      <CuePicker chosen={cue} won={cues} art={art.cues} onPick={pickCue} />
    </section>
  )
}
