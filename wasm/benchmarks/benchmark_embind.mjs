/**
 * @file benchmark_embind.mjs
 * @description embind benchmarks - C++ to JS data transfer using embind
 * 
 * Tests two approaches:
 * 1. value_object: Register C++ structs with embind for automatic conversion
 * 2. manual val: Build JS objects manually using emscripten::val
 */

import { Benchmark, require, BUILD_DIR, loadWasmModule } from './utils.mjs';
import { join } from 'path';

/**
 * Run all embind benchmarks
 */
export async function runEmbindBenchmarks(iterations) {
    let embindModule;
    
    try {
        const createEmbind = require('../build/benchmark_embind.cjs');
        embindModule = await loadWasmModule(createEmbind, join(BUILD_DIR, 'benchmark_embind.wasm'));
        console.log('✓ embind module loaded');
    } catch (e) {
        console.error('✗ Failed to load embind module:', e.message);
        return;
    }

    await runFlatObjectBenchmarks(embindModule, iterations);
    await runNestedObjectBenchmarks(embindModule, iterations);
    await runNumberArrayBenchmarks(embindModule, iterations);
    await runObjectArrayBenchmarks(embindModule, iterations);
    await runTreeBenchmarks(embindModule, iterations);
}

async function runFlatObjectBenchmarks(embind, iterations) {
    const benchmark = new Benchmark('Flat Object (C++ → JS) - embind');
    
    for (const nameLen of [10, 100, 1000]) {
        const testName = `flat_nameLen${nameLen}`;

        // embind with value_object (automatic struct conversion)
        const stats1 = await benchmark.run(() => {
            const obj = embind.generateFlatStruct(nameLen);
            // Access properties to ensure full transfer
            const _ = obj.id + obj.name.length + obj.value;
        }, iterations);
        benchmark.addResult(testName, 'embind_value_object', stats1);

        // embind with manual val construction
        const stats2 = await benchmark.run(() => {
            const obj = embind.generateFlatManual(nameLen);
            const _ = obj.id + obj.name.length + obj.value;
        }, iterations);
        benchmark.addResult(testName, 'embind_manual_val', stats2);
    }

    benchmark.printResults();
}

async function runNestedObjectBenchmarks(embind, iterations) {
    const benchmark = new Benchmark('Nested Object (C++ → JS) - embind');
    
    for (const itemCount of [10, 50, 100]) {
        const testName = `nested_items${itemCount}`;

        const stats1 = await benchmark.run(() => {
            const obj = embind.generateNestedStruct(itemCount);
            const _ = obj.data.items.size();
        }, iterations);
        benchmark.addResult(testName, 'embind_value_object', stats1);

        const stats2 = await benchmark.run(() => {
            const obj = embind.generateNestedManual(itemCount);
            const _ = obj.data.items.length;
        }, iterations);
        benchmark.addResult(testName, 'embind_manual_val', stats2);
    }

    benchmark.printResults();
}

async function runNumberArrayBenchmarks(embind, iterations) {
    const benchmark = new Benchmark('Number Array (C++ → JS) - embind');
    
    for (const count of [100, 1000, 10000]) {
        const testName = `numbers_${count}`;

        const stats1 = await benchmark.run(() => {
            const arr = embind.generateNumberArrayStruct(count);
            const _ = arr.size();
        }, iterations);
        benchmark.addResult(testName, 'embind_value_object', stats1);

        const stats2 = await benchmark.run(() => {
            const arr = embind.generateNumberArrayManual(count);
            const _ = arr.length;
        }, iterations);
        benchmark.addResult(testName, 'embind_manual_val', stats2);
    }

    benchmark.printResults();
}

async function runObjectArrayBenchmarks(embind, iterations) {
    const benchmark = new Benchmark('Object Array (C++ → JS) - embind');
    
    for (const count of [10, 100, 500]) {
        const testName = `objects_${count}`;

        const stats1 = await benchmark.run(() => {
            const arr = embind.generateObjectArrayStruct(count);
            const _ = arr.size();
        }, iterations);
        benchmark.addResult(testName, 'embind_value_object', stats1);

        const stats2 = await benchmark.run(() => {
            const arr = embind.generateObjectArrayManual(count);
            const _ = arr.length;
        }, iterations);
        benchmark.addResult(testName, 'embind_manual_val', stats2);
    }

    benchmark.printResults();
}

async function runTreeBenchmarks(embind, iterations) {
    const benchmark = new Benchmark('Tree Structure (C++ → JS) - embind');
    
    for (const [depth, breadth] of [[3, 2], [4, 3], [5, 2]]) {
        const testName = `tree_d${depth}_b${breadth}`;

        const stats1 = await benchmark.run(() => {
            const tree = embind.generateTreeStruct(depth, breadth);
            const _ = tree.depth + tree.breadth;
        }, iterations);
        benchmark.addResult(testName, 'embind_value_object', stats1);

        const stats2 = await benchmark.run(() => {
            const tree = embind.generateTreeManual(depth, breadth);
            const _ = tree.depth + tree.breadth;
        }, iterations);
        benchmark.addResult(testName, 'embind_manual_val', stats2);
    }

    benchmark.printResults();
}
