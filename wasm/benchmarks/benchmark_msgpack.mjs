/**
 * @file benchmark_msgpack.mjs
 * @description MessagePack benchmarks - C++ to JS data transfer using MessagePack
 * 
 * Serializes data to MessagePack binary in C++ using msgpack-c, transfers via
 * direct WASM memory access using HEAPU8, then decodes in JavaScript.
 */

import { Benchmark, require, BUILD_DIR, loadWasmModule } from './utils.mjs';
import { join } from 'path';
import { decode } from '@msgpack/msgpack';

/**
 * Run all MessagePack benchmarks
 */
export async function runMsgpackBenchmarks(iterations) {
    let msgpackModule;
    
    try {
        const createMsgpack = require('../build/benchmark_msgpack.cjs');
        msgpackModule = await loadWasmModule(createMsgpack, join(BUILD_DIR, 'benchmark_msgpack.wasm'));
        console.log('✓ MessagePack module loaded');
    } catch (e) {
        console.error('✗ Failed to load MessagePack module:', e.message);
        return;
    }

    await runFlatObjectBenchmarks(msgpackModule, iterations);
    await runNestedObjectBenchmarks(msgpackModule, iterations);
    await runNumberArrayBenchmarks(msgpackModule, iterations);
    await runObjectArrayBenchmarks(msgpackModule, iterations);
    await runTreeBenchmarks(msgpackModule, iterations);
}

async function runFlatObjectBenchmarks(msgpack, iterations) {
    const benchmark = new Benchmark('Flat Object (C++ → JS) - MessagePack');
    
    for (const nameLen of [10, 100, 1000]) {
        const testName = `flat_nameLen${nameLen}`;

        const generateFlatMsgpack = msgpack.cwrap('generateFlatMsgpack', 'number', ['number']);
        const getLastMsgpackLength = msgpack.cwrap('getLastMsgpackLength', 'number', []);
        
        const stats = await benchmark.run(() => {
            const ptr = generateFlatMsgpack(nameLen);
            const len = getLastMsgpackLength();
            const data = new Uint8Array(msgpack.HEAPU8.buffer, ptr, len);
            const obj = decode(data);
            const _ = obj.id + obj.name.length + obj.value;
        }, iterations);
        benchmark.addResult(testName, 'msgpack_memory_access', stats);
    }

    benchmark.printResults();
}

async function runNestedObjectBenchmarks(msgpack, iterations) {
    const benchmark = new Benchmark('Nested Object (C++ → JS) - MessagePack');
    
    for (const itemCount of [10, 50, 100]) {
        const testName = `nested_items${itemCount}`;

        const generateNestedMsgpack = msgpack.cwrap('generateNestedMsgpack', 'number', ['number']);
        const getLastMsgpackLength = msgpack.cwrap('getLastMsgpackLength', 'number', []);
        
        const stats = await benchmark.run(() => {
            const ptr = generateNestedMsgpack(itemCount);
            const len = getLastMsgpackLength();
            const data = new Uint8Array(msgpack.HEAPU8.buffer, ptr, len);
            const obj = decode(data);
            const _ = obj.data.items.length;
        }, iterations);
        benchmark.addResult(testName, 'msgpack_memory_access', stats);
    }

    benchmark.printResults();
}

async function runNumberArrayBenchmarks(msgpack, iterations) {
    const benchmark = new Benchmark('Number Array (C++ → JS) - MessagePack');
    
    for (const count of [100, 1000, 10000]) {
        const testName = `numbers_${count}`;

        const generateNumberArrayMsgpack = msgpack.cwrap('generateNumberArrayMsgpack', 'number', ['number']);
        const getLastMsgpackLength = msgpack.cwrap('getLastMsgpackLength', 'number', []);
        
        const stats = await benchmark.run(() => {
            const ptr = generateNumberArrayMsgpack(count);
            const len = getLastMsgpackLength();
            const data = new Uint8Array(msgpack.HEAPU8.buffer, ptr, len);
            const arr = decode(data);
            const _ = arr.length;
        }, iterations);
        benchmark.addResult(testName, 'msgpack_memory_access', stats);
    }

    benchmark.printResults();
}

async function runObjectArrayBenchmarks(msgpack, iterations) {
    const benchmark = new Benchmark('Object Array (C++ → JS) - MessagePack');
    
    for (const count of [10, 100, 500]) {
        const testName = `objects_${count}`;

        const generateObjectArrayMsgpack = msgpack.cwrap('generateObjectArrayMsgpack', 'number', ['number']);
        const getLastMsgpackLength = msgpack.cwrap('getLastMsgpackLength', 'number', []);
        
        const stats = await benchmark.run(() => {
            const ptr = generateObjectArrayMsgpack(count);
            const len = getLastMsgpackLength();
            const data = new Uint8Array(msgpack.HEAPU8.buffer, ptr, len);
            const arr = decode(data);
            const _ = arr.length;
        }, iterations);
        benchmark.addResult(testName, 'msgpack_memory_access', stats);
    }

    benchmark.printResults();
}

async function runTreeBenchmarks(msgpack, iterations) {
    const benchmark = new Benchmark('Tree Structure (C++ → JS) - MessagePack');
    
    for (const [depth, breadth] of [[3, 2], [4, 3], [5, 2]]) {
        const testName = `tree_d${depth}_b${breadth}`;

        const generateTreeMsgpack = msgpack.cwrap('generateTreeMsgpack', 'number', ['number', 'number']);
        const getLastMsgpackLength = msgpack.cwrap('getLastMsgpackLength', 'number', []);
        
        const stats = await benchmark.run(() => {
            const ptr = generateTreeMsgpack(depth, breadth);
            const len = getLastMsgpackLength();
            const data = new Uint8Array(msgpack.HEAPU8.buffer, ptr, len);
            const tree = decode(data);
            const _ = tree.depth + tree.breadth;
        }, iterations);
        benchmark.addResult(testName, 'msgpack_memory_access', stats);
    }

    benchmark.printResults();
}
