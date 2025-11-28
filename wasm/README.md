# WebAssembly Data Transfer Benchmark

This benchmark compares methods of transferring complex object data **FROM C++ (WASM VM) TO JavaScript**.

## Methods Tested

### 1. embind (value_object)
Uses `emscripten::value_object` to register C++ structs for automatic type conversion to JavaScript.

### 2. embind (manual val)  
Uses `emscripten::val` to manually construct JavaScript objects in C++ code.

### 3. JSON (yyjson + memory access)
Serializes data to JSON string in C++ using [yyjson](https://github.com/ibireme/yyjson), transfers via direct WASM memory access using `UTF8ToString()` from preamble.js, then parses in JavaScript.

### 4. MessagePack (msgpack-c + memory access)
Serializes data to MessagePack binary in C++ using [msgpack-c](https://github.com/msgpack/msgpack-c), transfers via direct WASM memory access using `HEAPU8`, then decodes in JavaScript using [@msgpack/msgpack](https://github.com/msgpack/msgpack-javascript).

### 5. typed-cstruct (raw C struct + memory access)
Exposes raw C struct binary data in WASM memory (pointer address), JavaScript reads binary data via `HEAPU8`, then parses using [typed-cstruct](https://github.com/ssssota/typed-cstruct). This approach avoids serialization overhead by directly reading the struct layout.

## Prerequisites

- [Emscripten SDK](https://emscripten.org/docs/getting_started/downloads.html) (emcc, emcmake)
- CMake 3.14+
- Node.js 18+
- npm

## Build

```bash
# Install Node.js dependencies
npm install

# Build WebAssembly modules
npm run build

# Or manually:
mkdir -p build
cd build
emcmake cmake ..
emmake make
```

## Run Benchmark

```bash
npm run benchmark

# Or with custom iterations:
ITERATIONS=500 node benchmark.mjs
```

## GitHub Actions

This repository includes GitHub Actions workflows to:
- **Build and run benchmarks** automatically on push/PR
- **Publish results to GitHub Pages** for easy viewing

The workflow runs on:
- Push to main/master branch
- Pull requests
- Manual trigger (workflow_dispatch)

Results are available at: `https://<username>.github.io/<repo>/`

## Benchmark Tests

The benchmark tests various data transfer scenarios (all data generated in C++):

### 1. Flat Object
- Objects with varying string lengths (10, 100, 1000 chars)
- Tests basic serialization overhead

### 2. Nested Object  
- Objects with nested arrays of items (10, 50, 100 items)
- Tests structure traversal overhead

### 3. Number Array
- Arrays of 100, 1000, 10000 numbers
- Tests bulk numeric data transfer

### 4. Object Array
- Arrays of 10, 100, 500 objects
- Tests complex collection handling

### 5. Tree Structure
- Recursive tree structures with varying depth and breadth
- Tests deep nesting transfer

## Project Structure

```
wasm/
├── CMakeLists.txt          # CMake build configuration
├── package.json            # Node.js dependencies and scripts
├── benchmark.mjs           # JavaScript benchmark runner
├── README.md               # This file
└── src/
    ├── benchmark_embind.cpp    # embind implementation (value_object + manual val)
    ├── benchmark_json.cpp      # JSON/yyjson implementation (memory access)
    ├── benchmark_msgpack.cpp   # MessagePack/msgpack-c implementation (memory access)
    └── benchmark_cstruct.cpp   # typed-cstruct implementation (raw C struct memory access)
```

## Key Design Decisions

- **Data flow**: C++ → JS (not JS → C++)
- **embind tests both**: `value_object` AND manual `val::set()`
- **JSON/MessagePack/typed-cstruct**: Use preamble.js APIs (`UTF8ToString`, `HEAPU8`) for direct memory access, not embind

## Dependencies

C++ dependencies managed via CMake FetchContent:
- **yyjson** v0.10.0 - High-performance JSON library for C
- **msgpack-c** cpp-6.1.1 - MessagePack implementation for C++ (header-only)

JavaScript dependencies:
- **@msgpack/msgpack** - MessagePack decoder for JavaScript
- **typed-cstruct** - C struct binary parser for JavaScript

## Results Interpretation

The benchmark measures time for:
- **Avg**: Average execution time
- **Median**: 50th percentile execution time  
- **Min**: Minimum execution time
- **P95**: 95th percentile execution time (captures tail latency)
