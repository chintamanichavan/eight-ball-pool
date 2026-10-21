#include "pool/aim.hpp"

#include <cmath>
#include <limits>
#include <vector>

namespace pool {
namespace {

// How far along `aim` from `from` the cue ball travels before its centre is
// two radii from `target`. Infinity if it passes by.
double reach_to_ball(Vec2 from, Vec2 aim, Vec2 target) {
  const Vec2 to = target - from;
  const double along = dot(to, aim);
  const double beside_sq = dot(to, to) - along * along;
  const double touching_sq = 4.0 * kBallRadius * kBallRadius;
  if (along <= 0.0 || beside_sq >= touching_sq) return std::numeric_limits<double>::infinity();
  return along - std::sqrt(touching_sq - beside_sq);
}

}  // namespace

Guide predict(const Table& table, double angle) {
  const Ball& cue = table.balls()[kCueBall];
  if (!cue.on_table) return {};

  const Vec2 aim = from_angle(angle);
  Guide guide;

  // The cushions, seen by the ball's centre: a box one radius inside them.
  const double far_x = kLength / 2.0 - kBallRadius;
  const double far_y = kWidth / 2.0 - kBallRadius;
  const double to_x = aim.x != 0.0 ? (std::copysign(far_x, aim.x) - cue.pos.x) / aim.x
                                   : std::numeric_limits<double>::infinity();
  const double to_y = aim.y != 0.0 ? (std::copysign(far_y, aim.y) - cue.pos.y) / aim.y
                                   : std::numeric_limits<double>::infinity();
  double reach = std::min(to_x, to_y);
  guide.cue_dir = to_x < to_y ? Vec2{-aim.x, aim.y} : Vec2{aim.x, -aim.y};

  for (std::size_t i = 1; i < kBalls; ++i) {
    const Ball& other = table.balls()[i];
    if (!other.on_table) continue;
    const double to_ball = reach_to_ball(cue.pos, aim, other.pos);
    if (to_ball >= reach) continue;

    reach = to_ball;
    guide.ball = static_cast<int>(i);
    guide.object_dir = unit(other.pos - (cue.pos + aim * to_ball));
    // What is left of the cue ball's motion once the struck ball has taken
    // the part along the line of centres.
    guide.cue_dir = unit(aim - guide.object_dir * dot(aim, guide.object_dir));
  }

  guide.ghost = cue.pos + aim * reach;
  return guide;
}

Preview preview(const Table& table, const Shot& shot, int bounces, double seconds) {
  // Fine enough that a drawn path looks smooth: 4 mm apart at 1 m/s.
  constexpr double slice = 0.004;
  // A cue ball that has met nothing by now is not going to.
  constexpr double longest_run = 6.0;

  Preview out;
  Table copy = table;
  const Ball& cue = copy.balls()[kCueBall];
  if (!cue.on_table) return out;
  out.cue_before.push_back(cue.pos);
  copy.strike(shot);

  std::vector<Event> events;
  int cushions = 0;
  double left = longest_run;
  while (out.ball < 0 && left > 0.0 && copy.moving()) {
    events.clear();
    copy.advance(slice, events);
    left -= slice;
    for (const Event& event : events) {
      if (event.ball != static_cast<int>(kCueBall)) continue;
      if (event.kind == EventKind::BallHit) {
        out.ball = event.other;
        break;
      }
      if (event.kind == EventKind::Pocketed) return out;
      if (event.kind == EventKind::CushionHit && ++cushions > bounces) {
        out.cue_before.push_back(cue.pos);
        return out;
      }
    }
    out.cue_before.push_back(cue.pos);
  }
  if (out.ball < 0) return out;

  const Ball& object = copy.balls()[static_cast<std::size_t>(out.ball)];
  out.cue_after.push_back(cue.pos);
  out.object.push_back(object.pos);
  bool cue_down = false;
  for (left = seconds; left > 0.0 && copy.moving(); left -= slice) {
    events.clear();
    copy.advance(slice, events);
    for (const Event& event : events) {
      if (event.kind != EventKind::Pocketed) continue;
      if (event.ball == out.ball) out.potted = true;
      if (event.ball == static_cast<int>(kCueBall)) cue_down = true;
    }
    if (!cue_down) out.cue_after.push_back(cue.pos);
    if (!out.potted) out.object.push_back(object.pos);
  }
  return out;
}

}  // namespace pool
