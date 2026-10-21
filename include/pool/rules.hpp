// The rules of eight-ball: whose turn it is, which balls are whose, what is a
// foul, and who has won.
//
// The rules watch a shot through a ShotLog, then judge it once the balls have
// stopped. They never move a ball themselves.

#pragma once

#include "pool/table.hpp"

#include <cstdint>
#include <vector>

namespace pool {

inline constexpr int kEightBall = 8;

enum class Group : std::uint8_t { Open, Solids, Stripes };

constexpr Group group_of(int ball) {
  return ball < kEightBall ? Group::Solids : Group::Stripes;
}

enum class Foul : std::uint8_t {
  None,
  Scratch,    // the cue ball went down a pocket
  NoHit,      // the cue ball touched no ball
  WrongBall,  // the first ball touched was not one the player may hit
};

// What mattered about one shot, gathered from the table's events.
struct ShotLog {
  int first_hit = -1;  // the first ball the cue ball touched
  std::vector<int> potted;
  bool cue_potted = false;

  void note(const Event& event);
};

// The rules' ruling on a shot.
struct Verdict {
  Foul foul = Foul::None;
  bool turn_passes = false;
  bool rerack = false;  // the black dropped on the break
  int winner = -1;      // 0 or 1 once the game is over
};

class Game {
public:
  // Rules on the shot in `log`, given the table once the balls have stopped,
  // and moves the game on: the turn, the groups, ball in hand, the winner.
  Verdict judge(const ShotLog& log, const Table& after);

  // Whether the player to shoot may hit `ball` first.
  bool may_hit_first(int ball, const Table& table) const;

  int player() const {
    return player_;
  }
  Group group(int player) const {
    return groups_[player];
  }
  bool breaking() const {
    return breaking_;
  }
  bool ball_in_hand() const {
    return ball_in_hand_;
  }
  int winner() const {
    return winner_;
  }

  // The player has put the cue ball down.
  void cue_ball_placed() {
    ball_in_hand_ = false;
  }

private:
  int player_ = 0;
  Group groups_[2] = {Group::Open, Group::Open};
  bool breaking_ = true;
  bool ball_in_hand_ = false;
  int winner_ = -1;
};

// How many of `group`'s balls are still on the table.
int balls_left(const Table& table, Group group);

}  // namespace pool
