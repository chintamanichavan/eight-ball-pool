// Types for the module that wasm/build.sh generates next to this file.
import type { Match, Sizes } from '../engine'

interface EngineModule {
  Match: new () => Match
  sizes(): Sizes
}

export default function createEngine(): Promise<EngineModule>
