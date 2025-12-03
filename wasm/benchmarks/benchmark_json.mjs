/**
 * @file benchmark_json.mjs
 * @description JSON benchmarks - C++ to JS data transfer using JSON (yyjson)
 * 
 * Serializes data to JSON string in C++ using yyjson, transfers via direct WASM
 * memory access using UTF8ToString(), then parses in JavaScript.
 */

import { Benchmark, require, BUILD_DIR, loadWasmModule } from './utils.mjs';
import { join } from 'path';

/**
 * Run all JSON benchmarks
 */
export async function runJsonBenchmarks(iterations) {
    let jsonModule;
    
    try {
        const createJson = require('../build/benchmark_json.cjs');
        jsonModule = await loadWasmModule(createJson, join(BUILD_DIR, 'benchmark_json.wasm'));
        console.log('✓ JSON (yyjson) module loaded');
    } catch (e) {
        console.error('✗ Failed to load JSON module:', e.message);
        return;
    }

    await runFlatObjectBenchmarks(jsonModule, iterations);
    await runNestedObjectBenchmarks(jsonModule, iterations);
    await runNumberArrayBenchmarks(jsonModule, iterations);
    await runObjectArrayBenchmarks(jsonModule, iterations);
    await runTreeBenchmarks(jsonModule, iterations);
}

async function runFlatObjectBenchmarks(json, iterations) {
    const benchmark = new Benchmark('Flat Object (C++ → JS) - JSON');
    
    for (const nameLen of [10, 100, 1000]) {
        const testName = `flat_nameLen${nameLen}`;

        const generateFlatJSON = json.cwrap('generateFlatJSON', 'number', ['number']);
        
        const stats = await benchmark.run(() => {
            const ptr = generateFlatJSON(nameLen);
            const jsonStr = json.UTF8ToString(ptr);
            const obj = JSON.parse(jsonStr);
            const _ = obj.id + obj.name.length + obj.value;
        }, iterations);
        benchmark.addResult(testName, 'json_memory_access', stats);
    }

    benchmark.printResults();
}

async function runNestedObjectBenchmarks(json, iterations) {
    const benchmark = new Benchmark('Nested Object (C++ → JS) - JSON');
    
    for (const itemCount of [10, 50, 100]) {
        const testName = `nested_items${itemCount}`;

        const generateNestedJSON = json.cwrap('generateNestedJSON', 'number', ['number']);
        
        const stats = await benchmark.run(() => {
            const ptr = generateNestedJSON(itemCount);
            const jsonStr = json.UTF8ToString(ptr);
            const obj = JSON.parse(jsonStr);
            const _ = obj.data.items.length;
        }, iterations);
        benchmark.addResult(testName, 'json_memory_access', stats);
    }

    benchmark.printResults();
}

async function runNumberArrayBenchmarks(json, iterations) {
    const benchmark = new Benchmark('Number Array (C++ → JS) - JSON');
    
    for (const count of [100, 1000, 10000]) {
        const testName = `numbers_${count}`;

        const generateNumberArrayJSON = json.cwrap('generateNumberArrayJSON', 'number', ['number']);
        
        const stats = await benchmark.run(() => {
            const ptr = generateNumberArrayJSON(count);
            const jsonStr = json.UTF8ToString(ptr);
            const arr = JSON.parse(jsonStr);
            const _ = arr.length;
        }, iterations);
        benchmark.addResult(testName, 'json_memory_access', stats);
    }

    benchmark.printResults();
}

async function runObjectArrayBenchmarks(json, iterations) {
    const benchmark = new Benchmark('Object Array (C++ → JS) - JSON');
    
    for (const count of [10, 100, 500]) {
        const testName = `objects_${count}`;

        const generateObjectArrayJSON = json.cwrap('generateObjectArrayJSON', 'number', ['number']);
        
        const stats = await benchmark.run(() => {
            const ptr = generateObjectArrayJSON(count);
            const jsonStr = json.UTF8ToString(ptr);
            const arr = JSON.parse(jsonStr);
            const _ = arr.length;
        }, iterations);
        benchmark.addResult(testName, 'json_memory_access', stats);
    }

    benchmark.printResults();
}

async function runTreeBenchmarks(json, iterations) {
    const benchmark = new Benchmark('Tree Structure (C++ → JS) - JSON');
    
    for (const [depth, breadth] of [[3, 2], [4, 3], [5, 2]]) {
        const testName = `tree_d${depth}_b${breadth}`;

        const generateTreeJSON = json.cwrap('generateTreeJSON', 'number', ['number', 'number']);
        
        const stats = await benchmark.run(() => {
            const ptr = generateTreeJSON(depth, breadth);
            const jsonStr = json.UTF8ToString(ptr);
            const tree = JSON.parse(jsonStr);
            const _ = tree.depth + tree.breadth;
        }, iterations);
        benchmark.addResult(testName, 'json_memory_access', stats);
    }

    benchmark.printResults();
}
