#!/usr/bin/env node
/**
 * @file benchmark.mjs
 * @description WebAssembly Data Transfer Benchmark Runner
 * 
 * This script benchmarks data transfer FROM C++ (WASM) TO JavaScript using several methods:
 * 
 * 1. embind (value_object): Register C++ structs with embind for automatic conversion
 * 2. embind (manual val): Build JS objects manually using emscripten::val in C++
 * 3. JSON: Serialize in C++, transfer raw string via WASM memory, parse in JS
 * 4. MessagePack: Serialize in C++, transfer raw bytes via WASM memory, decode in JS
 * 5. typed-cstruct: Read raw C struct binary from WASM memory, parse in JS with typed-cstruct
 * 
 * Benchmarks are organized by C++ implementation (benchmark_embind.cpp, benchmark_json.cpp, etc.)
 * 
 * Run: node benchmark.mjs
 */

import { runEmbindBenchmarks } from './benchmarks/benchmark_embind.mjs';
import { runJsonBenchmarks } from './benchmarks/benchmark_json.mjs';
import { runMsgpackBenchmarks } from './benchmarks/benchmark_msgpack.mjs';
import { runCStructBenchmarks } from './benchmarks/benchmark_cstruct.mjs';
import { getSystemInfo } from './benchmarks/utils.mjs';

async function main() {
    console.log('WebAssembly Data Transfer Benchmark');
    console.log('===================================');
    console.log('NOTE: Testing C++ → JS data transfer (data generated in WASM)\n');
    
    const iterations = parseInt(process.env.ITERATIONS || '100', 10);
    console.log(`Running ${iterations} iterations per benchmark...\n`);

    // Display system information
    const sysInfo = getSystemInfo();
    console.log('System Information:');
    console.log(`  Platform: ${sysInfo.platform} (${sysInfo.arch})`);
    console.log(`  Node.js: ${sysInfo.nodeVersion}`);
    console.log(`  CPU: ${sysInfo.cpuCores}x ${sysInfo.cpuModel}`);
    console.log(`  Memory: ${sysInfo.totalMemoryGB} GB total, ${sysInfo.freeMemoryGB} GB free\n`);

    console.log('Loading WebAssembly modules...\n');
    
    // Run benchmarks organized by C++ implementation
    await runEmbindBenchmarks(iterations);
    await runJsonBenchmarks(iterations);
    await runMsgpackBenchmarks(iterations);
    await runCStructBenchmarks(iterations);
    
    console.log('\n' + '='.repeat(60));
    console.log('All benchmarks completed!');
    console.log('='.repeat(60));
}

main().catch(console.error);

