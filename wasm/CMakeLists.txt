cmake_minimum_required(VERSION 3.14)
project(wasm_benchmark VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# Include FetchContent for dependency management
include(FetchContent)

# Fetch yyjson
FetchContent_Declare(
    yyjson
    GIT_REPOSITORY https://github.com/ibireme/yyjson.git
    GIT_TAG 0.10.0
)
FetchContent_MakeAvailable(yyjson)

# Fetch msgpack-c (header-only for C++)
FetchContent_Declare(
    msgpack
    GIT_REPOSITORY https://github.com/msgpack/msgpack-c.git
    GIT_TAG cpp-6.1.1
)
FetchContent_MakeAvailable(msgpack)

# Common emscripten settings
set(EMSCRIPTEN_COMMON_FLAGS
    "-sENVIRONMENT=node"
    "-sMODULARIZE=1"
    "-sEXPORT_ES6=1"
    "-sALLOW_MEMORY_GROWTH=1"
    "-sSTACK_SIZE=1mb"
    "-O3"
)

# embind benchmark module
add_executable(benchmark_embind src/benchmark_embind.cpp)
target_link_libraries(benchmark_embind PRIVATE embind)
set_target_properties(benchmark_embind PROPERTIES
    OUTPUT_NAME "benchmark_embind"
    SUFFIX ".mjs"
)
target_link_options(benchmark_embind PRIVATE
    ${EMSCRIPTEN_COMMON_FLAGS}
    "-sEXPORT_NAME=createEmbindModule"
)

# JSON (yyjson) benchmark module
add_executable(benchmark_json src/benchmark_json.cpp)
target_link_libraries(benchmark_json PRIVATE yyjson embind)
set_target_properties(benchmark_json PROPERTIES
    OUTPUT_NAME "benchmark_json"
    SUFFIX ".mjs"
)
target_link_options(benchmark_json PRIVATE
    ${EMSCRIPTEN_COMMON_FLAGS}
    "-sEXPORT_NAME=createJsonModule"
    "-sEXPORTED_FUNCTIONS=['_malloc','_free']"
    "-sEXPORTED_RUNTIME_METHODS=['UTF8ToString','stringToUTF8','lengthBytesUTF8','getValue','setValue']"
)

# MessagePack benchmark module  
add_executable(benchmark_msgpack src/benchmark_msgpack.cpp)
target_link_libraries(benchmark_msgpack PRIVATE embind)
target_include_directories(benchmark_msgpack PRIVATE ${msgpack_SOURCE_DIR}/include)
set_target_properties(benchmark_msgpack PROPERTIES
    OUTPUT_NAME "benchmark_msgpack"
    SUFFIX ".mjs"
)
target_link_options(benchmark_msgpack PRIVATE
    ${EMSCRIPTEN_COMMON_FLAGS}
    "-sEXPORT_NAME=createMsgpackModule"
    "-sEXPORTED_FUNCTIONS=['_malloc','_free']"
    "-sEXPORTED_RUNTIME_METHODS=['HEAPU8']"
)
