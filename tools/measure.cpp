// Prints the measured side of the table in docs/DESIGN.md.

#include "pool/aim.hpp"
#include "pool/opponent.hpp"
#include "pool/rules.hpp"
#include "pool/table.hpp"

#include <algorithm>
#include <chrono>
#include <cstdint>
#include <cstdio>
#include <vector>

int main() {
  using Clock = std::chrono::steady_clock;
  std::vector<pool::Event> events;

  {
    pool::Table table;
    table.clear();
    table.place(pool::kCueBall, {-1.0, 0.0});
    table.strike(
        {.angle = 0.0, .speed = 0.5, .height = 0.4});  // slow enough to stop short of the cushion
    while (table.moving()) table.advance(0.01, events);
    std::printf("rolling distance at 0.5 m/s: %.3f m\n", table.balls()[0].pos.x + 1.0);
  }
  {
    pool::Table table;
    table.clear();
    table.place(pool::kCueBall, {-1.0, 0.0});
    table.strike({.angle = 0.0, .speed = 2.0});
    table.advance(0.35, events);
    std::printf("centre hit at 2 m/s rolls at: %.4f of starting speed\n",
                table.balls()[0].vel.x / 2.0);
  }
  {
    pool::Table table;
    table.strike({.angle = 0.02, .speed = 9.0, .side = 0.2, .height = 0.1});
    events.clear();
    double seconds = 0.0;
    const auto start = Clock::now();
    while (table.moving()) {
      table.advance(0.0005, events);
      seconds += 0.0005;
    }
    const double took = std::chrono::duration<double>(Clock::now() - start).count();
    int left = 0;
    for (const pool::Ball& b : table.balls()) left += b.on_table;
    std::printf("hard break: settles in %.1f s of table time, %zu knocks, %d balls left\n",
                seconds,
                events.size(),
                left);
    std::printf("cost: %.2f us per step, %.2f ms per second of play\n",
                took / (seconds / 0.0005) * 1e6,
                took / seconds * 1e3);
  }
  // The guide: one preview of a medium shot into the pack, as each kind of cue asks for it.
  {
    const pool::Table table;
    for (const double seconds : {2.0, 30.0}) {
      const auto start = Clock::now();
      const int runs = 200;
      std::size_t points = 0;
      for (int i = 0; i < runs; ++i) {
        points +=
            pool::preview(table, {.angle = 0.001 * i, .speed = 4.0}, 1, seconds).object.size();
      }
      const double took = std::chrono::duration<double>(Clock::now() - start).count();
      std::printf("preview following the balls for up to %.0f s: %.2f ms each (%zu points)\n",
                  seconds,
                  1e3 * took / runs,
                  points / runs);
    }
  }

  // Two computers of the same level play whole games against each other.
  std::printf(
      "\naim error   games  shots/game  shots that keep the turn  tried/decision  decide: mean, "
      "worst\n");
  for (const double degrees : {0.0, 0.15, 0.3, 0.6, 1.2, 2.4, 2.6}) {
    const pool::Skill skill{.aim_error = degrees * 3.14159265358979 / 180.0, .speed_error = 0.04};
    const int games = 40;
    int shots = 0, kept = 0, finished = 0, tried = 0;
    double thinking = 0.0, slowest = 0.0;
    for (int g = 0; g < games; ++g) {
      pool::Table table;
      pool::Game game;
      for (int shot = 0; game.winner() < 0 && shot < 300; ++shot) {
        const auto start = Clock::now();
        pool::Opponent opponent;
        opponent.start(table,
                       game,
                       skill,
                       static_cast<std::uint64_t>(g) * 1000 + static_cast<std::uint64_t>(shot));
        while (!opponent.think(8)) {
        }
        const pool::Plan plan = opponent.plan();
        const double took = std::chrono::duration<double>(Clock::now() - start).count();
        thinking += took;
        slowest = std::max(slowest, took);
        tried += opponent.candidates();

        if (plan.place) {
          table.place(pool::kCueBall, plan.cue_pos);
          game.cue_ball_placed();
        }
        table.strike(plan.shot);
        pool::ShotLog log;
        while (table.moving()) {
          events.clear();
          table.advance(0.05, events);
          for (const pool::Event& event : events) log.note(event);
        }
        const bool breaking = game.breaking();
        const pool::Verdict verdict = game.judge(log, table);
        if (verdict.rerack) table.rack();
        if (!breaking) {
          ++shots;
          kept += !verdict.turn_passes && verdict.winner < 0;
        }
      }
      finished += game.winner() >= 0;
    }
    std::printf("%5.2f deg   %2d/%2d  %10.1f  %23.0f%%  %14.1f  %6.1f ms, %5.1f ms\n",
                degrees,
                finished,
                games,
                static_cast<double>(shots) / games,
                100.0 * kept / shots,
                static_cast<double>(tried) / (shots + games),
                1e3 * thinking / (shots + games),
                1e3 * slowest);
  }
  return 0;
}
