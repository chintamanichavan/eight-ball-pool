// The computer's player. It lists the shots worth trying, plays each one out
// on a copy of the table, and keeps the one that turns out best.
//
// Thinking is split into small pieces so the page can keep drawing: call
// think() a little each frame until it returns true.

#pragma once

#include "pool/rules.hpp"
#include "pool/table.hpp"

#include <cstdint>
#include <random>
#include <vector>

namespace pool {

// How a player chooses among the shots worth trying. The game itself always
// uses Position; the other two exist to measure what the thinking is worth
// (docs/STUDY.md).
enum class Mind {
  Geometry,  // the fullest straight pot; never plays a shot out
  Physics,   // plays each shot out and keeps the one that pots, or at worst does not foul
  Position,  // Physics, and also weighs what each shot leaves behind
};

// How good a player is: how it chooses, and how imperfectly it then plays.
// Zero error plays every planned shot exactly.
struct Skill {
  double aim_error = 0.0;    // typical error in the aim, radians
  double speed_error = 0.0;  // typical error in the speed, as a share of it
  double break_speed = 8.0;  // how hard the player's cue lets them break, metres per second
  Mind mind = Mind::Position;
};

// What the computer will do.
struct Plan {
  bool place = false;  // put the cue ball at `cue_pos` first (ball in hand)
  Vec2 cue_pos;
  Shot shot;
};

class Opponent {
public:
  // Begins choosing a shot for the player whose turn it is in `game`.
  void start(const Table& table, const Game& game, Skill skill, std::uint64_t seed);

  // Plays out up to `shots` more candidates. True once every one is done.
  bool think(int shots);

  // The best shot found so far, with the player's error added.
  Plan plan();

  // The best shot found so far, exactly as planned.
  const Plan& intended() const {
    return best_;
  }

  int candidates() const {
    return static_cast<int>(candidates_.size());
  }

private:
  double play_out(const Plan& plan) const;
  void add(const Plan& plan, double by_geometry);

  Table table_;
  Game game_;
  Skill skill_;
  std::mt19937_64 rng_;
  std::vector<Plan> candidates_;
  std::vector<double> by_geometry_;  // each candidate's score without playing it out
  std::size_t next_ = 0;
  Plan best_;
  double best_score_ = 0.0;
};

// The straight pots open to the player to shoot: a ball they may hit, a pocket
// it can reach, and nothing in the way. Used to judge the position a shot leaves.
int open_shots(const Table& table, const Game& game);

}  // namespace pool
