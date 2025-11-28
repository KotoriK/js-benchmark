#!/usr/bin/env node
/**
 * @file benchmark.mjs
 * @description WebAssembly Data Transfer Benchmark Runner
 * 
 * This script benchmarks three methods of data transfer between JavaScript and WebAssembly:
 * 1. embind - Using emscripten::val for automatic type conversion
 * 2. JSON - Serializing/deserializing via yyjson
 * 3. MessagePack - Binary serialization via msgpack-c
 * 
 * Run: node benchmark.mjs
 */

import { performance } from 'perf_hooks';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { encode, decode } from '@msgpack/msgpack';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUILD_DIR = join(__dirname, 'build');

/**
 * Test Data Generators
 */
const TestData = {
    /**
     * Generate a flat object with primitive types
     */
    flatObject(size = 'small') {
        const sizes = {
            small: { nameLen: 10, strCount: 1 },
            medium: { nameLen: 100, strCount: 10 },
            large: { nameLen: 1000, strCount: 50 }
        };
        const s = sizes[size] || sizes.small;
        return {
            id: 42,
            name: 'x'.repeat(s.nameLen),
            value: 3.14159265359,
            flag: true
        };
    },

    /**
     * Generate a nested object
     */
    nestedObject(depth = 3, itemCount = 10) {
        const items = Array.from({ length: itemCount }, (_, i) => ({
            id: i,
            name: `item_${i}`,
            value: Math.random() * 100
        }));
        
        let obj = { data: { items } };
        for (let i = 0; i < depth - 1; i++) {
            obj = { nested: obj };
        }
        return obj;
    },

    /**
     * Generate a number array
     */
    numberArray(count = 1000) {
        return Array.from({ length: count }, () => Math.random() * 1000);
    },

    /**
     * Generate an array of objects
     */
    objectArray(count = 100) {
        return Array.from({ length: count }, (_, i) => ({
            id: i,
            name: `object_${i}`,
            value: Math.random() * 1000,
            active: i % 2 === 0
        }));
    },

    /**
     * Generate a deeply nested tree structure
     */
    deepTree(depth = 4, breadth = 3) {
        return { depth, breadth };
    }
};

/**
 * Benchmark utilities
 */
class Benchmark {
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
            await fn();
        }

        // Actual benchmark
        const times = [];
        for (let i = 0; i < iterations; i++) {
            const start = performance.now();
            await fn();
            const end = performance.now();
            times.push(end - start);
        }

        const sorted = times.sort((a, b) => a - b);
        return {
            min: sorted[0],
            max: sorted[sorted.length - 1],
            avg: times.reduce((a, b) => a + b, 0) / times.length,
            median: sorted[Math.floor(sorted.length / 2)],
            p95: sorted[Math.floor(sorted.length * 0.95)]
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
        console.log(`\n${'='.repeat(80)}`);
        console.log(`Benchmark Results: ${this.name}`);
        console.log('='.repeat(80));
        
        const grouped = {};
        for (const r of this.results) {
            if (!grouped[r.test]) grouped[r.test] = [];
            grouped[r.test].push(r);
        }

        for (const [test, results] of Object.entries(grouped)) {
            console.log(`\n${test}:`);
            console.log('-'.repeat(70));
            console.log(
                'Method'.padEnd(15),
                'Avg (ms)'.padStart(12),
                'Median (ms)'.padStart(12),
                'Min (ms)'.padStart(12),
                'P95 (ms)'.padStart(12)
            );
            console.log('-'.repeat(70));
            
            for (const r of results) {
                console.log(
                    r.method.padEnd(15),
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
 * Main benchmark runner
 */
async function main() {
    console.log('Loading WebAssembly modules...');
    
    // Dynamic imports of WASM modules
    let embindModule, jsonModule, msgpackModule;
    
    try {
        const createEmbind = (await import(join(BUILD_DIR, 'benchmark_embind.mjs'))).default;
        embindModule = await createEmbind();
        console.log('✓ embind module loaded');
    } catch (e) {
        console.error('✗ Failed to load embind module:', e.message);
    }

    try {
        const createJson = (await import(join(BUILD_DIR, 'benchmark_json.mjs'))).default;
        jsonModule = await createJson();
        console.log('✓ JSON (yyjson) module loaded');
    } catch (e) {
        console.error('✗ Failed to load JSON module:', e.message);
    }

    try {
        const createMsgpack = (await import(join(BUILD_DIR, 'benchmark_msgpack.mjs'))).default;
        msgpackModule = await createMsgpack();
        console.log('✓ MessagePack module loaded');
    } catch (e) {
        console.error('✗ Failed to load MessagePack module:', e.message);
    }

    if (!embindModule && !jsonModule && !msgpackModule) {
        console.error('\nNo modules loaded. Please build the WASM modules first.');
        console.log('Run: mkdir -p build && cd build && emcmake cmake .. && emmake make');
        process.exit(1);
    }

    const iterations = parseInt(process.env.ITERATIONS || '100', 10);
    console.log(`\nRunning ${iterations} iterations per benchmark...\n`);

    // Run benchmarks for different data types and sizes
    await runFlatObjectBenchmarks(embindModule, jsonModule, msgpackModule, iterations);
    await runNestedObjectBenchmarks(embindModule, jsonModule, msgpackModule, iterations);
    await runNumberArrayBenchmarks(embindModule, jsonModule, msgpackModule, iterations);
    await runObjectArrayBenchmarks(embindModule, jsonModule, msgpackModule, iterations);
    await runComplexTreeBenchmarks(embindModule, jsonModule, msgpackModule, iterations);
}

async function runFlatObjectBenchmarks(embind, json, msgpack, iterations) {
    const benchmark = new Benchmark('Flat Object Processing');
    
    for (const size of ['small', 'medium', 'large']) {
        const data = TestData.flatObject(size);
        const jsonStr = JSON.stringify(data);
        const msgpackData = encode(data);
        
        const testName = `flat_${size}`;

        if (embind) {
            const stats = await benchmark.run(() => embind.processFlat(data), iterations);
            benchmark.addResult(testName, 'embind', stats);
        }

        if (json) {
            const stats = await benchmark.run(() => {
                const result = json.processFlat(jsonStr);
                return JSON.parse(result);
            }, iterations);
            benchmark.addResult(testName, 'json', stats);
        }

        if (msgpack) {
            const stats = await benchmark.run(() => {
                const result = msgpack.processFlat(new Uint8Array(msgpackData));
                return decode(result);
            }, iterations);
            benchmark.addResult(testName, 'msgpack', stats);
        }
    }

    benchmark.printResults();
}

async function runNestedObjectBenchmarks(embind, json, msgpack, iterations) {
    const benchmark = new Benchmark('Nested Object Processing');
    
    for (const [depth, itemCount] of [[2, 10], [3, 50], [4, 100]]) {
        const data = TestData.nestedObject(depth, itemCount);
        const jsonStr = JSON.stringify(data);
        const msgpackData = encode(data);
        
        const testName = `nested_d${depth}_i${itemCount}`;

        if (embind) {
            const stats = await benchmark.run(() => embind.processNested(data), iterations);
            benchmark.addResult(testName, 'embind', stats);
        }

        if (json) {
            const stats = await benchmark.run(() => {
                const result = json.processNested(jsonStr);
                return JSON.parse(result);
            }, iterations);
            benchmark.addResult(testName, 'json', stats);
        }

        if (msgpack) {
            const stats = await benchmark.run(() => {
                const result = msgpack.processNested(new Uint8Array(msgpackData));
                return decode(result);
            }, iterations);
            benchmark.addResult(testName, 'msgpack', stats);
        }
    }

    benchmark.printResults();
}

async function runNumberArrayBenchmarks(embind, json, msgpack, iterations) {
    const benchmark = new Benchmark('Number Array Processing');
    
    for (const count of [100, 1000, 10000]) {
        const data = TestData.numberArray(count);
        const jsonStr = JSON.stringify(data);
        const msgpackData = encode(data);
        
        const testName = `numbers_${count}`;

        if (embind) {
            const stats = await benchmark.run(() => embind.processNumberArray(data), iterations);
            benchmark.addResult(testName, 'embind', stats);
        }

        if (json) {
            const stats = await benchmark.run(() => {
                const result = json.processNumberArray(jsonStr);
                return JSON.parse(result);
            }, iterations);
            benchmark.addResult(testName, 'json', stats);
        }

        if (msgpack) {
            const stats = await benchmark.run(() => {
                const result = msgpack.processNumberArray(new Uint8Array(msgpackData));
                return decode(result);
            }, iterations);
            benchmark.addResult(testName, 'msgpack', stats);
        }
    }

    benchmark.printResults();
}

async function runObjectArrayBenchmarks(embind, json, msgpack, iterations) {
    const benchmark = new Benchmark('Object Array Processing');
    
    for (const count of [10, 100, 500]) {
        const data = TestData.objectArray(count);
        const jsonStr = JSON.stringify(data);
        const msgpackData = encode(data);
        
        const testName = `objects_${count}`;

        if (embind) {
            const stats = await benchmark.run(() => embind.processObjectArray(data), iterations);
            benchmark.addResult(testName, 'embind', stats);
        }

        if (json) {
            const stats = await benchmark.run(() => {
                const result = json.processObjectArray(jsonStr);
                return JSON.parse(result);
            }, iterations);
            benchmark.addResult(testName, 'json', stats);
        }

        if (msgpack) {
            const stats = await benchmark.run(() => {
                const result = msgpack.processObjectArray(new Uint8Array(msgpackData));
                return decode(result);
            }, iterations);
            benchmark.addResult(testName, 'msgpack', stats);
        }
    }

    benchmark.printResults();
}

async function runComplexTreeBenchmarks(embind, json, msgpack, iterations) {
    const benchmark = new Benchmark('Complex Tree Creation & Traversal');
    
    for (const [depth, breadth] of [[3, 2], [4, 3], [5, 2]]) {
        const testName = `tree_d${depth}_b${breadth}`;

        // Test creation
        if (embind) {
            const stats = await benchmark.run(() => {
                const tree = embind.createComplexObject(depth, breadth);
                return embind.countNodes(tree);
            }, iterations);
            benchmark.addResult(`${testName}_create+count`, 'embind', stats);
        }

        if (json) {
            const stats = await benchmark.run(() => {
                const treeJson = json.createComplexObject(depth, breadth);
                return json.countNodes(treeJson);
            }, iterations);
            benchmark.addResult(`${testName}_create+count`, 'json', stats);
        }

        if (msgpack) {
            const stats = await benchmark.run(() => {
                const treePacked = msgpack.createComplexObject(depth, breadth);
                return msgpack.countNodes(treePacked);
            }, iterations);
            benchmark.addResult(`${testName}_create+count`, 'msgpack', stats);
        }
    }

    benchmark.printResults();
}

main().catch(console.error);
