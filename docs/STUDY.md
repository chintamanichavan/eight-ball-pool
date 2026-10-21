# How many degrees of aim is thinking worth?

The question, method and predictions below were written before any measuring
and are left as written. What was measured follows them, from
[Measured](#measured) on.

## The question

The computer opponent does two things: it chooses a shot, and it plays it with
some error in the aim. The error is what the page calls its level (Easy 2.4°,
Club 1.0°, Expert 0.3°). How much of the opponent's strength comes from the
choosing? Put as one number: how much worse can a player that thinks ahead
aim, and still beat a player that does not?

## Three ways to choose a shot

All three see the same straight pots (`for_each_pot` in `src/opponent.cpp`),
fall back to rolling up to a legal ball when no pot is on, and set the cue
ball up the same way with ball in hand. They differ only in how they pick:

| Mind | How it picks |
|---|---|
| **Geometry** | the fullest straight pot (the smallest cut), at the planned speed. It never plays a shot out, so it cannot see a scratch, a foul or a kiss coming. With no pot on, it rolls up to the nearest legal ball. |
| **Physics** | plays every candidate out on a copy of the table with the real physics, and keeps the one that wins, pots and keeps the turn, or at worst does not foul. It ignores what the shot leaves. |
| **Position** | the opponent as built: Physics, plus it scores a pot by how many pots it leaves itself and a miss by how few it leaves the other player. |

## How it is measured

Two computers play whole games of eight-ball with the game's own rules. The
two take turns breaking. Every pairing is 1,000 games, and a win rate is given
with its 95% interval (about ±3 points at 1,000 games). Speed error is 4% for
all players, as on the page.

1. **Round robin at the same aim.** Each mind against each other, at 1.0°
   (Club).
2. **The exchange rate.** Position, at an aim error of 1.0° and then worse,
   against Physics and against Geometry held at 1.0°. Where Position's win rate
   crosses 50% is what its thinking is worth, in degrees.
3. **The page's levels.** Expert against Club, and Club against Easy, all with
   the Position mind: are the three levels far enough apart to feel different?

## Predicted, before measuring

| Measure | Predicted |
|---|---|
| Physics against Geometry, both at 1.0° | Physics wins 65–75%: Geometry scratches and fouls, and hands over ball in hand |
| Position against Physics, both at 1.0° | Position wins 55–65% |
| Position against Geometry, both at 1.0° | Position wins 70–80% |
| Aim Position can give away and still break even with Physics | about 0.5° (crossing near 1.5°) |
| ... and with Geometry | about 1.5° (crossing near 2.5°) |
| Expert (0.3°) against Club (1.0°) | Expert wins 70–80% |
| Club (1.0°) against Easy (2.4°) | Club wins 75–85% |

## Not in scope

Spin, banks, combinations and planning two shots ahead: none of the three
minds uses them (see the known gaps in `DESIGN.md`). And people: no human
games are measured, so nothing here says how the levels compare with real
players.

---

## Status (2026-10-15)

Paused before measuring, when work moved to the Innings project. Done so far:
the three minds exist (`Mind` in `include/pool/opponent.hpp`; the game still
uses Position, unchanged), and a probe found a table where Geometry scratches
and Physics does not (cue ball 0.5 m behind a ball dead straight to a corner
pocket). Not yet done: a test for that, the tournament tool, the runs.
