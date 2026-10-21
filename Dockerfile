# One build, four steps: test the engine, compile it for the browser, build
# the page, serve it.

# 1. Build the C++ and run its tests.
FROM gcc:15 AS engine-tests
RUN apt-get update && apt-get install -y --no-install-recommends cmake ninja-build git \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /src
COPY CMakeLists.txt ./
COPY include include
COPY src src
COPY tests tests
COPY tools tools
RUN cmake -S . -B build -G Ninja && cmake --build build && ctest --test-dir build --output-on-failure

# 2. Compile the engine to WebAssembly.
FROM emscripten/emsdk:4.0.10 AS engine
WORKDIR /src
COPY include include
COPY src src
COPY wasm wasm
RUN wasm/build.sh /out

# 3. Test and build the page around it. The page is only built once the
#    engine's own tests have passed.
FROM node:24-alpine AS web
WORKDIR /app
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web .
COPY --from=engine-tests /src/build/measure /tmp/engine-tests-passed
COPY --from=engine /out/engine.js /out/engine.wasm src/engine/wasm/
RUN npm test && npm run build

# 4. Serve it.
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=web /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://127.0.0.1/ > /dev/null || exit 1
