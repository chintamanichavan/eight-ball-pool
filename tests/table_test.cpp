#include "pool/table.hpp"

#include <gtest/gtest.h>

#include <cmath>
#include <numbers>
#include <vector>

namespace pool {
namespace {

constexpr double kPi = std::numbers::pi;

// The tip height that sends a ball off already rolling, with no skid.
constexpr double kRollingHit = 0.4;

// Runs the table until every ball is at rest. Returns the time it took.
double settle(Table& table, std::vector<Event>& events, double limit = 60.0) {
  double elapsed = 0.0;
  while (table.moving() && elapsed < limit) {
    table.advance(0.01, events);
    elapsed += 0.01;
  }
  return elapsed;
}

const Ball& cue(const Table& table) {
  return table.balls()[kCueBall];
}

TEST(Table, StartsRackedAndStill) {
  const Table table;
  int on_table = 0;
  for (const Ball& b : table.balls()) on_table += b.on_table;
  EXPECT_EQ(on_table, 16);
  EXPECT_FALSE(table.moving());
  EXPECT_DOUBLE_EQ(cue(table).pos.x, -kLength / 4.0);
  EXPECT_DOUBLE_EQ(table.balls()[1].pos.x, kLength / 4.0) << "the front ball sits on the foot spot";
}

TEST(Table, NoTwoRackedBallsOverlap) {
  const Table table;
  for (std::size_t i = 0; i < kBalls; ++i) {
    for (std::size_t j = i + 1; j < kBalls; ++j) {
      EXPECT_GE(length(table.balls()[i].pos - table.balls()[j].pos), 2.0 * kBallRadius);
    }
  }
}

// Predicted: speed² ÷ (2 × rolling drag × g).
TEST(Table, RollingBallStopsWherePhysicsSays) {
  Table table;
  table.clear();
  table.place(kCueBall, {-1.0, 0.0});
  const double speed = 0.5;
  table.strike({.angle = 0.0, .speed = speed, .height = kRollingHit});

  std::vector<Event> events;
  settle(table, events);
  const double predicted = speed * speed / (2.0 * kRollDrag * kGravity);
  EXPECT_NEAR(cue(table).pos.x - -1.0, predicted, 0.01 * predicted);
  EXPECT_TRUE(events.empty());
}

// Predicted: a ball hit dead centre ends up rolling at 5/7 of its starting speed.
TEST(Table, CentreHitSettlesIntoARollAtFiveSevenths) {
  Table table;
  table.clear();
  table.place(kCueBall, {-1.0, 0.0});
  const double speed = 2.0;
  table.strike({.angle = 0.0, .speed = speed});

  std::vector<Event> events;
  // Skidding lasts 2v ÷ (7 × drag × g), about 0.29 s here.
  table.advance(0.35, events);
  const Ball& ball = cue(table);
  EXPECT_NEAR(ball.vel.x, speed * 5.0 / 7.0, 0.02);
  EXPECT_NEAR(ball.roll_spin.y * kBallRadius, ball.vel.x, 1e-9) << "rolling: no slip on the cloth";
}

TEST(Table, BallRunsStraight) {
  Table table;
  table.clear();
  table.place(kCueBall, {-0.5, 0.1});
  table.strike({.angle = 0.0, .speed = 1.0});
  std::vector<Event> events;
  settle(table, events);
  EXPECT_NEAR(cue(table).pos.y, 0.1, 1e-9);
}

// Predicted: the cue ball keeps (1 − bounce) ÷ 2 of its speed.
TEST(Table, StopShotLeavesTheCueBallNearlyDead) {
  Table table;
  table.clear();
  table.place(kCueBall, {-0.2, 0.0});
  table.place(1, {0.0, 0.0});
  const double speed = 3.0;
  table.strike(
      {.angle = 0.0, .speed = speed});  // centre hit: still skidding with no spin on arrival

  std::vector<Event> events;
  while (events.empty()) table.advance(0.0005, events);
  ASSERT_EQ(events.front().kind, EventKind::BallHit);
  const double arriving = events.front().strength;
  EXPECT_NEAR(length(cue(table).vel), arriving * (1.0 - kBallBounce) / 2.0, 1e-6);
  EXPECT_NEAR(table.balls()[1].vel.x, arriving * (1.0 + kBallBounce) / 2.0, 1e-6);

  const double hit_at = cue(table).pos.x;
  settle(table, events);
  EXPECT_LT(cue(table).pos.x - hit_at, 0.02)
      << "the cue ball creeps forward less than a ball's width";
}

TEST(Table, FollowShotRollsOnAfterTheHit) {
  Table table;
  table.clear();
  table.place(kCueBall, {-0.3, 0.0});
  table.place(1, {0.0, 0.0});
  table.strike({.angle = 0.0, .speed = 2.0, .height = 0.5});
  std::vector<Event> events;
  settle(table, events);
  EXPECT_GT(cue(table).pos.x, 0.15)
      << "top spin carries the cue ball past where the object ball stood";
}

TEST(Table, DrawShotComesBack) {
  Table table;
  table.clear();
  table.place(kCueBall, {-0.3, 0.0});
  table.place(1, {0.0, 0.0});
  table.strike({.angle = 0.0, .speed = 3.0, .height = -0.5});
  std::vector<Event> events;
  settle(table, events);
  EXPECT_LT(cue(table).pos.x, -0.3) << "back spin pulls the cue ball back past where it started";
}

// Predicted: the struck ball leaves along the line of centres. The cue ball
// keeps all of its speed across that line and (1 − bounce) ÷ 2 of its speed
// along it, so the two part at a little under 90°, least on a full hit.
TEST(Table, CutShotSendsTheBallAlongTheLineOfCentres) {
  for (const double cut_degrees : {15.0, 30.0, 45.0, 60.0}) {
    Table table;
    table.clear();
    const double cut = cut_degrees * kPi / 180.0;
    // Aim along x at the point where the cue ball must be to send the object
    // ball off at `cut` to the left.
    const Vec2 object{0.0, 0.0};
    const Vec2 ghost = object - from_angle(cut) * (2.0 * kBallRadius);
    table.place(kCueBall, {ghost.x - 0.3, ghost.y});
    table.place(1, object);
    table.strike({.angle = 0.0, .speed = 2.0});

    std::vector<Event> events;
    while (events.empty()) table.advance(0.0005, events);
    const Vec2 object_dir = unit(table.balls()[1].vel);
    const Vec2 cue_dir = unit(cue(table).vel);
    const double object_angle = std::atan2(object_dir.y, object_dir.x) * 180.0 / kPi;
    const double parting = std::acos(dot(object_dir, cue_dir)) * 180.0 / kPi;

    const double kept = (1.0 - kBallBounce) / 2.0;
    const double predicted_parting = std::atan2(std::sin(cut), kept * std::cos(cut)) * 180.0 / kPi;

    EXPECT_NEAR(object_angle, cut_degrees, 0.01) << "cut " << cut_degrees;
    EXPECT_NEAR(parting, predicted_parting, 0.01) << "cut " << cut_degrees;
    EXPECT_GT(parting, 84.0) << "cut " << cut_degrees;
  }
}

TEST(Table, CushionReturnsTheBallSlower) {
  Table table;
  table.clear();
  table.place(kCueBall, {0.9, 0.0});
  table.strike({.angle = 0.0, .speed = 1.0, .height = kRollingHit});
  std::vector<Event> events;
  while (events.empty()) table.advance(0.0005, events);
  ASSERT_EQ(events.front().kind, EventKind::CushionHit);
  EXPECT_NEAR(cue(table).vel.x, -kCushionBounce * events.front().strength, 1e-9);
  EXPECT_LE(cue(table).pos.x, kLength / 2.0 - kBallRadius + 1e-12);
}

TEST(Table, SideSpinPullsTheBallAlongTheCushion) {
  const auto rebound_y = [](double side) {
    Table table;
    table.clear();
    table.place(kCueBall, {0.8, 0.0});
    table.strike({.angle = 0.0, .speed = 2.0, .side = side});
    std::vector<Event> events;
    while (events.empty()) table.advance(0.0005, events);
    return table.balls()[kCueBall].vel.y;
  };
  EXPECT_NEAR(rebound_y(0.0), 0.0, 1e-12);
  // The cue is aimed along +x, so the shooter's right is −y. Striking the right
  // side of the ball makes it come off the cushion to the right.
  EXPECT_LT(rebound_y(0.4), -0.05);
  EXPECT_GT(rebound_y(-0.4), 0.05);
  EXPECT_NEAR(rebound_y(0.4), -rebound_y(-0.4), 1e-12);
}

TEST(Table, BallShotAtACornerPocketDrops) {
  Table table;
  table.clear();
  table.place(kCueBall, {0.6, 0.06});
  const double angle = std::atan2(kWidth / 2.0 - 0.06, kLength / 2.0 - 0.6);
  table.strike({.angle = angle, .speed = 1.5, .height = kRollingHit});
  std::vector<Event> events;
  settle(table, events);
  EXPECT_FALSE(cue(table).on_table);
  ASSERT_FALSE(events.empty());
  EXPECT_EQ(events.back().kind, EventKind::Pocketed);
  EXPECT_FALSE(table.moving());
}

TEST(Table, BallShotAtASidePocketDrops) {
  Table table;
  table.clear();
  table.place(kCueBall, {0.0, 0.0});
  table.strike({.angle = kPi / 2.0, .speed = 1.0, .height = kRollingHit});
  std::vector<Event> events;
  settle(table, events);
  EXPECT_FALSE(cue(table).on_table);
}

TEST(Table, BallHittingAJawDoesNotPassThroughTheCushion) {
  Table table;
  table.clear();
  // Aimed at the end of the top cushion beside the side pocket.
  table.place(kCueBall, {kSideGap + 0.02, 0.0});
  table.strike({.angle = kPi / 2.0, .speed = 2.0});
  std::vector<Event> events;
  settle(table, events);
  ASSERT_FALSE(events.empty());
  EXPECT_EQ(events.front().kind, EventKind::CushionHit);
}

TEST(Table, BallCanOnlyBePlacedOnFreeCloth) {
  Table table;
  table.clear();
  table.place(3, {0.2, 0.0});
  EXPECT_TRUE(table.can_place(kCueBall, {-0.3, 0.1}));
  EXPECT_FALSE(table.can_place(kCueBall, {0.2 + kBallRadius, 0.0})) << "overlaps the 3";
  EXPECT_FALSE(table.can_place(kCueBall, {kLength / 2.0, 0.0})) << "in the cushion";
  EXPECT_TRUE(table.can_place(3, {0.2, 0.0})) << "a ball does not block itself";
}

TEST(Table, StrikingAPocketedCueBallDoesNothing) {
  Table table;
  table.clear();
  table.strike({.angle = 0.0, .speed = 3.0});
  EXPECT_FALSE(table.moving());
}

// Friction and bounces only ever take energy away.
TEST(Table, EnergyNeverRisesDuringABreak) {
  Table table;
  table.strike({.angle = 0.02, .speed = 9.0, .side = 0.2, .height = 0.1});
  std::vector<Event> events;
  double before = table.energy();
  double elapsed = 0.0;
  while (table.moving() && elapsed < 60.0) {
    table.advance(0.0005, events);
    elapsed += 0.0005;
    const double now = table.energy();
    ASSERT_LE(now, before + 1e-9) << "at " << elapsed << " s";
    before = now;
  }
  EXPECT_FALSE(table.moving());
  EXPECT_LT(elapsed, 15.0) << "a hard break settles in under 15 seconds";
  EXPECT_GT(events.size(), 20U);
}

TEST(Table, BallsStayOnTheClothOrDrop) {
  Table table;
  table.strike({.angle = 0.0, .speed = 9.0});
  std::vector<Event> events;
  settle(table, events);
  for (const Ball& b : table.balls()) {
    if (!b.on_table) continue;
    EXPECT_LE(std::abs(b.pos.x), kLength / 2.0 - kBallRadius + 1e-6);
    EXPECT_LE(std::abs(b.pos.y), kWidth / 2.0 - kBallRadius + 1e-6);
  }
}

TEST(Table, SameShotGivesTheSameResult) {
  Table a;
  Table b;
  const Shot shot{.angle = 0.03, .speed = 8.0, .side = 0.3, .height = -0.2};
  a.strike(shot);
  b.strike(shot);
  std::vector<Event> ea;
  std::vector<Event> eb;
  // Different frame times must not change the outcome.
  for (int i = 0; i < 2000; ++i) a.advance(0.01, ea);
  for (int i = 0; i < 1250; ++i) b.advance(0.016, eb);
  for (std::size_t i = 0; i < kBalls; ++i) {
    EXPECT_EQ(a.balls()[i].on_table, b.balls()[i].on_table);
    EXPECT_DOUBLE_EQ(a.balls()[i].pos.x, b.balls()[i].pos.x);
    EXPECT_DOUBLE_EQ(a.balls()[i].pos.y, b.balls()[i].pos.y);
  }
}

}  // namespace
}  // namespace pool
