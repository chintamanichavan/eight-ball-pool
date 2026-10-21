#include "pool/opponent.hpp"

#include <gtest/gtest.h>

#include <cmath>
#include <vector>

namespace pool {
namespace {

// Plays `plan` on `table` and returns what the rules saw.
ShotLog play(Table& table, const Plan& plan) {
  if (plan.place) table.place(kCueBall, plan.cue_pos);
  table.strike(plan.shot);
  std::vector<Event> events;
  ShotLog log;
  while (table.moving()) {
    events.clear();
    table.advance(0.05, events);
    for (const Event& event : events) log.note(event);
  }
  return log;
}

// A game past the break with the table open and player 1 to shoot.
Game open_table() {
  Game game;
  ShotLog dry;
  dry.first_hit = 1;
  game.judge(dry, Table{});
  return game;
}

Plan decide(const Table& table, const Game& game, Skill skill = {}) {
  Opponent opponent;
  opponent.start(table, game, skill, 7);
  while (!opponent.think(4)) {
  }
  return opponent.plan();
}

TEST(Opponent, BreaksHardAtTheHeadBall) {
  const Table table;
  const Plan plan = decide(table, Game{});
  EXPECT_FALSE(plan.place);
  EXPECT_NEAR(plan.shot.angle, 0.0, 0.01);
  EXPECT_GT(plan.shot.speed, 7.0);
}

TEST(Opponent, BreaksAsHardAsItsCueAllows) {
  const Table table;
  EXPECT_NEAR(decide(table, Game{}, {.break_speed = 11.5}).shot.speed, 11.5, 1e-9);
}

TEST(Opponent, PotsAStraightBall) {
  Table table;
  table.clear();
  table.place(kCueBall, {0.2, 0.1});
  table.place(3, {0.7, 0.33});
  const Plan plan = decide(table, open_table());
  const ShotLog log = play(table, plan);
  EXPECT_EQ(log.first_hit, 3);
  EXPECT_EQ(log.potted, std::vector<int>{3});
  EXPECT_FALSE(log.cue_potted);
}

TEST(Opponent, PotsACutShot) {
  Table table;
  table.clear();
  table.place(kCueBall, {-0.3, -0.35});
  table.place(5, {0.6, 0.2});
  const ShotLog log = play(table, decide(table, open_table()));
  EXPECT_EQ(log.potted, std::vector<int>{5});
}

TEST(Opponent, DoesNotPlanAShotThroughAnotherBall) {
  Table table;
  table.clear();
  table.place(kCueBall, {-0.6, 0.0});
  table.place(3, {0.6, 0.0});    // blocked from the cue ball...
  table.place(12, {0.0, 0.0});   // ...by this one
  table.place(4, {-0.2, 0.42});  // an open ball near the top side pocket
  const ShotLog log = play(table, decide(table, open_table()));
  EXPECT_EQ(log.first_hit, 4);
}

TEST(Opponent, HitsItsOwnGroupOnceGroupsAreSet) {
  // Player 1 pots a stripe on the open table and keeps the turn.
  Game game = open_table();
  ShotLog pot;
  pot.first_hit = 11;
  pot.potted = {11};
  Table racked;
  game.judge(pot, racked);
  ASSERT_EQ(game.player(), 1);
  ASSERT_EQ(game.group(1), Group::Stripes);

  Table table;
  table.clear();
  table.place(kCueBall, {0.0, 0.0});
  table.place(2, {0.4, 0.1});    // a solid, sitting over a pocket
  table.place(13, {-0.5, 0.3});  // a stripe, further away
  table.place(8, {0.8, -0.3});
  const ShotLog log = play(table, decide(table, game));
  EXPECT_EQ(log.first_hit, 13);
}

TEST(Opponent, WithBallInHandPlacesTheCueBallOnTheCloth) {
  Game game = open_table();
  ShotLog scratch;
  scratch.first_hit = 3;
  scratch.cue_potted = true;
  Table table;
  table.clear();
  table.place(6, {0.5, 0.3});
  table.place(10, {-0.4, -0.2});
  game.judge(scratch, table);  // player 1 fouls: player 0 has ball in hand
  ASSERT_TRUE(game.ball_in_hand());

  const Plan plan = decide(table, game);
  EXPECT_TRUE(plan.place);
  EXPECT_LE(std::abs(plan.cue_pos.x), kLength / 2.0 - kBallRadius);
  EXPECT_LE(std::abs(plan.cue_pos.y), kWidth / 2.0 - kBallRadius);
  const ShotLog log = play(table, plan);
  EXPECT_EQ(log.potted.size(), 1U);
}

TEST(Opponent, AlwaysHasAShotEvenWhenHemmedIn) {
  Table table;
  table.clear();
  table.place(kCueBall, {0.0, 0.0});
  table.place(8, {0.5, 0.0});  // open table: the black may not be hit, so no ball is legal
  Opponent opponent;
  opponent.start(table, open_table(), {}, 1);
  EXPECT_GT(opponent.candidates(), 0);
}

TEST(Opponent, ErrorMovesTheShotOffItsPlan) {
  Table table;
  table.clear();
  table.place(kCueBall, {0.2, 0.1});
  table.place(3, {0.7, 0.33});
  Opponent opponent;
  opponent.start(table, open_table(), {.aim_error = 0.02, .speed_error = 0.1}, 3);
  while (!opponent.think(8)) {
  }
  const Plan played = opponent.plan();
  EXPECT_NE(played.shot.angle, opponent.intended().shot.angle);
  EXPECT_NEAR(played.shot.angle, opponent.intended().shot.angle, 0.1);
}

TEST(OpenShots, CountsOnlyUnblockedPots) {
  Table table;
  table.clear();
  table.place(kCueBall, {0.2, 0.1});
  table.place(3, {0.7, 0.33});
  const Game game = open_table();
  const int open = open_shots(table, game);
  EXPECT_GT(open, 0);

  table.place(12, {0.45, 0.215});  // on the line from the cue ball to the 3
  EXPECT_LT(open_shots(table, game), open + 3)
      << "the blocker adds pots of its own but hides the 3";
}

// Two computers play a whole game. It must end, and with a winner.
TEST(Opponent, TwoComputersFinishAGame) {
  for (const std::uint64_t seed : {1ULL, 2ULL, 3ULL}) {
    Table table;
    Game game;
    const Skill skill{.aim_error = 0.004, .speed_error = 0.03};
    int shots = 0;
    while (game.winner() < 0 && shots < 200) {
      Opponent opponent;
      opponent.start(table, game, skill, seed * 1000 + static_cast<std::uint64_t>(shots));
      while (!opponent.think(8)) {
      }
      const Plan plan = opponent.plan();
      if (plan.place) game.cue_ball_placed();
      const ShotLog log = play(table, plan);
      const Verdict verdict = game.judge(log, table);
      if (verdict.rerack) table.rack();
      if (!table.balls()[kCueBall].on_table && game.winner() < 0 && !game.ball_in_hand()) {
        ADD_FAILURE() << "cue ball off the table without ball in hand";
      }
      ++shots;
    }
    EXPECT_GE(game.winner(), 0) << "seed " << seed;
    EXPECT_LT(shots, 120) << "seed " << seed;
  }
}

}  // namespace
}  // namespace pool
