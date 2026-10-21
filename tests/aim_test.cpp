#include "pool/aim.hpp"

#include <gtest/gtest.h>

#include <cmath>
#include <numbers>
#include <vector>

namespace pool {
namespace {

constexpr double kPi = std::numbers::pi;

TEST(Aim, OpenTableReachesTheCushion) {
  Table table;
  table.clear();
  table.place(kCueBall, {0.0, 0.1});
  const Guide guide = predict(table, 0.0);
  EXPECT_EQ(guide.ball, -1);
  EXPECT_NEAR(guide.ghost.x, kLength / 2.0 - kBallRadius, 1e-12);
  EXPECT_NEAR(guide.ghost.y, 0.1, 1e-12);
  EXPECT_NEAR(guide.cue_dir.x, -1.0, 1e-12) << "comes straight back";
}

TEST(Aim, AngledShotReflectsOffTheNearerCushion) {
  Table table;
  table.clear();
  table.place(kCueBall, {0.0, 0.0});
  const Guide guide = predict(table, kPi / 4.0);  // reaches the top cushion first
  EXPECT_EQ(guide.ball, -1);
  EXPECT_NEAR(guide.ghost.y, kWidth / 2.0 - kBallRadius, 1e-12);
  EXPECT_GT(guide.cue_dir.x, 0.0);
  EXPECT_LT(guide.cue_dir.y, 0.0);
}

TEST(Aim, StraightShotStopsTheCueBall) {
  Table table;
  table.clear();
  table.place(kCueBall, {-0.5, 0.0});
  table.place(3, {0.2, 0.0});
  const Guide guide = predict(table, 0.0);
  EXPECT_EQ(guide.ball, 3);
  EXPECT_NEAR(guide.ghost.x, 0.2 - 2.0 * kBallRadius, 1e-12);
  EXPECT_NEAR(guide.object_dir.x, 1.0, 1e-12);
  EXPECT_NEAR(length(guide.cue_dir), 0.0, 1e-9);
}

TEST(Aim, PicksTheNearestBallOnTheLine) {
  Table table;
  table.clear();
  table.place(kCueBall, {-0.5, 0.0});
  table.place(3, {0.6, 0.0});
  table.place(5, {0.1, 0.01});
  table.place(7, {-0.9, 0.0});  // behind the cue ball
  EXPECT_EQ(predict(table, 0.0).ball, 5);
}

TEST(Aim, BallJustOutOfReachIsMissed) {
  Table table;
  table.clear();
  table.place(kCueBall, {-0.5, 0.0});
  table.place(3, {0.2, 2.0 * kBallRadius + 0.001});
  EXPECT_EQ(predict(table, 0.0).ball, -1);
}

TEST(Aim, NoGuideWithoutACueBall) {
  Table table;
  table.clear();
  table.place(3, {0.2, 0.0});
  EXPECT_EQ(predict(table, 0.0).ball, -1);
}

// The guide is only worth drawing if the table then does what it showed.
TEST(Aim, GuideMatchesWhatTheTableDoes) {
  for (const double offset : {-0.045, -0.02, 0.0, 0.015, 0.04}) {
    Table table;
    table.clear();
    table.place(kCueBall, {-0.4, offset});
    table.place(3, {0.1, 0.0});
    const Guide guide = predict(table, 0.0);
    ASSERT_EQ(guide.ball, 3);

    table.strike({.angle = 0.0, .speed = 2.0});
    std::vector<Event> events;
    while (events.empty()) table.advance(0.0005, events);
    const Vec2 object = unit(table.balls()[3].vel);
    EXPECT_NEAR(object.x, guide.object_dir.x, 1e-4) << "offset " << offset;
    EXPECT_NEAR(object.y, guide.object_dir.y, 1e-4) << "offset " << offset;
    if (offset != 0.0) {
      // The real cue ball keeps a sliver of forward speed, so it runs a few
      // degrees ahead of the guide's line.
      const Vec2 cue = unit(table.balls()[kCueBall].vel);
      EXPECT_GT(dot(cue, guide.cue_dir), std::cos(6.0 * kPi / 180.0)) << "offset " << offset;
    }
  }
}

// How far a path runs, point to point.
double run(const std::vector<Vec2>& path) {
  double total = 0.0;
  for (std::size_t i = 1; i < path.size(); ++i) total += length(path[i] - path[i - 1]);
  return total;
}

TEST(Preview, StopsAtTheFirstBallAndNamesIt) {
  Table table;
  table.clear();
  table.place(kCueBall, {-0.5, 0.0});
  table.place(3, {0.2, 0.0});
  const Preview p = preview(table, {.angle = 0.0, .speed = 2.0}, 0, 1.0);
  EXPECT_EQ(p.ball, 3);
  EXPECT_NEAR(p.cue_before.front().x, -0.5, 1e-12);
  EXPECT_NEAR(p.cue_before.back().x, 0.2 - 2.0 * kBallRadius, 0.01);
  EXPECT_FALSE(p.object.empty());
}

TEST(Preview, MatchesTheShotItPreviews) {
  Table table;
  table.clear();
  table.place(kCueBall, {-0.4, 0.03});
  table.place(3, {0.1, 0.0});
  const Shot shot{.angle = 0.0, .speed = 2.5, .side = 0.3, .height = -0.3};
  const Preview p = preview(table, shot, 0, 30.0);

  table.strike(shot);
  std::vector<Event> events;
  while (table.moving()) table.advance(0.004, events);
  EXPECT_NEAR(p.object.back().x, table.balls()[3].pos.x, 1e-9);
  EXPECT_NEAR(p.object.back().y, table.balls()[3].pos.y, 1e-9);
  EXPECT_NEAR(p.cue_after.back().x, table.balls()[kCueBall].pos.x, 1e-9);
  EXPECT_NEAR(p.cue_after.back().y, table.balls()[kCueBall].pos.y, 1e-9);
}

TEST(Preview, LeavesTheRealTableUntouched) {
  Table table;
  const Vec2 before = table.balls()[kCueBall].pos;
  preview(table, {.angle = 0.0, .speed = 8.0}, 0, 2.0);
  EXPECT_FALSE(table.moving());
  EXPECT_EQ(table.balls()[kCueBall].pos.x, before.x);
}

TEST(Preview, SaysWhenTheStruckBallDrops) {
  Table table;
  table.clear();
  table.place(kCueBall, {0.6, 0.06});
  // A ball on the line from the cue ball to the top right corner pocket.
  const Vec2 pocket{kLength / 2.0 - kCornerGap / 2.0, kWidth / 2.0 - kCornerGap / 2.0};
  const Vec2 line = unit(pocket - Vec2{0.6, 0.06});
  table.place(5, Vec2{0.6, 0.06} + line * 0.3);
  const Preview p = preview(table, {.angle = std::atan2(line.y, line.x), .speed = 2.0}, 0, 10.0);
  EXPECT_EQ(p.ball, 5);
  EXPECT_TRUE(p.potted);
}

TEST(Preview, WithNoBouncesAllowedEndsAtTheFirstCushion) {
  Table table;
  table.clear();
  table.place(kCueBall, {0.0, 0.0});
  table.place(3, {-0.8, 0.0});  // only reachable off the right-hand cushion
  const Preview p = preview(table, {.angle = 0.0, .speed = 4.0}, 0, 1.0);
  EXPECT_EQ(p.ball, -1);
  EXPECT_NEAR(p.cue_before.back().x, kLength / 2.0 - kBallRadius, 0.02);
}

TEST(Preview, WithOneBounceFollowsTheCueBallOffACushion) {
  Table table;
  table.clear();
  table.place(kCueBall, {0.0, 0.0});
  table.place(3, {-0.8, 0.0});
  const Preview p = preview(table, {.angle = 0.0, .speed = 4.0, .height = 0.4}, 1, 1.0);
  EXPECT_EQ(p.ball, 3);
  EXPECT_GT(run(p.cue_before), 1.8) << "out to the cushion and most of the way back";
}

TEST(Preview, SpinBendsTheCueBallsPathAfterTheHit) {
  const auto cue_after_end = [](double height) {
    Table table;
    table.clear();
    table.place(kCueBall, {-0.4, 0.0});
    table.place(3, {0.1, 0.0});
    return preview(table, {.angle = 0.0, .speed = 2.5, .height = height}, 0, 3.0)
        .cue_after.back()
        .x;
  };
  EXPECT_GT(cue_after_end(0.5), 0.25) << "follow runs on";
  EXPECT_LT(cue_after_end(-0.5), -0.1) << "draw comes back";
}

TEST(Preview, NothingToShowWithoutACueBall) {
  Table table;
  table.clear();
  EXPECT_TRUE(preview(table, {.angle = 0.0, .speed = 2.0}, 0, 1.0).cue_before.empty());
}

}  // namespace
}  // namespace pool
