cmake_minimum_required(VERSION 3.22)
project(pool
  VERSION 0.1.0
  DESCRIPTION "8-ball pool: a table physics engine in C++23"
  LANGUAGES CXX
)

set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(NOT CMAKE_BUILD_TYPE)
  set(CMAKE_BUILD_TYPE Release)
endif()

set(POOL_WARNINGS -Wall -Wextra -Wpedantic -Wshadow -Wconversion -Wsign-conversion -Wold-style-cast -Werror)

add_library(pool STATIC
  src/aim.cpp
  src/opponent.cpp
  src/rules.cpp
  src/table.cpp
)
target_include_directories(pool PUBLIC include)
target_compile_options(pool PRIVATE ${POOL_WARNINGS})

add_executable(measure tools/measure.cpp)
target_link_libraries(measure PRIVATE pool)
target_compile_options(measure PRIVATE ${POOL_WARNINGS})

enable_testing()
add_subdirectory(tests)
