// Where a shot would go, for the guide lines the player aims with.

#pragma once

#include "pool/table.hpp"

#include <vector>

namespace pool {

struct Guide {
  // Where the cue ball's centre will be when it first touches something.
  Vec2 ghost;
  // The ball it touches, or -1 when it reaches a cushion first.
  int ball = -1;
  // The direction the struck ball leaves in. Zero for a cushion.
  Vec2 object_dir;
  // The direction the cue ball leaves in when it carries no spin. Zero after a
  // dead straight hit, where it stops.
  Vec2 cue_dir;
};

// The first thing the cue ball meets when sent off at `angle`. The path is a
// straight line: it ignores spin and how the ball slows.
Guide predict(const Table& table, double angle);

// A shot played out ahead of time, as paths to draw.
struct Preview {
  // The cue ball, from where it lies to where it first touches a ball, or to
  // where the preview gave up.
  std::vector<Vec2> cue_before;
  // The first ball touched, or -1 if none was.
  int ball = -1;
  // The cue ball and the touched ball, from the moment they meet.
  std::vector<Vec2> cue_after;
  std::vector<Vec2> object;
  // Whether the touched ball went down a pocket.
  bool potted = false;
};

// Plays `shot` out on a copy of `table`. Before the first ball is touched the
// cue ball may come off at most `bounces` cushions; one more ends the preview.
// After the touch, both balls are followed for `seconds`, or until they stop.
Preview preview(const Table& table, const Shot& shot, int bounces, double seconds);

}  // namespace pool
