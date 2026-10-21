# 8-Ball Pool Game

A pool game that runs in the browser on its own physics engine.

A full game: a ladder of five cities with three tables each, a computer
opponent that gets better city by city, six cues with different ratings and
powers to win, and a cloth and room for every city. Progress is kept in the
browser; there is no account and no server.

- The design of the game: [docs/design.html](docs/design.html)
- How each step is built, with predicted and measured numbers: [docs/DESIGN.md](docs/DESIGN.md)

## What is here

| Path | What it is |
|---|---|
| `include/pool/table.hpp`, `src/table.cpp` | The table: balls, cloth, cushions and pockets |
| `include/pool/aim.hpp`, `src/aim.cpp` | Where a shot would go, for the guide lines |
| `include/pool/rules.hpp`, `src/rules.cpp` | The rules of eight-ball: turns, groups, fouls, the winner |
| `include/pool/opponent.hpp`, `src/opponent.cpp` | The computer's player: tries shots on a copy of the table and keeps the best |
| `tools/measure.cpp` | Prints the measured numbers in the design doc |
| `wasm/` | The browser's view of the engine, and its build script |
| `web/` | The page (React and TypeScript, drawn on a canvas). `web/src/game/ladder.ts` holds the cities and progress; `cues.ts` the cues |
| `blender/` | `art.py` renders the table and cue; `concept.py` holds the shared models and the design page's pictures |
| `tests/` | C++ tests; the page's tests sit beside its code |

## Run it

```sh
docker compose up -d --build     # http://localhost:5180
```

The build runs every test, compiles the engine to WebAssembly and builds the
page.

## Work on it

The engine:

```sh
cmake -S . -B build -G Ninja && cmake --build build && ctest --test-dir build
./build/measure
```

The browser build of the engine (needs Docker, not a local Emscripten):

```sh
docker run --rm -u "$(id -u):$(id -g)" -v "$PWD":/src -w /src \
  emscripten/emsdk:4.0.10 wasm/build.sh web/src/engine/wasm
```

The page, once that has written its files:

```sh
cd web && npm install
npm test
npm run dev
```

The art (needs Blender 4.5):

```sh
blender -b --factory-startup -P blender/art.py
```
