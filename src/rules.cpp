#include "pool/rules.hpp"

#include <algorithm>

namespace pool {
namespace {

constexpr Group other(Group g) {
  return g == Group::Solids ? Group::Stripes : Group::Solids;
}

}  // namespace

void ShotLog::note(const Event& event) {
  if (event.kind == EventKind::BallHit && first_hit < 0) {
    // The table reports a pair with the lower number first.
    if (event.ball == static_cast<int>(kCueBall)) first_hit = event.other;
  } else if (event.kind == EventKind::Pocketed) {
    if (event.ball == static_cast<int>(kCueBall)) {
      cue_potted = true;
    } else {
      potted.push_back(event.ball);
    }
  }
}

int balls_left(const Table& table, Group group) {
  int left = 0;
  for (int ball = 1; ball < static_cast<int>(kBalls); ++ball) {
    if (ball != kEightBall && group_of(ball) == group &&
        table.balls()[static_cast<std::size_t>(ball)].on_table) {
      ++left;
    }
  }
  return left;
}

bool Game::may_hit_first(int ball, const Table& table) const {
  if (ball <= 0) return false;
  const Group mine = groups_[player_];
  if (breaking_) return true;
  if (mine == Group::Open) return ball != kEightBall;
  if (balls_left(table, mine) == 0) return ball == kEightBall;
  return ball != kEightBall && group_of(ball) == mine;
}

Verdict Game::judge(const ShotLog& log, const Table& after) {
  Verdict verdict;
  const int shooter = player_;
  const Group mine = groups_[shooter];
  const auto potted = [&log](auto&& wanted) {
    return std::ranges::any_of(log.potted, wanted);
  };
  const bool eight_down = potted([](int ball) {
    return ball == kEightBall;
  });

  // What the player was allowed to hit, as the table stood before the shot:
  // balls of theirs that dropped on this shot were still up then.
  const auto mine_potted = std::ranges::count_if(log.potted, [mine](int ball) {
    return ball != kEightBall && group_of(ball) == mine;
  });
  const bool cleared_before = mine != Group::Open && balls_left(after, mine) + mine_potted == 0;
  const auto legal_first = [&](int ball) {
    if (breaking_) return true;
    if (mine == Group::Open) return ball != kEightBall;
    if (cleared_before) return ball == kEightBall;
    return ball != kEightBall && group_of(ball) == mine;
  };

  if (log.cue_potted) {
    verdict.foul = Foul::Scratch;
  } else if (log.first_hit < 0) {
    verdict.foul = Foul::NoHit;
  } else if (!legal_first(log.first_hit)) {
    verdict.foul = Foul::WrongBall;
  }
  const bool foul = verdict.foul != Foul::None;

  if (breaking_ && eight_down) {
    // Rack again. A clean break keeps the cue; a foul hands it over.
    verdict.rerack = true;
    verdict.turn_passes = foul;
    if (foul) player_ = 1 - shooter;
    ball_in_hand_ = false;
    return verdict;
  }

  if (eight_down) {
    winner_ = (!foul && cleared_before) ? shooter : 1 - shooter;
    verdict.winner = winner_;
    return verdict;
  }

  // The first ball potted on an open table, after the break, sets the groups.
  if (!breaking_ && !foul && mine == Group::Open && !log.potted.empty()) {
    groups_[shooter] = group_of(log.potted.front());
    groups_[1 - shooter] = other(groups_[shooter]);
  }

  bool keeps_turn = false;
  if (!foul) {
    const Group now = groups_[shooter];
    keeps_turn = now == Group::Open ? !log.potted.empty() : potted([now](int ball) {
      return group_of(ball) == now;
    });
  }

  breaking_ = false;
  verdict.turn_passes = !keeps_turn;
  if (verdict.turn_passes) player_ = 1 - shooter;
  ball_in_hand_ = foul;
  return verdict;
}

}  // namespace pool
