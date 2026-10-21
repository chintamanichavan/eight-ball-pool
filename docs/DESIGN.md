# Engineering design: step 1, one table where the shot feels right

The design of the game itself (screens, cues, cities) is the page in
`docs/design.html`. This file covers how step 1 is built and the numbers we
expect. Measured numbers are filled in as each part is done.

## What step 1 is

One table, a full rack, and a cue. You aim, pull back, pick spin and shoot.
Balls slide, roll, collide, bounce off cushions and drop into pockets. There
are no turns, no rules and no opponent yet.

## The physics, in plain words

- **On the cloth.** A ball that has just been hit slides: the point touching
  the cloth is moving, so friction slows the ball and changes its spin. Once
  that point stops slipping the ball rolls, and only a much smaller drag slows
  it. This one rule gives follow, draw and stop shots without special cases.
- **Ball against ball.** The two balls trade speed along the line between
  their centres. Spin stays with each ball, and the cloth does the rest.
- **Cushions.** A ball keeps part of its speed across the cushion and side
  spin pushes it along the cushion.
- **Pockets.** A cushion ends at each pocket in a hard point (a jaw). A ball
  whose centre passes the line of the cushion face in a gap has dropped.

Time moves in fixed steps of half a millisecond. At the hardest shot (about
9 m/s) a ball moves 4.5 mm per step, well under its 28.6 mm radius, so balls
cannot pass through each other.

## Modules

| Module | Job | Interface |
|---|---|---|
| `pool/table` | The whole table: balls, cloth, cushions, pockets | `rack()`, `strike(shot)`, `advance(seconds, events)`, `balls()`, `moving()` |
| `pool/aim` | Where a shot would go, for the guide lines | `predict(table, angle)` |

The page talks only to these two. It draws and plays sounds; it decides no
physics.

## Numbers: predicted, then measured

| Check | Predicted | Measured |
|---|---|---|
| Rolling distance | speed² ÷ (2 × rolling drag × g). At 0.5 m/s with drag 0.01: 1.274 m (1 m/s would run 5.10 m, longer than the table) | 1.274 m |
| Sliding into rolling | A ball hit dead centre ends up rolling at 5/7 of its starting speed, 0.714 | 0.711 at 0.35 s, after a little rolling drag |
| Stop shot | Straight hit, cue ball still sliding with no spin: it keeps (1 − bounce) ÷ 2 = 2.5% of its speed | 2.5%, to six decimal places |
| Cut shots | The struck ball leaves along the line of centres; the two balls part at close to 90° | Struck ball within 0.01° of the line at 15°, 30°, 45° and 60°. Parting angle 84.7° to 89.2°, not 90°: the cue ball keeps 2.5% of its speed along the line. The prediction was too loose, and the test now uses the exact figure |
| Energy | Never rises during any shot | Never rose in any of 12,400 steps of a hard break |
| Cost of one step | 16 balls: 120 pair checks plus about 300 cushion and jaw checks, about 1 µs. One second of play = 2,000 steps = about 2 ms | 0.72 µs a step, 1.45 ms per second of play |
| Longest shot | A hard break settles in under 15 seconds of table time | 6.2 s, with 171 knocks |
| WebAssembly size | about 30 KB | 34 KB, plus 48 KB of loader script |

One thing the first version got wrong, found by the cut-shot test: a step can
carry two balls a millimetre into each other, and using the line of centres at
that moment bent a 60° cut by 0.7°. Hits are now wound back to the instant of
first touch.

## Known gaps in step 1

- The guide line treats a pocket as cushion: aimed straight into a pocket, it
  shows a bounce.
- A ball vanishes at the mouth of a pocket and a short animation carries it to
  the middle of the hole. Pockets have no depth or rails for a ball to roll
  along.

## Not in step 1

Balls rubbing each other sideways on contact (throw), jump and curve shots,
and the rules of eight-ball. The first two are left out of version 1; the
third is step 2.

---

# Step 2: the rules of eight-ball and a computer opponent

Written before the step 2 code.

## The rules, as played here

- You break. The table is "open" until someone pots a ball on a shot after
  the break. That player takes that ball's group, solids (1 to 7) or stripes
  (9 to 15). The other player gets the other group.
- Pot one of your own balls without a foul and you shoot again. Otherwise the
  turn passes.
- Fouls: the cue ball goes down a pocket; the cue ball hits nothing; or the
  first ball it hits is not one you may hit. While the table is open you may
  hit any ball except the black. Once groups are set you must hit your own
  group first, or the black once your group is gone.
- After a foul the other player has the cue ball in hand and may place it
  anywhere on the cloth.
- The black: pot it after clearing your group, without a foul, and you win.
  Pot it early, or foul on the same shot, and you lose. If it drops on the
  break, the balls are racked again.

Left out for now: calling the pocket for the black, and the rule that some
ball must reach a cushion after contact.

## Modules added

| Module | Job | Interface |
|---|---|---|
| `pool/rules` | Whose turn it is, the groups, fouls, who has won | `ShotLog::note(event)`, `Game::judge(log, table)` |
| `pool/opponent` | Chooses the computer's shot | `start(table, game, skill)`, `think(n)`, `plan()` |

## How the computer chooses a shot

1. **List the shots worth trying.** For each ball it may hit and each pocket:
   work out where the cue ball must touch the ball to send it to that pocket,
   and drop the shot if another ball is in the way or the cut is too thin.
   Each remaining shot is tried at two speeds.
2. **Play each one out** on a copy of the table, with the same physics engine
   the real shot will use, and let the rules judge the result.
3. **Score it.** Winning is best, losing is worst. A pot that keeps the turn
   scores well, more so if it leaves another open shot. A miss scores by how
   few open shots it leaves the other player. A foul scores badly.
4. **Play the best one, imperfectly.** A small random error is added to the
   aim and the speed. That error is the opponent's level: it is the only
   difference between an easy opponent and a hard one.

## Numbers: predicted, then measured

| Check | Predicted | Measured |
|---|---|---|
| Shots tried per decision | up to 7 balls × 6 pockets × 2 speeds, most ruled out by geometry: 10 to 40 | 9 on average. Fewer than predicted: mid-game, most balls have no clear pocket |
| Time to play one shot out | 3 to 6 seconds of table time at 1.45 ms each: 5 to 9 ms | about 3 ms: most shots settle in about 2 seconds of table time |
| Time to decide | under 0.4 s in native code, perhaps twice that in the browser | 28 ms on average, 190 ms at worst, in native code. Not timed in the browser; it is spread over frames there and hidden behind a 0.7 s pause |
| With no error, a planned pot goes in | every time: the plan and the real shot use the same engine | Yes: the straight pot, the cut and the ball-in-hand pot all drop in the tests |
| Share of shots that keep the turn, against aim error | falls smoothly as the error rises | 78% at 0°, 56% at 0.15°, 47% at 0.3°, 37% at 0.6°, 27% at 1.2°, 23% at 2.4° (40 games each, two computers of the same level) |
| A game between two computers | always ends, in under 80 shots | All 240 games ended. 12 shots a game at 0° error, rising to 35 at 2.4° |

The three levels on the page are aim errors of 2.4° (Easy), 1.0° (Club) and
0.3° (Expert). Even with no error the computer keeps the turn only 78% of the
time: some positions have no pot on, and it plays a safety.

## Known gaps in step 2

- The computer plans only straight pots. It does not use spin, bank shots off
  a cushion, or combinations.
- It scores a shot by what it leaves, but does not plan two shots ahead.
- With ball in hand it always sets up a straight pot from 30 cm.

---

# Step 3: six cues and their powers

Written before the step 3 code.

## What a cue changes

A cue changes what the player is able to do. It never changes how the table
behaves. Each cue has three ratings from 1 to 5, and all but the first have
one power of their own.

| Rating | What it sets | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|
| Power | Top speed of the cue ball, m/s | 6.4 | 7.3 | 8.2 | 9.1 | 10.0 |
| Spin | How far from centre the tip may strike, in ball radii | 0.37 | 0.44 | 0.51 | 0.58 | 0.65 |
| Guide | How far the guide follows each ball after the hit, m | 0.05 | 0.10 | 0.22 | 0.40 | 0.70 |

| Cue | Power | Spin | Guide | Its own power |
|---|---|---|---|---|
| House | 2 | 2 | 2 | None |
| Lakeshore | 3 | 2 | 3 | The struck ball's line is drawn 0.8 m long |
| Monsoon | 3 | 4 | 3 | The cue ball's path after the hit is drawn 0.8 m long, spin included |
| Neon | 4 | 3 | 4 | The guide follows one bounce off a cushion before the hit |
| Atlas | 5 | 3 | 3 | The break shot is a fifth faster |
| Aurora | 5 | 5 | 5 | The struck ball's whole path is drawn, into the pocket or to where it stops |

In this step all six cues can be picked freely, so each can be tried. Winning
them city by city is step 4. The choice is saved in the browser.

## One mechanism for every guide line

Until now the guide was geometry: a straight line to the first ball, then two
short straight lines. That cannot show spin, a cushion bounce or a full path.

So the guide becomes a **preview**: the engine plays the shot out on a copy of
the table and reports three paths: the cue ball before the hit, the cue ball
after it, and the struck ball. The page draws as much of each path as the cue
allows. Every cue uses the same preview; a better cue only shows more of it.
A weak cue's short lines are now exact too, bent by spin when there is spin.

| Module | Change |
|---|---|
| `pool/aim` | adds `preview(table, shot, bounces, seconds)` |

## Numbers: predicted, then measured

| Check | Predicted | Measured |
|---|---|---|
| Cost of one preview | about 2 seconds of table time for most cues: 3 ms. Aurora follows the ball to rest, up to 6 seconds: 9 ms | 2.4 ms for 2 seconds; 4.3 ms to rest, for a medium shot into the full pack. In the browser the page held 60 frames a second with every cue while the aim moved each frame |
| The preview against the shot | identical: same engine, same inputs | Final positions of both balls agree to nine decimal places, with spin on |
| Wasm size | about 55 KB | 52 KB |

The guide is worked out again only when the shot it shows has changed: the
aim, the pull, the strike point, the cue, or where the cue ball lies.

## Known gaps in step 3

- While the cue is at rest the guide assumes a medium pull. It updates as soon
  as the cue is drawn back.
- The computer still plays with the house cue. Its cues come with the cities.
- The six cue pictures differed in colour only. (Fixed after step 4: each now has its own spears, inlays or glow.)

---

# Step 4: five cities

Written before the step 4 code.

## What a city is

Five cities, in order. Each has three tables, and each table is one game
against that table's player.

| City | Cloth | Room | Cue won there | Aim error at tables 1, 2, 3 |
|---|---|---|---|---|
| Chicago | classic green | lakefront at dusk, slate blue | Lakeshore | 2.6°, 2.2°, 1.9° |
| Mumbai | sea green | monsoon evening, warm grey | Monsoon | 1.6°, 1.4°, 1.2° |
| Tokyo | indigo | neon night, near black with magenta | Neon | 1.0°, 0.85°, 0.7° |
| Marrakech | brick red | tiled courtyard, sand | Atlas | 0.55°, 0.45°, 0.38° |
| Reykjavik | slate blue | northern lights over deep navy | Aurora | 0.3°, 0.22°, 0.15° |

- Chicago is open from the start. Beating all three tables of a city wins its
  cue and opens the next city. Tables can be played in any order and replayed.
- A city's players carry that city's cue. For the computer a cue sets one
  thing, its break speed, because it needs no guide and plans its own pace.
- Once a city is won, its cloth and room can be chosen as the theme for any
  table. Until then a table is shown in its own city's cloth.

## Screens

- **Map.** The five cities with their progress. Pick a table to play.
- **Table.** The match, as before, in the city's cloth and room.
- **Result.** A card over the top of the table when the game ends: who won,
  what was won, and where to go next.

## What is saved

One small record in the browser: how many tables are beaten in each city, the
chosen cue, and the chosen theme. No account and no server. Clearing the
browser's data starts the ladder again.

For now the map has two plain links at the bottom, "Open everything" and
"Start again", so the whole ladder can be seen without winning fifteen games.

## Modules

| Module | Change |
|---|---|
| `pool/opponent` | `Skill` gains a break speed |
| page: `game/ladder` | The cities, the tables, progress, and what a win unlocks |

## Numbers: predicted, then measured

| Check | Predicted | Measured |
|---|---|---|
| Share of shots that keep the turn, first table to last | from the step 2 curve: about 22% at 2.6° rising to about 56% at 0.15° | 20% at 2.6° and 56% at 0.15° (40 games each, two players of that level, pace error fixed at 4%) |
| Table pictures | five at about 110 KB each | 113 to 115 KB each |

## Known gaps in step 4

- A city's room is a colour wash with lamplight over the table, not a picture.
- The three tables of a city differ only in how well the player aims.
- For the computer, a cue only sets its break speed.
- Fifteen wins is a long ladder to test by hand, so the map has "Open
  everything" and "Start again" links. They should go before anyone else plays.

## After step 4: the look

No new rules or screens. The Blender models gained what makes them read as
the real things: cloth with a nap, wood with grain, a leather lip round each
pocket, pearl sights on the rails, and a different design for each cue
(spears on the forearm, then rings, dashes, a glowing stripe, diamonds, or a
handle that shades from ice to blue).
