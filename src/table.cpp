#include "pool/table.hpp"

#include <algorithm>
#include <cmath>

namespace pool {
namespace {

// Half a millisecond. See docs/DESIGN.md for why this is small enough.
constexpr double kStep = 0.0005;

constexpr double kHalfLength = kLength / 2.0;
constexpr double kHalfWidth = kWidth / 2.0;

// Below these a ball counts as stopped: slower than a millimetre a second.
constexpr double kRestSpeed = 0.001;
constexpr double kRestSideSpin = 0.05;
constexpr double kNoSlip = 1e-9;

// Sliding friction acts on the ball's centre and, through spin, on the point
// touching the cloth. Together they close the slip 7/2 times as fast as the
// friction alone slows the ball. (A solid ball's spin responds 5/2 as much.)
constexpr double kSpinPerPush = 5.0 / (2.0 * kBallRadius);
constexpr double kSlipClosing = 3.5;

// One straight cushion face, from `from` to `to`, with the cloth on the side
// `inward` points to.
struct Cushion {
  Vec2 from;
  Vec2 to;
  Vec2 inward;
};

constexpr std::array<Cushion, 6> kCushions{{
    {{-kHalfLength + kCornerGap, kHalfWidth}, {-kSideGap, kHalfWidth}, {0, -1}},
    {{kSideGap, kHalfWidth}, {kHalfLength - kCornerGap, kHalfWidth}, {0, -1}},
    {{-kHalfLength + kCornerGap, -kHalfWidth}, {-kSideGap, -kHalfWidth}, {0, 1}},
    {{kSideGap, -kHalfWidth}, {kHalfLength - kCornerGap, -kHalfWidth}, {0, 1}},
    {{-kHalfLength, -kHalfWidth + kCornerGap}, {-kHalfLength, kHalfWidth - kCornerGap}, {1, 0}},
    {{kHalfLength, -kHalfWidth + kCornerGap}, {kHalfLength, kHalfWidth - kCornerGap}, {-1, 0}},
}};

// The velocity of the point of the ball that touches the cloth.
constexpr Vec2 slip(const Ball& b) {
  return {b.vel.x - kBallRadius * b.roll_spin.y, b.vel.y + kBallRadius * b.roll_spin.x};
}

// The spin of a ball rolling at `vel` without slipping.
constexpr Vec2 rolling_spin(Vec2 vel) {
  return {-vel.y / kBallRadius, vel.x / kBallRadius};
}

// Skids for up to `dt`. Returns the time left over once the ball starts to roll.
double slide(Ball& b, double dt) {
  const Vec2 u = slip(b);
  const double speed = length(u);
  if (speed <= kNoSlip) return dt;

  const double until_rolling = speed / (kSlipClosing * kSlideDrag * kGravity);
  const double t = std::min(dt, until_rolling);
  const Vec2 push = unit(u) * (-kSlideDrag * kGravity);  // friction, per kilogram

  b.pos += b.vel * t + push * (0.5 * t * t);
  b.vel += push * t;
  b.roll_spin.x += kSpinPerPush * push.y * t;
  b.roll_spin.y -= kSpinPerPush * push.x * t;
  if (t == until_rolling) b.roll_spin = rolling_spin(b.vel);  // remove rounding slip
  return dt - t;
}

void roll(Ball& b, double dt) {
  const double speed = length(b.vel);
  const double slower = speed - kRollDrag * kGravity * dt;
  if (slower <= kRestSpeed) {
    b.vel = {};
    b.roll_spin = {};
    return;
  }
  b.pos += b.vel * (dt * (speed + slower) / (2.0 * speed));
  b.vel = b.vel * (slower / speed);
  b.roll_spin = rolling_spin(b.vel);
}

void spin_down(Ball& b, double dt) {
  const double loss = kSpinPerPush * kSpinDrag * kGravity * dt;
  b.side_spin = std::abs(b.side_spin) <= std::max(loss, kRestSideSpin)
                    ? 0.0
                    : b.side_spin - std::copysign(loss, b.side_spin);
}

void move(Ball& b, double dt) {
  const double left = slide(b, dt);
  if (left > 0.0) roll(b, left);
  spin_down(b, dt);
}

// Two equal balls trade speed along the line between their centres.
//
// A step can carry two balls a millimetre into each other. The line of centres
// at that moment is not the line at first touch, and the difference shows up
// as a wrong cut angle. So the pair is wound back to the instant they touched,
// the hit is applied there, and the remaining time is replayed.
void collide(Ball& a, Ball& b, int ia, int ib, std::vector<Event>& events) {
  const Vec2 between = b.pos - a.pos;
  const double touching = 2.0 * kBallRadius;
  if (dot(between, between) >= touching * touching) return;

  const Vec2 parting = b.vel - a.vel;
  const double closing_rate = -dot(between, parting);
  if (closing_rate <= 0.0) {
    // Overlapping but not closing: resting together. Just ease them apart.
    const double gap = length(between);
    if (gap == 0.0) return;
    const Vec2 apart = between * ((touching - gap) / (2.0 * gap));
    a.pos -= apart;
    b.pos += apart;
    return;
  }

  // Time since first touch: when |between − parting·t| was exactly two radii.
  const double speed_sq = dot(parting, parting);
  const double overlap = dot(between, between) - touching * touching;  // negative
  const double since = std::min(
      kStep,
      (-closing_rate + std::sqrt(closing_rate * closing_rate - speed_sq * overlap)) / speed_sq);
  a.pos -= a.vel * since;
  b.pos -= b.vel * since;

  const Vec2 line = unit(b.pos - a.pos);
  const double closing = dot(a.vel - b.vel, line);
  const Vec2 traded = line * ((1.0 + kBallBounce) / 2.0 * closing);
  a.vel -= traded;
  b.vel += traded;
  a.pos += a.vel * since;
  b.pos += b.vel * since;
  events.push_back({EventKind::BallHit, ia, ib, closing});
}

// Bounces a ball off a cushion face. Side spin drags the ball along the
// cushion, and the cushion takes some of the spin in return.
void bounce(Ball& b, int index, const Cushion& c, std::vector<Event>& events) {
  const Vec2 along = unit(c.to - c.from);
  const double reach = dot(b.pos - c.from, along);
  if (reach < 0.0 || reach > length(c.to - c.from)) return;

  const double depth = kBallRadius - dot(b.pos - c.from, c.inward);
  if (depth <= 0.0 || depth > 2.0 * kBallRadius) return;
  b.pos += c.inward * depth;

  const double into = -dot(b.vel, c.inward);
  if (into <= 0.0) return;

  const Vec2 tangent = turned(c.inward);
  const double sideways = dot(b.vel, tangent);
  const double rubbing = sideways - kBallRadius * b.side_spin;  // speed of the touching point
  const double grip = kCushionGrip * (1.0 + kCushionBounce) * into;
  const double nudge = -std::clamp(rubbing * 2.0 / 7.0, -grip, grip);

  b.vel = c.inward * (kCushionBounce * into) + tangent * (sideways + nudge);
  b.side_spin -= kSpinPerPush * nudge;
  events.push_back({EventKind::CushionHit, index, -1, into});
}

// Bounces a ball off the hard point where a cushion ends at a pocket.
void bounce_off_jaw(Ball& b, int index, Vec2 jaw, std::vector<Event>& events) {
  const Vec2 away = b.pos - jaw;
  const double gap = length(away);
  if (gap >= kBallRadius || gap == 0.0) return;

  const Vec2 line = away * (1.0 / gap);
  b.pos = jaw + line * kBallRadius;
  const double into = -dot(b.vel, line);
  if (into <= 0.0) return;
  b.vel += line * ((1.0 + kJawBounce) * into);
  events.push_back({EventKind::CushionHit, index, -1, into});
}

constexpr bool past_the_cushions(Vec2 pos) {
  return pos.x < -kHalfLength || pos.x > kHalfLength || pos.y < -kHalfWidth || pos.y > kHalfWidth;
}

}  // namespace

Table::Table() {
  rack();
}

void Table::rack() {
  clear();
  place(kCueBall, {-kLength / 4.0, 0.0});

  // A triangle with its point on the foot spot. The eight ball sits in the
  // middle, and the two back corners hold one solid and one stripe.
  constexpr std::array<std::size_t, 15> order{1, 9, 2, 10, 8, 3, 11, 7, 14, 4, 5, 13, 15, 6, 12};
  const double spacing = 2.0 * kBallRadius * 1.002;  // a hair apart, so no two start touching
  std::size_t next = 0;
  for (int row = 0; row < 5; ++row) {
    for (int slot = 0; slot <= row; ++slot) {
      const double x = kLength / 4.0 + row * spacing * std::sqrt(3.0) / 2.0;
      const double y = (slot - row / 2.0) * spacing;
      place(order[next++], {x, y});
    }
  }
}

void Table::clear() {
  balls_ = {};
  pending_ = 0.0;
}

void Table::place(std::size_t ball, Vec2 pos) {
  Ball placed;
  placed.pos = pos;
  placed.on_table = true;
  balls_[ball] = placed;
}

bool Table::can_place(std::size_t ball, Vec2 pos) const {
  if (std::abs(pos.x) > kHalfLength - kBallRadius || std::abs(pos.y) > kHalfWidth - kBallRadius)
    return false;
  for (std::size_t i = 0; i < kBalls; ++i) {
    if (i != ball && balls_[i].on_table && length(balls_[i].pos - pos) < 2.0 * kBallRadius)
      return false;
  }
  return true;
}

void Table::strike(const Shot& shot) {
  Ball& cue = balls_[kCueBall];
  if (!cue.on_table) return;

  const Vec2 aim = from_angle(shot.angle);
  cue.vel = aim * shot.speed;
  // A tip that strikes off centre turns the ball as well as pushing it:
  // high or low gives rolling spin, left or right gives side spin.
  const double turn = kSpinPerPush * shot.speed;
  cue.roll_spin = turned(aim) * (turn * shot.height);
  cue.side_spin = turn * shot.side;
}

void Table::advance(double seconds, std::vector<Event>& events) {
  pending_ += seconds;
  while (pending_ >= kStep) {
    pending_ -= kStep;
    if (moving()) step(events);
  }
}

void Table::step(std::vector<Event>& events) {
  for (Ball& b : balls_) {
    if (b.on_table) move(b, kStep);
  }

  for (std::size_t i = 0; i < kBalls; ++i) {
    for (std::size_t j = i + 1; j < kBalls; ++j) {
      if (balls_[i].on_table && balls_[j].on_table) {
        collide(balls_[i], balls_[j], static_cast<int>(i), static_cast<int>(j), events);
      }
    }
  }

  for (std::size_t i = 0; i < kBalls; ++i) {
    Ball& b = balls_[i];
    if (!b.on_table) continue;
    const int index = static_cast<int>(i);
    for (const Cushion& c : kCushions) {
      bounce(b, index, c, events);
      bounce_off_jaw(b, index, c.from, events);
      bounce_off_jaw(b, index, c.to, events);
    }
    if (past_the_cushions(b.pos)) {
      events.push_back({EventKind::Pocketed, index, -1, length(b.vel)});
      const Vec2 where = b.pos;
      b = Ball{};
      b.pos = where;
    }
  }
}

bool Table::moving() const {
  return std::ranges::any_of(balls_, [](const Ball& b) {
    return b.on_table &&
           (dot(b.vel, b.vel) > 0.0 || b.side_spin != 0.0 || length(slip(b)) > kNoSlip);
  });
}

double Table::energy() const {
  constexpr double spin_share = 0.4 * kBallRadius * kBallRadius;  // a solid ball's 2/5 r²
  double total = 0.0;
  for (const Ball& b : balls_) {
    if (!b.on_table) continue;
    total += 0.5 * dot(b.vel, b.vel);
    total += 0.5 * spin_share * (dot(b.roll_spin, b.roll_spin) + b.side_spin * b.side_spin);
  }
  return total;
}

}  // namespace pool
