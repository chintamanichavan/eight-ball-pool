// A pool table: sixteen balls on cloth, six cushions and six pockets.
//
// Set up a position, strike the cue ball, then call advance() with the time
// that has passed. The table works out everything that happens and reports the
// knocks worth hearing. Distances are metres, times seconds, angles radians.
// The origin is the centre of the cloth, x along the long side.

#pragma once

#include "pool/vec.hpp"

#include <array>
#include <cstddef>
#include <vector>

namespace pool {

// An 8-foot table and standard balls.
inline constexpr double kLength = 2.24;
inline constexpr double kWidth = 1.12;
inline constexpr double kBallRadius = 0.028575;
inline constexpr std::size_t kBalls = 16;
inline constexpr std::size_t kCueBall = 0;

// How the cloth, balls and cushions behave. Values are typical measured ones.
inline constexpr double kGravity = 9.81;
inline constexpr double kSlideDrag = 0.2;       // friction while the ball skids
inline constexpr double kRollDrag = 0.01;       // drag once it rolls
inline constexpr double kSpinDrag = 0.044;      // drag on side spin
inline constexpr double kBallBounce = 0.95;     // speed kept between two balls
inline constexpr double kCushionBounce = 0.75;  // speed kept across a cushion
inline constexpr double kCushionGrip = 0.14;    // how hard a cushion grabs a spinning ball
inline constexpr double kJawBounce = 0.6;       // the hard points beside each pocket

// Where each cushion stops short of a pocket, measured along the cushion.
inline constexpr double kCornerGap = 0.073;  // from the corner
inline constexpr double kSideGap = 0.058;    // each way from the middle of a long side

struct Ball {
  Vec2 pos;
  Vec2 vel;
  Vec2 roll_spin;          // spin about the two level axes, radians per second
  double side_spin = 0.0;  // spin about the upright axis; positive is anticlockwise from above
  bool on_table = false;
};

// One strike of the cue ball.
struct Shot {
  double angle = 0.0;   // direction the cue ball is sent
  double speed = 0.0;   // speed the cue ball leaves at
  double side = 0.0;    // where the tip strikes, in ball radii: positive is right of centre
  double height = 0.0;  // positive is above centre
};

enum class EventKind { BallHit, CushionHit, Pocketed };

// Something worth hearing. `strength` is the closing speed in metres per second.
struct Event {
  EventKind kind;
  int ball;
  int other;  // the second ball in a BallHit, otherwise -1
  double strength;
};

class Table {
public:
  // Starts with the balls racked and the cue ball on the head spot.
  Table();

  void rack();

  // Takes every ball off the table, for setting up a position by hand.
  void clear();

  // Puts a ball at rest at `pos`.
  void place(std::size_t ball, Vec2 pos);

  // Whether `ball` could be put down at `pos`: on the cloth, clear of the
  // cushions, and not touching any other ball.
  bool can_place(std::size_t ball, Vec2 pos) const;

  // Strikes the cue ball. Does nothing if it is off the table.
  void strike(const Shot& shot);

  // Moves time forward. Events are added to `events` in the order they happen.
  void advance(double seconds, std::vector<Event>& events);

  // True while any ball is moving or spinning.
  bool moving() const;

  const std::array<Ball, kBalls>& balls() const {
    return balls_;
  }

  // Energy of motion of every ball on the table, per kilogram of ball.
  double energy() const;

private:
  void step(std::vector<Event>& events);

  std::array<Ball, kBalls> balls_{};
  double pending_ = 0.0;  // time handed to advance() but not yet a whole step
};

}  // namespace pool
