#!/bin/sh
# Compiles the table engine to WebAssembly. Run inside the emscripten/emsdk
# image, from the repository root:  wasm/build.sh <output directory>
set -eu

out="${1:?usage: wasm/build.sh <output directory>}"
mkdir -p "$out"

em++ -std=c++23 -O2 -Wall -Wextra -Werror -Iinclude \
  src/table.cpp src/aim.cpp src/rules.cpp src/opponent.cpp wasm/bindings.cpp \
  -lembind \
  -sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=web \
  -sFILESYSTEM=0 -sALLOW_MEMORY_GROWTH=0 \
  -o "$out/engine.js"
