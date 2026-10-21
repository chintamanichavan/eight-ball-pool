include(FetchContent)

FetchContent_Declare(
  googletest
  GIT_REPOSITORY https://github.com/google/googletest.git
  GIT_TAG        v1.15.2
)
set(BUILD_GMOCK   OFF CACHE BOOL "" FORCE)
set(INSTALL_GTEST OFF CACHE BOOL "" FORCE)
FetchContent_MakeAvailable(googletest)

add_executable(pool_tests
  aim_test.cpp
  opponent_test.cpp
  rules_test.cpp
  table_test.cpp
)
target_link_libraries(pool_tests PRIVATE pool GTest::gtest_main)
target_compile_options(pool_tests PRIVATE ${POOL_WARNINGS})

include(GoogleTest)
gtest_discover_tests(pool_tests)
