// Turns the rules' rulings into plain words.

import { COMPUTER, NO_FOUL, NO_HIT, OPEN, SCRATCH, SOLIDS, YOU } from '../engine/engine'
import type { Group, Player, Status, Verdict } from '../engine/engine'
import type { Cue } from './cues'

export function groupName(group: Group): string {
  if (group === OPEN) return 'Open table'
  return group === SOLIDS ? 'Solids' : 'Stripes'
}

/** What a player has left to do, for the line under their name. */
export function task(group: Group, left: number): string {
  if (group === OPEN) return 'Open table'
  if (left === 0) return `${groupName(group)} · on the black`
  return `${groupName(group)} · ${left} left`
}

const other = (player: Player): Player => (player === YOU ? COMPUTER : YOU)

/** One or two short sentences on the shot `shooter` just played. */
export function ruling(verdict: Verdict, shooter: Player): string {
  const you = shooter === YOU

  if (verdict.winner !== -1) {
    if (verdict.winner === shooter) return you ? 'You potted the black. You win.' : 'The computer potted the black and wins.'
    const how = verdict.foul === NO_FOUL ? 'too early' : 'with a foul'
    return you ? `You potted the black ${how}. The computer wins.` : `The computer potted the black ${how}. You win.`
  }
  if (verdict.rerack) return 'The black went in on the break. The balls are racked again.'

  if (verdict.foul !== NO_FOUL) {
    const who = you ? 'You' : 'The computer'
    const what = verdict.foul === SCRATCH ? 'potted the cue ball' : verdict.foul === NO_HIT ? 'hit nothing' : 'hit the wrong ball first'
    const next = other(shooter) === YOU ? 'You have' : 'The computer has'
    return `Foul: ${who.toLowerCase()} ${what}. ${next} the cue ball in hand.`
  }
  if (!verdict.turnPasses) return you ? 'Good pot. Shoot again.' : 'The computer potted and shoots again.'
  return you ? "No pot. The computer's turn." : 'The computer missed. Your turn.'
}

/** What the player should do now, for the status line. */
export function prompt(status: Status, cue: Cue): string {
  if (status.winner !== -1) return status.winner === YOU ? 'You won' : 'The computer won'
  if (status.player === COMPUTER) return 'Your opponent is at the table'
  if (status.ballInHand) return 'Cue ball in hand: put it anywhere, then click'
  return status.breaking ? `Your break · ${cue.name} cue` : `Your shot · ${cue.name} cue`
}
