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

# Fetch msgpack-c (header-only C++ library)
FetchContent_Declare(
    msgpack-c
    GIT_REPOSITORY https://github.com/msgpack/msgpack-c.git
    GIT_TAG cpp-6.1.1
)
# msgpack-c is header-only for C++, just need the headers
FetchContent_GetProperties(msgpack-c)
if(NOT msgpack-c_POPULATED)
    FetchContent_Populate(msgpack-c)
endif()

# Common emscripten settings
set(EMSCRIPTEN_COMMON_FLAGS
    "-sENVIRONMENT=node"
    "-sMODULARIZE=1"
    "-sALLOW_MEMORY_GROWTH=1"
    "-O3"
)

# embind benchmark module - uses embind for value_object and manual val
add_executable(benchmark_embind src/benchmark_embind.cpp)
target_link_libraries(benchmark_embind PRIVATE embind)
set_target_properties(benchmark_embind PROPERTIES
    OUTPUT_NAME "benchmark_embind"
    SUFFIX ".cjs"
)
target_link_options(benchmark_embind PRIVATE
    ${EMSCRIPTEN_COMMON_FLAGS}
    "-sEXPORT_NAME=createEmbindModule"
)

# JSON (yyjson) benchmark module - uses direct memory access, NO embind
add_executable(benchmark_json src/benchmark_json.cpp)
target_link_libraries(benchmark_json PRIVATE yyjson)
set_target_properties(benchmark_json PROPERTIES
    OUTPUT_NAME "benchmark_json"
    SUFFIX ".cjs"
)
target_link_options(benchmark_json PRIVATE
    ${EMSCRIPTEN_COMMON_FLAGS}
    "-sEXPORT_NAME=createJsonModule"
    "-sEXPORTED_FUNCTIONS=['_generateFlatJSON','_getLastJSONLength','_generateNestedJSON','_generateNumberArrayJSON','_generateObjectArrayJSON','_generateTreeJSON']"
    "-sEXPORTED_RUNTIME_METHODS=['UTF8ToString','cwrap']"
)

# MessagePack benchmark module - uses msgpack-c, direct memory access, NO embind
add_executable(benchmark_msgpack src/benchmark_msgpack.cpp)
target_include_directories(benchmark_msgpack PRIVATE ${msgpack-c_SOURCE_DIR}/include)
target_compile_definitions(benchmark_msgpack PRIVATE MSGPACK_NO_BOOST)
set_target_properties(benchmark_msgpack PROPERTIES
    OUTPUT_NAME "benchmark_msgpack"
    SUFFIX ".cjs"
)
target_link_options(benchmark_msgpack PRIVATE
    ${EMSCRIPTEN_COMMON_FLAGS}
    "-sEXPORT_NAME=createMsgpackModule"
    "-sEXPORTED_FUNCTIONS=['_generateFlatMsgpack','_getLastMsgpackLength','_generateNestedMsgpack','_generateNumberArrayMsgpack','_generateObjectArrayMsgpack','_generateTreeMsgpack']"
    "-sEXPORTED_RUNTIME_METHODS=['HEAPU8','cwrap']"
)

# typed-cstruct benchmark module - uses raw C structs, direct memory access, NO embind
# JavaScript reads raw struct binary data and parses with typed-cstruct library
add_executable(benchmark_cstruct src/benchmark_cstruct.cpp)
set_target_properties(benchmark_cstruct PROPERTIES
    OUTPUT_NAME "benchmark_cstruct"
    SUFFIX ".cjs"
)
target_link_options(benchmark_cstruct PRIVATE
    ${EMSCRIPTEN_COMMON_FLAGS}
    "-sEXPORT_NAME=createCStructModule"
    "-sEXPORTED_FUNCTIONS=['_generateFlatCStruct','_getLastCStructLength','_generateNestedCStruct','_generateNumberArrayCStruct','_generateObjectArrayCStruct','_generateTreeCStruct']"
    "-sEXPORTED_RUNTIME_METHODS=['HEAPU8','cwrap']"
)
