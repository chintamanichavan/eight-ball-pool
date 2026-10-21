#include "pool/rules.hpp"

#include <gtest/gtest.h>

#include <algorithm>
#include <array>
#include <initializer_list>

namespace pool {
namespace {

ShotLog shot(int first_hit, std::initializer_list<int> potted = {}, bool cue_potted = false) {
  ShotLog log;
  log.first_hit = first_hit;
  log.potted = potted;
  log.cue_potted = cue_potted;
  return log;
}

// A racked table with the given balls taken off.
Table table_without(std::initializer_list<int> gone) {
  Table table;
  std::array<Vec2, kBalls> spots;
  for (std::size_t i = 0; i < kBalls; ++i) spots[i] = table.balls()[i].pos;
  table.clear();
  for (std::size_t i = 0; i < kBalls; ++i) {
    if (std::ranges::find(gone, static_cast<int>(i)) == gone.end()) table.place(i, spots[i]);
  }
  return table;
}

// A game past the break, with player 0 on solids and to shoot.
Game solids_to_shoot() {
  Game game;
  game.judge(shot(1, {2}), table_without({2}));     // break, potting the 2: player 0 continues
  game.judge(shot(3, {3}), table_without({2, 3}));  // pots a solid on the open table
  return game;
}

TEST(ShotLog, RecordsTheFirstBallTheCueBallTouches) {
  ShotLog log;
  log.note({EventKind::CushionHit, 0, -1, 1.0});
  log.note({EventKind::BallHit, 3, 5, 1.0});  // two object balls: not the cue ball
  log.note({EventKind::BallHit, 0, 9, 1.0});
  log.note({EventKind::BallHit, 0, 4, 1.0});
  EXPECT_EQ(log.first_hit, 9);
}

TEST(ShotLog, SeparatesThePottedCueBallFromPottedBalls) {
  ShotLog log;
  log.note({EventKind::Pocketed, 5, -1, 1.0});
  log.note({EventKind::Pocketed, 0, -1, 1.0});
  EXPECT_EQ(log.potted, std::vector<int>{5});
  EXPECT_TRUE(log.cue_potted);
}

TEST(Game, StartsWithPlayerZeroBreakingAnOpenTable) {
  const Game game;
  EXPECT_EQ(game.player(), 0);
  EXPECT_TRUE(game.breaking());
  EXPECT_EQ(game.group(0), Group::Open);
  EXPECT_EQ(game.winner(), -1);
}

TEST(Game, DryBreakPassesTheTurn) {
  Game game;
  const Verdict v = game.judge(shot(1), table_without({}));
  EXPECT_EQ(v.foul, Foul::None);
  EXPECT_TRUE(v.turn_passes);
  EXPECT_EQ(game.player(), 1);
  EXPECT_FALSE(game.breaking());
  EXPECT_FALSE(game.ball_in_hand());
}

TEST(Game, PotOnTheBreakKeepsTheTurnButLeavesTheTableOpen) {
  Game game;
  const Verdict v = game.judge(shot(1, {10}), table_without({10}));
  EXPECT_FALSE(v.turn_passes);
  EXPECT_EQ(game.player(), 0);
  EXPECT_EQ(game.group(0), Group::Open);
}

TEST(Game, BlackOnTheBreakMeansRackAgain) {
  Game game;
  const Verdict v = game.judge(shot(1, {8}), table_without({8}));
  EXPECT_TRUE(v.rerack);
  EXPECT_EQ(v.winner, -1);
  EXPECT_EQ(game.player(), 0);
  EXPECT_TRUE(game.breaking());
}

TEST(Game, FirstPotAfterTheBreakSetsTheGroups) {
  Game game;
  game.judge(shot(1), table_without({}));  // dry break: player 1 to shoot
  const Verdict v = game.judge(shot(11, {11}), table_without({11}));
  EXPECT_FALSE(v.turn_passes);
  EXPECT_EQ(game.group(1), Group::Stripes);
  EXPECT_EQ(game.group(0), Group::Solids);
}

TEST(Game, PottingYourOwnBallKeepsTheTurn) {
  Game game = solids_to_shoot();
  const Verdict v = game.judge(shot(4, {4}), table_without({2, 3, 4}));
  EXPECT_EQ(v.foul, Foul::None);
  EXPECT_FALSE(v.turn_passes);
}

TEST(Game, MissingPassesTheTurnWithoutBallInHand) {
  Game game = solids_to_shoot();
  const Verdict v = game.judge(shot(4), table_without({2, 3}));
  EXPECT_TRUE(v.turn_passes);
  EXPECT_FALSE(game.ball_in_hand());
}

TEST(Game, PottingOnlyTheOtherGroupPassesTheTurn) {
  Game game = solids_to_shoot();
  const Verdict v = game.judge(shot(4, {12}), table_without({2, 3, 12}));
  EXPECT_EQ(v.foul, Foul::None);
  EXPECT_TRUE(v.turn_passes);
}

TEST(Game, ScratchIsAFoulAndGivesBallInHand) {
  Game game = solids_to_shoot();
  const Verdict v = game.judge(shot(4, {4}, true), table_without({2, 3, 4}));
  EXPECT_EQ(v.foul, Foul::Scratch);
  EXPECT_TRUE(v.turn_passes);
  EXPECT_TRUE(game.ball_in_hand());
  EXPECT_EQ(game.player(), 1);
  game.cue_ball_placed();
  EXPECT_FALSE(game.ball_in_hand());
}

TEST(Game, HittingNothingIsAFoul) {
  Game game = solids_to_shoot();
  EXPECT_EQ(game.judge(shot(-1), table_without({2, 3})).foul, Foul::NoHit);
}

TEST(Game, HittingTheOtherGroupFirstIsAFoul) {
  Game game = solids_to_shoot();
  EXPECT_EQ(game.judge(shot(12, {4}), table_without({2, 3, 4})).foul, Foul::WrongBall);
  EXPECT_TRUE(game.ball_in_hand());
}

TEST(Game, HittingTheBlackFirstOnAnOpenTableIsAFoul) {
  Game game;
  game.judge(shot(1), table_without({}));
  EXPECT_EQ(game.judge(shot(8), table_without({})).foul, Foul::WrongBall);
}

TEST(Game, MayHitFirstFollowsTheGroups) {
  const Game game = solids_to_shoot();
  const Table table = table_without({2, 3});
  EXPECT_TRUE(game.may_hit_first(5, table));
  EXPECT_FALSE(game.may_hit_first(12, table));
  EXPECT_FALSE(game.may_hit_first(8, table));
  EXPECT_FALSE(game.may_hit_first(0, table));

  const Table cleared = table_without({1, 2, 3, 4, 5, 6, 7});
  EXPECT_TRUE(game.may_hit_first(8, cleared));
  EXPECT_FALSE(game.may_hit_first(12, cleared));
}

TEST(Game, PottingTheBlackEarlyLoses) {
  Game game = solids_to_shoot();
  const Verdict v = game.judge(shot(4, {8}), table_without({2, 3, 8}));
  EXPECT_EQ(v.winner, 1);
  EXPECT_EQ(game.winner(), 1);
}

TEST(Game, PottingTheBlackAfterClearingYourGroupWins) {
  Game game = solids_to_shoot();
  const Table before = table_without({1, 2, 3, 4, 5, 6, 7});
  ASSERT_TRUE(game.may_hit_first(8, before));
  const Verdict v = game.judge(shot(8, {8}), table_without({1, 2, 3, 4, 5, 6, 7, 8}));
  EXPECT_EQ(v.foul, Foul::None);
  EXPECT_EQ(v.winner, 0);
}

TEST(Game, PottingYourLastBallAndTheBlackTogetherLoses) {
  Game game = solids_to_shoot();
  // The 7 was still up when the shot began, so the black was not yet on.
  const Verdict v = game.judge(shot(7, {7, 8}), table_without({1, 2, 3, 4, 5, 6, 7, 8}));
  EXPECT_EQ(v.winner, 1);
}

TEST(Game, ScratchingOnTheBlackLoses) {
  Game game = solids_to_shoot();
  const Verdict v = game.judge(shot(8, {8}, true), table_without({1, 2, 3, 4, 5, 6, 7, 8}));
  EXPECT_EQ(v.winner, 1);
}

TEST(Game, CountsTheBallsLeftInAGroup) {
  const Table table = table_without({2, 3, 12});
  EXPECT_EQ(balls_left(table, Group::Solids), 5);
  EXPECT_EQ(balls_left(table, Group::Stripes), 6);
}

}  // namespace
}  // namespace pool
