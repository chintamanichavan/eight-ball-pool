#include "pool/opponent.hpp"

#include <algorithm>
#include <array>
#include <cmath>
#include <numbers>

namespace pool {
namespace {

constexpr double kHalfLength = kLength / 2.0;
constexpr double kHalfWidth = kWidth / 2.0;

// The middle of each pocket's mouth: where a ball should be sent.
constexpr std::array<Vec2, 6> kPockets{{
    {-kHalfLength + kCornerGap / 2.0, -kHalfWidth + kCornerGap / 2.0},
    {-kHalfLength + kCornerGap / 2.0, kHalfWidth - kCornerGap / 2.0},
    {kHalfLength - kCornerGap / 2.0, -kHalfWidth + kCornerGap / 2.0},
    {kHalfLength - kCornerGap / 2.0, kHalfWidth - kCornerGap / 2.0},
    {0.0, -kHalfWidth},
    {0.0, kHalfWidth},
}};

// A cut thinner than this is too easy to miss to be worth planning.
const double kThinnestCut = std::cos(68.0 * std::numbers::pi / 180.0);
// A ball sent along the cushion towards a side pocket hits the far jaw.
constexpr double kSidePocketSteepness = 0.45;

constexpr double kFastestPlanned = 6.0;
// With ball in hand, how far behind the contact point the cue ball is put.
constexpr double kPlacingDistance = 0.3;
// No shot takes longer than this to settle; it stops a runaway play-out.
constexpr double kLongestShot = 30.0;

// How far `point` is from the straight path between `from` and `to`.
double distance_to_path(Vec2 point, Vec2 from, Vec2 to) {
  const Vec2 path = to - from;
  const double along = std::clamp(dot(point - from, path) / dot(path, path), 0.0, 1.0);
  return length(point - (from + path * along));
}

// True if a ball can travel from `from` to `to` without touching any ball
// other than `a` and `b`.
bool path_clear(const Table& table, Vec2 from, Vec2 to, std::size_t a, std::size_t b) {
  for (std::size_t i = 0; i < kBalls; ++i) {
    const Ball& ball = table.balls()[i];
    if (i == a || i == b || !ball.on_table) continue;
    if (distance_to_path(ball.pos, from, to) < 2.0 * kBallRadius) return false;
  }
  return true;
}

// A straight pot: where the cue ball must be when it touches `ball` to send it
// to `pocket`. False if the ball cannot reach that pocket.
bool contact_point(
    const Table& table, std::size_t ball, Vec2 pocket, Vec2& ghost, Vec2& to_pocket) {
  const Vec2 pos = table.balls()[ball].pos;
  to_pocket = unit(pocket - pos);
  if (pocket.x == 0.0 && std::abs(to_pocket.y) < kSidePocketSteepness) return false;
  if (!path_clear(table, pos, pocket, ball, ball)) return false;
  ghost = pos - to_pocket * (2.0 * kBallRadius);
  return true;
}

// Whether the cue ball at `cue` can make the pot described by `ghost`.
bool can_reach(const Table& table, Vec2 cue, std::size_t ball, Vec2 ghost, Vec2 to_pocket) {
  const Vec2 aim = unit(ghost - cue);
  return dot(aim, to_pocket) > kThinnestCut && path_clear(table, cue, ghost, kCueBall, ball);
}

// Fast enough to reach the pocket with a little to spare; more for a thin cut,
// which passes less of its speed to the struck ball.
double speed_for(double cue_run, double ball_run, double fullness) {
  return std::min(kFastestPlanned, (0.9 + 1.3 * (cue_run + ball_run)) / std::max(fullness, 0.35));
}

// Every ball the player to shoot may hit, paired with every pocket it can reach.
template <typename Visit>
void for_each_pot(const Table& table, const Game& game, Visit&& visit) {
  for (std::size_t ball = 1; ball < kBalls; ++ball) {
    if (!table.balls()[ball].on_table || !game.may_hit_first(static_cast<int>(ball), table))
      continue;
    for (const Vec2 pocket : kPockets) {
      Vec2 ghost;
      Vec2 to_pocket;
      if (contact_point(table, ball, pocket, ghost, to_pocket))
        visit(ball, pocket, ghost, to_pocket);
    }
  }
}

Plan make_plan(bool place, Vec2 cue_pos, Vec2 aim, double speed) {
  Plan plan;
  plan.place = place;
  plan.cue_pos = cue_pos;
  plan.shot.angle = std::atan2(aim.y, aim.x);
  plan.shot.speed = speed;
  return plan;
}

}  // namespace

int open_shots(const Table& table, const Game& game) {
  const Ball& cue = table.balls()[kCueBall];
  if (!cue.on_table) return 0;
  int count = 0;
  for_each_pot(table, game, [&](std::size_t ball, Vec2, Vec2 ghost, Vec2 to_pocket) {
    count += can_reach(table, cue.pos, ball, ghost, to_pocket);
  });
  return count;
}

void Opponent::start(const Table& table, const Game& game, Skill skill, std::uint64_t seed) {
  table_ = table;
  game_ = game;
  skill_ = skill;
  rng_.seed(seed);
  candidates_.clear();
  by_geometry_.clear();
  next_ = 0;
  best_ = Plan{};
  best_score_ = -1e300;

  const Ball& cue = table_.balls()[kCueBall];
  const bool in_hand = game_.ball_in_hand() || !cue.on_table;

  if (game_.breaking()) {
    // Hit the head ball a little off centre, hard.
    const Vec2 head = table_.balls()[1].pos + Vec2{0.0, 0.004};
    add(make_plan(false, cue.pos, head - cue.pos, skill_.break_speed), 0.0);
    return;
  }

  for_each_pot(table_, game_, [&](std::size_t ball, Vec2 pocket, Vec2 ghost, Vec2 to_pocket) {
    // With ball in hand, set the pot up dead straight from close range.
    const Vec2 from = in_hand ? ghost - to_pocket * kPlacingDistance : cue.pos;
    if (in_hand && !table_.can_place(kCueBall, from)) return;
    if (!can_reach(table_, from, ball, ghost, to_pocket)) return;

    const Vec2 aim = ghost - from;
    const double fullness = dot(unit(aim), to_pocket);
    const double speed =
        speed_for(length(aim), length(pocket - table_.balls()[ball].pos), fullness);
    // Without playing shots out, the fullest pot at the planned pace is the best guess.
    add(make_plan(in_hand, from, aim, speed), fullness);
    add(make_plan(in_hand, from, aim, std::min(kFastestPlanned, speed * 1.5)), fullness - 1.0);
  });

  // Always have a legal shot to fall back on: roll up to each ball that may
  // be hit. When no pot is on, the best of these is a safety.
  const Vec2 from = in_hand ? Vec2{-kLength / 4.0, 0.0} : cue.pos;
  for (std::size_t ball = 1; ball < kBalls; ++ball) {
    const Ball& target = table_.balls()[ball];
    if (!target.on_table || !game_.may_hit_first(static_cast<int>(ball), table_)) continue;
    if (in_hand && !table_.can_place(kCueBall, from)) continue;
    const Vec2 aim = target.pos - from;
    add(make_plan(in_hand, from, aim, 0.9 + 1.2 * length(aim)), -2.0 - length(aim));
  }

  // Hemmed in, with no ball in a straight line: try the whole circle.
  if (candidates_.empty()) {
    for (int i = 0; i < 24; ++i) {
      add(make_plan(in_hand, from, from_angle(i * 2.0 * std::numbers::pi / 24.0), 2.5), -10.0 - i);
    }
  }
}

// Plays `plan` out on a copy of the table and scores how it leaves the game.
double Opponent::play_out(const Plan& plan) const {
  Table table = table_;
  Game game = game_;
  const int me = game.player();
  if (plan.place) {
    table.place(kCueBall, plan.cue_pos);
    game.cue_ball_placed();
  }
  table.strike(plan.shot);

  std::vector<Event> events;
  ShotLog log;
  for (double elapsed = 0.0; table.moving() && elapsed < kLongestShot; elapsed += 0.05) {
    events.clear();
    table.advance(0.05, events);
    for (const Event& event : events) log.note(event);
  }

  const Verdict verdict = game.judge(log, table);
  if (verdict.winner == me) return 1e6;
  if (verdict.winner >= 0) return -1e6;
  if (verdict.rerack) return 0.0;
  if (verdict.foul != Foul::None) return -500.0;
  const bool position = skill_.mind == Mind::Position;
  if (!verdict.turn_passes) {
    // Kept the turn: worth more with another pot on afterwards.
    return 100.0 + 10.0 * static_cast<double>(log.potted.size()) +
           (position ? 6.0 * std::min(open_shots(table, game), 4) : 0.0);
  }
  // Missed: the fewer pots left for the other player, the better.
  return -20.0 - (position ? 8.0 * std::min(open_shots(table, game), 6) : 0.0);
}

void Opponent::add(const Plan& plan, double by_geometry) {
  candidates_.push_back(plan);
  by_geometry_.push_back(by_geometry);
}

bool Opponent::think(int shots) {
  for (; shots > 0 && next_ < candidates_.size(); --shots, ++next_) {
    const double score =
        skill_.mind == Mind::Geometry ? by_geometry_[next_] : play_out(candidates_[next_]);
    if (score > best_score_) {
      best_score_ = score;
      best_ = candidates_[next_];
    }
  }
  return next_ >= candidates_.size();
}

Plan Opponent::plan() {
  Plan played = best_;
  std::normal_distribution<double> error(0.0, 1.0);
  played.shot.angle += skill_.aim_error * error(rng_);
  played.shot.speed *= std::max(0.3, 1.0 + skill_.speed_error * error(rng_));
  return played;
}

}  // namespace pool
