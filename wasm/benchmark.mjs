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
 * Each benchmark type runs in a separate process to reduce memory overhead.
 * 
 * Run: node benchmark.mjs
 */

import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BENCHMARKS_DIR = join(__dirname, 'benchmarks');

// List of benchmark files to run sequentially
const benchmarkFiles = [
    'flat.mjs',
    'nested.mjs',
    'numbers.mjs',
    'objects.mjs',
    'tree.mjs'
];

/**
 * Run a benchmark file as a child process
 * @param {string} filename - The benchmark file to run
 * @returns {Promise<void>}
 */
function runBenchmark(filename) {
    return new Promise((resolve, reject) => {
        const filePath = join(BENCHMARKS_DIR, filename);
        const child = spawn('node', [filePath], {
            stdio: 'inherit',
            env: process.env
        });

        child.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Benchmark ${filename} exited with code ${code}`));
            }
        });

        child.on('error', (err) => {
            reject(err);
        });
    });
}

async function main() {
    console.log('WebAssembly Data Transfer Benchmark');
    console.log('===================================\n');
    console.log('Running benchmarks sequentially to reduce memory overhead...\n');

    for (const file of benchmarkFiles) {
        console.log(`\n${'#'.repeat(60)}`);
        console.log(`# Running: ${file}`);
        console.log(`${'#'.repeat(60)}\n`);
        
        try {
            await runBenchmark(file);
        } catch (err) {
            console.error(`Failed to run ${file}:`, err.message);
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('All benchmarks completed!');
    console.log('='.repeat(60));
}

main().catch(console.error);

