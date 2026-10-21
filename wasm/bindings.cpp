// The browser's view of a match: the table, the rules and the computer's
// player behind one object, with plain numbers and arrays so the page needs no
// generated types.
//
// Player 0 is the person, player 1 the computer.

#include "pool/aim.hpp"
#include "pool/opponent.hpp"
#include "pool/rules.hpp"
#include "pool/table.hpp"

#include <emscripten/bind.h>
#include <emscripten/val.h>

#include <array>
#include <cstddef>
#include <cstdint>
#include <vector>

namespace {

// Numbers per ball in the array state() returns:
// x, y, velocity x, velocity y, rolling spin x, rolling spin y, side spin, on the table (1 or 0).
constexpr std::size_t kFields = 8;

struct JsGuide {
  double ghostX;
  double ghostY;
  int ball;
  bool legal;  // whether the player may hit that ball first
  double objectX;
  double objectY;
  double cueX;
  double cueY;
};

struct JsEvent {
  int kind;  // 0 ball hit, 1 cushion hit, 2 pocketed
  int ball;
  int other;
  double strength;
};

struct JsSizes {
  double length;
  double width;
  double ballRadius;
  double cornerGap;
  double sideGap;
};

struct JsStatus {
  int player;     // whose turn: 0 the person, 1 the computer
  int yourGroup;  // 0 open, 1 solids, 2 stripes
  int computerGroup;
  int yourLeft;  // balls still to pot, the black not counted
  int computerLeft;
  bool breaking;
  bool ballInHand;
  int winner;  // -1 while the game is on
};

struct JsVerdict {
  int foul;  // 0 none, 1 cue ball potted, 2 hit nothing, 3 hit the wrong ball first
  bool turnPasses;
  bool rerack;
  int winner;
};

struct JsPlan {
  bool place;
  double x;
  double y;
  double angle;
  double speed;
};

class JsMatch {
public:
  // Racks a new game against a player with the given typical errors (aim in
  // degrees, speed as a share) and break speed.
  void start(double aim_error_degrees, double speed_error, double break_speed, double seed) {
    table_.rack();
    game_ = pool::Game{};
    log_ = pool::ShotLog{};
    skill_ = {.aim_error = aim_error_degrees * 3.14159265358979323846 / 180.0,
              .speed_error = speed_error,
              .break_speed = break_speed};
    seed_ = static_cast<std::uint64_t>(seed);
    thinking_ = false;
  }

  JsStatus status() const {
    JsStatus s{};
    s.player = game_.player();
    const auto left = [this](int player) {
      const pool::Group group = game_.group(player);
      return group == pool::Group::Open ? 7 : pool::balls_left(table_, group);
    };
    s.yourGroup = static_cast<int>(game_.group(0));
    s.computerGroup = static_cast<int>(game_.group(1));
    s.yourLeft = left(0);
    s.computerLeft = left(1);
    s.breaking = game_.breaking();
    s.ballInHand = game_.ball_in_hand();
    s.winner = game_.winner();
    return s;
  }

  // Tries to put the cue ball down. False, and nothing moves, if the spot is taken.
  bool placeCueBall(double x, double y) {
    if (!table_.can_place(pool::kCueBall, {x, y})) return false;
    table_.place(pool::kCueBall, {x, y});
    return true;
  }

  // The player is happy with where the cue ball is.
  void confirmPlacement() {
    game_.cue_ball_placed();
  }

  void strike(double angle, double speed, double side, double height) {
    log_ = pool::ShotLog{};
    table_.strike({.angle = angle, .speed = speed, .side = side, .height = height});
  }

  // Moves time forward and returns what happened, in order.
  emscripten::val advance(double seconds) {
    events_.clear();
    table_.advance(seconds, events_);
    emscripten::val out = emscripten::val::array();
    for (const pool::Event& e : events_) {
      log_.note(e);
      out.call<void>("push", JsEvent{static_cast<int>(e.kind), e.ball, e.other, e.strength});
    }
    return out;
  }

  // Call once the balls have stopped: the rules judge the shot just played.
  JsVerdict finishShot() {
    const pool::Verdict v = game_.judge(log_, table_);
    if (v.rerack) table_.rack();
    thinking_ = false;
    return {static_cast<int>(v.foul), v.turn_passes, v.rerack, v.winner};
  }

  bool moving() const {
    return table_.moving();
  }

  // A view of the engine's own memory. Read it before the next call.
  emscripten::val state() {
    std::size_t at = 0;
    for (const pool::Ball& b : table_.balls()) {
      state_[at++] = b.pos.x;
      state_[at++] = b.pos.y;
      state_[at++] = b.vel.x;
      state_[at++] = b.vel.y;
      state_[at++] = b.roll_spin.x;
      state_[at++] = b.roll_spin.y;
      state_[at++] = b.side_spin;
      state_[at++] = b.on_table ? 1.0 : 0.0;
    }
    return emscripten::val(emscripten::typed_memory_view(state_.size(), state_.data()));
  }

  JsGuide guide(double angle) const {
    const pool::Guide g = pool::predict(table_, angle);
    const bool legal = g.ball < 0 || game_.may_hit_first(g.ball, table_);
    return {g.ghost.x,
            g.ghost.y,
            g.ball,
            legal,
            g.object_dir.x,
            g.object_dir.y,
            g.cue_dir.x,
            g.cue_dir.y};
  }

  // The shot played out ahead of time, for the guide lines. Each path is a
  // flat list: x, y, x, y, ...
  emscripten::val preview(
      double angle, double speed, double side, double height, int bounces, double seconds) const {
    const pool::Preview p = pool::preview(
        table_, {.angle = angle, .speed = speed, .side = side, .height = height}, bounces, seconds);
    const auto flat = [](const std::vector<pool::Vec2>& path) {
      emscripten::val out = emscripten::val::array();
      for (const pool::Vec2 point : path) {
        out.call<void>("push", point.x);
        out.call<void>("push", point.y);
      }
      return out;
    };
    emscripten::val out = emscripten::val::object();
    out.set("cueBefore", flat(p.cue_before));
    out.set("cueAfter", flat(p.cue_after));
    out.set("object", flat(p.object));
    out.set("ball", p.ball);
    out.set("potted", p.potted);
    out.set("legal", p.ball < 0 || game_.may_hit_first(p.ball, table_));
    return out;
  }

  // The computer thinks a little. Call each frame until it returns true.
  bool think(int shots) {
    if (!thinking_) {
      opponent_.start(table_, game_, skill_, seed_++);
      thinking_ = true;
    }
    return opponent_.think(shots);
  }

  // What the computer decided, with its level's error added.
  JsPlan computerPlan() {
    const pool::Plan p = opponent_.plan();
    return {p.place, p.cue_pos.x, p.cue_pos.y, p.shot.angle, p.shot.speed};
  }

private:
  pool::Table table_;
  pool::Game game_;
  pool::ShotLog log_;
  pool::Opponent opponent_;
  pool::Skill skill_;
  std::uint64_t seed_ = 1;
  bool thinking_ = false;
  std::vector<pool::Event> events_;
  std::array<double, pool::kBalls * kFields> state_{};
};

JsSizes sizes() {
  return {pool::kLength, pool::kWidth, pool::kBallRadius, pool::kCornerGap, pool::kSideGap};
}

}  // namespace

EMSCRIPTEN_BINDINGS(pool) {
  using namespace emscripten;

  value_object<JsGuide>("Guide")
      .field("ghostX", &JsGuide::ghostX)
      .field("ghostY", &JsGuide::ghostY)
      .field("ball", &JsGuide::ball)
      .field("legal", &JsGuide::legal)
      .field("objectX", &JsGuide::objectX)
      .field("objectY", &JsGuide::objectY)
      .field("cueX", &JsGuide::cueX)
      .field("cueY", &JsGuide::cueY);

  value_object<JsEvent>("Event")
      .field("kind", &JsEvent::kind)
      .field("ball", &JsEvent::ball)
      .field("other", &JsEvent::other)
      .field("strength", &JsEvent::strength);

  value_object<JsSizes>("Sizes")
      .field("length", &JsSizes::length)
      .field("width", &JsSizes::width)
      .field("ballRadius", &JsSizes::ballRadius)
      .field("cornerGap", &JsSizes::cornerGap)
      .field("sideGap", &JsSizes::sideGap);

  value_object<JsStatus>("Status")
      .field("player", &JsStatus::player)
      .field("yourGroup", &JsStatus::yourGroup)
      .field("computerGroup", &JsStatus::computerGroup)
      .field("yourLeft", &JsStatus::yourLeft)
      .field("computerLeft", &JsStatus::computerLeft)
      .field("breaking", &JsStatus::breaking)
      .field("ballInHand", &JsStatus::ballInHand)
      .field("winner", &JsStatus::winner);

  value_object<JsVerdict>("Verdict")
      .field("foul", &JsVerdict::foul)
      .field("turnPasses", &JsVerdict::turnPasses)
      .field("rerack", &JsVerdict::rerack)
      .field("winner", &JsVerdict::winner);

  value_object<JsPlan>("Plan")
      .field("place", &JsPlan::place)
      .field("x", &JsPlan::x)
      .field("y", &JsPlan::y)
      .field("angle", &JsPlan::angle)
      .field("speed", &JsPlan::speed);

  function("sizes", &sizes);

  class_<JsMatch>("Match")
      .constructor<>()
      .function("start", &JsMatch::start)
      .function("status", &JsMatch::status)
      .function("placeCueBall", &JsMatch::placeCueBall)
      .function("confirmPlacement", &JsMatch::confirmPlacement)
      .function("strike", &JsMatch::strike)
      .function("advance", &JsMatch::advance)
      .function("finishShot", &JsMatch::finishShot)
      .function("moving", &JsMatch::moving)
      .function("state", &JsMatch::state)
      .function("guide", &JsMatch::guide)
      .function("preview", &JsMatch::preview)
      .function("think", &JsMatch::think)
      .function("computerPlan", &JsMatch::computerPlan);
}
