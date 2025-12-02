/**
 * @file utils.mjs
 * @description Shared utilities for WebAssembly benchmarks
 */

import { performance } from 'perf_hooks';
import { createRequire } from 'module';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

export const require = createRequire(import.meta.url);
export const __dirname = dirname(fileURLToPath(import.meta.url));
export const BUILD_DIR = join(__dirname, '..', 'build');

// Byte size constants for binary parsing (WASM uses little-endian by default)
export const FLOAT64_BYTE_SIZE = 8;  // Size in bytes of a float64/double

/**
 * Benchmark utilities
 */
export class Benchmark {
    constructor(name) {
        this.name = name;
        this.results = [];
    }

    /**
     * Run a benchmark function multiple times
     */
    async run(fn, iterations = 100, warmup = 10) {
        // Warmup
        for (let i = 0; i < warmup; i++) {
            fn();
        }

        // Actual benchmark
        const times = [];
        for (let i = 0; i < iterations; i++) {
            const start = performance.now();
            fn();
            const end = performance.now();
            times.push(end - start);
        }

        times.sort((a, b) => a - b);
        return {
            min: times[0],
            max: times[times.length - 1],
            avg: times.reduce((a, b) => a + b, 0) / times.length,
            median: times[Math.floor(times.length / 2)],
            p95: times[Math.floor(times.length * 0.95)]
        };
    }

    /**
     * Add result
     */
    addResult(test, method, stats) {
        this.results.push({ test, method, ...stats });
    }

    /**
     * Print results as table
     */
    printResults() {
        console.log(`\n${'='.repeat(90)}`);
        console.log(`Benchmark Results: ${this.name}`);
        console.log('='.repeat(90));
        
        const grouped = {};
        for (const r of this.results) {
            if (!grouped[r.test]) grouped[r.test] = [];
            grouped[r.test].push(r);
        }

        for (const [test, results] of Object.entries(grouped)) {
            console.log(`\n${test}:`);
            console.log('-'.repeat(85));
            console.log(
                'Method'.padEnd(25),
                'Avg (ms)'.padStart(12),
                'Median (ms)'.padStart(12),
                'Min (ms)'.padStart(12),
                'P95 (ms)'.padStart(12)
            );
            console.log('-'.repeat(85));
            
            for (const r of results) {
                console.log(
                    r.method.padEnd(25),
                    r.avg.toFixed(4).padStart(12),
                    r.median.toFixed(4).padStart(12),
                    r.min.toFixed(4).padStart(12),
                    r.p95.toFixed(4).padStart(12)
                );
            }
        }
    }
}

/**
 * Helper to load WASM module with wasmBinary option
 */
export async function loadWasmModule(createFn, wasmPath) {
    const wasmBinary = readFileSync(wasmPath);
    return await createFn({ wasmBinary });
}
