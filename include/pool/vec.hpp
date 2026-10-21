// A point or direction on the table, in metres.

#pragma once

#include <cmath>

namespace pool {

struct Vec2 {
  double x = 0.0;
  double y = 0.0;

  constexpr Vec2 operator+(Vec2 o) const {
    return {x + o.x, y + o.y};
  }
  constexpr Vec2 operator-(Vec2 o) const {
    return {x - o.x, y - o.y};
  }
  constexpr Vec2 operator*(double k) const {
    return {x * k, y * k};
  }
  constexpr Vec2& operator+=(Vec2 o) {
    x += o.x;
    y += o.y;
    return *this;
  }
  constexpr Vec2& operator-=(Vec2 o) {
    x -= o.x;
    y -= o.y;
    return *this;
  }
};

constexpr double dot(Vec2 a, Vec2 b) {
  return a.x * b.x + a.y * b.y;
}

inline double length(Vec2 v) {
  return std::sqrt(dot(v, v));
}

// The same direction with length 1. A zero vector stays zero.
inline Vec2 unit(Vec2 v) {
  const double len = length(v);
  return len > 0.0 ? v * (1.0 / len) : Vec2{};
}

// `v` turned a quarter turn anticlockwise.
constexpr Vec2 turned(Vec2 v) {
  return {-v.y, v.x};
}

inline Vec2 from_angle(double radians) {
  return {std::cos(radians), std::sin(radians)};
}

}  // namespace pool
