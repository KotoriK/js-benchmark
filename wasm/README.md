# WebAssembly Data Transfer Benchmark

This benchmark compares three methods of transferring complex object data between WebAssembly VM and JavaScript:

1. **embind** - Using `emscripten::val` for automatic type conversion
2. **JSON** - Serializing/deserializing via [yyjson](https://github.com/ibireme/yyjson)
3. **MessagePack** - Binary serialization via a lightweight custom implementation (msgpack-lite)

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
emmake make -j$(nproc)
```

## Run Benchmark

```bash
npm run benchmark

# Or with custom iterations:
ITERATIONS=500 node benchmark.mjs
```

## Benchmark Tests

The benchmark tests various data transfer scenarios:

### 1. Flat Object Processing
- Small, medium, and large objects with primitive types
- Tests basic serialization overhead

### 2. Nested Object Processing
- Objects with varying depths (2-4 levels)
- Tests recursive structure handling

### 3. Number Array Processing
- Arrays of 100, 1000, and 10000 numbers
- Tests bulk numeric data transfer

### 4. Object Array Processing
- Arrays of 10, 100, and 500 objects
- Tests complex collection handling

### 5. Complex Tree Operations
- Creating and traversing nested tree structures
- Tests recursive creation and counting

## Project Structure

```
wasm/
├── CMakeLists.txt          # CMake build configuration
├── package.json            # Node.js dependencies and scripts
├── benchmark.mjs           # JavaScript benchmark runner
├── README.md               # This file
└── src/
    ├── benchmark_embind.cpp    # embind implementation
    ├── benchmark_json.cpp      # JSON/yyjson implementation
    └── benchmark_msgpack.cpp   # MessagePack implementation (with embedded msgpack-lite)
```

## Dependencies

Dependencies are managed via CMake FetchContent:

- **yyjson** v0.10.0 - High-performance JSON library for C
- **@msgpack/msgpack** - JavaScript MessagePack library (for serialization on JS side)

Note: The C++ MessagePack implementation uses a lightweight custom encoder/decoder
(msgpack-lite) embedded in the source to avoid external Boost dependencies.

## Results Interpretation

- **embind**: Most convenient API, automatic type conversion, excellent for small/simple objects
- **JSON**: Text-based serialization, widely supported, good for structured data with yyjson's high performance
- **MessagePack**: Binary format, smaller payload, but overhead from byte-by-byte array access

The benchmark measures:
- **Avg**: Average execution time
- **Median**: 50th percentile execution time
- **Min**: Minimum execution time
- **P95**: 95th percentile execution time (captures tail latency)

## Sample Results

Based on Node.js v20 with Emscripten 3.1.6:

| Test Case | embind (ms) | JSON (ms) | MessagePack (ms) |
|-----------|-------------|-----------|------------------|
| flat_small | 0.01 | 0.03 | 0.15 |
| flat_large | 0.01 | 0.25 | 0.81 |
| numbers_1000 | 0.21 | 0.24 | 2.66 |
| objects_100 | 0.16 | 0.16 | 3.01 |
| tree_d4_b3 | 0.29 | 0.11 | 2.20 |

Key findings:
- **embind** is fastest for most operations due to native V8 integration
- **JSON (yyjson)** performs well for complex nested structures
- **MessagePack** has higher overhead due to manual byte array handling in WASM
