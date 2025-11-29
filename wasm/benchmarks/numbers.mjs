#!/usr/bin/env node
/**
 * @file numbers.mjs
 * @description Number Array Benchmark - C++ to JS data transfer
 */

import { decode } from '@msgpack/msgpack';
import { Struct, i32 } from 'typed-cstruct';
import { Benchmark, loadModules, FLOAT64_BYTE_SIZE } from './utils.mjs';

async function runNumberArrayBenchmarks(embind, json, msgpack, cstruct, iterations) {
    const benchmark = new Benchmark('Number Array (C++ → JS)');
    
    for (const count of [100, 1000, 10000]) {
        const testName = `numbers_${count}`;

        if (embind) {
            const stats = await benchmark.run(() => {
                const arr = embind.generateNumberArrayStruct(count);
                const _ = arr.size();
            }, iterations);
            benchmark.addResult(testName, 'embind_value_object', stats);
        }

        if (embind) {
            const stats = await benchmark.run(() => {
                const arr = embind.generateNumberArrayManual(count);
                const _ = arr.length;
            }, iterations);
            benchmark.addResult(testName, 'embind_manual_val', stats);
        }

        if (json) {
            const generateNumberArrayJSON = json.cwrap('generateNumberArrayJSON', 'number', ['number']);
            
            const stats = await benchmark.run(() => {
                const ptr = generateNumberArrayJSON(count);
                const jsonStr = json.UTF8ToString(ptr);
                const arr = JSON.parse(jsonStr);
                const _ = arr.length;
            }, iterations);
            benchmark.addResult(testName, 'json_memory_access', stats);
        }

        if (msgpack) {
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

        // typed-cstruct: Parse number array from binary
        if (cstruct) {
            const generateNumberArrayCStruct = cstruct.cwrap('generateNumberArrayCStruct', 'number', ['number']);
            const getLastCStructLength = cstruct.cwrap('getLastCStructLength', 'number', []);
            
            // NumberArrayHeader: { int32_t count; } followed by count doubles
            const NumberArrayHeaderDef = new Struct().field('count', i32);
            
            const stats = await benchmark.run(() => {
                const ptr = generateNumberArrayCStruct(count);
                const len = getLastCStructLength();
                const buf = new Uint8Array(cstruct.HEAPU8.buffer, ptr, len);
                
                // Parse header
                const header = NumberArrayHeaderDef.read({ buf });
                
                // Read doubles array using DataView for proper float64 parsing
                const arr = [];
                const dataView = new DataView(buf.buffer, buf.byteOffset + NumberArrayHeaderDef.size);
                for (let i = 0; i < header.count; i++) {
                    arr.push(dataView.getFloat64(i * FLOAT64_BYTE_SIZE, true)); // little endian
                }
                
                const _ = arr.length;
            }, iterations);
            benchmark.addResult(testName, 'cstruct_memory_access', stats);
        }
    }

    benchmark.printResults();
}

async function main() {
    console.log('Number Array Benchmark');
    console.log('======================\n');
    console.log('Loading WebAssembly modules...');
    console.log('NOTE: Testing C++ → JS data transfer (data generated in WASM)\n');
    
    const { embindModule, jsonModule, msgpackModule, cstructModule } = await loadModules();
    
    if (!embindModule && !jsonModule && !msgpackModule && !cstructModule) {
        console.error('\nNo modules loaded. Please build the WASM modules first.');
        console.log('Run: npm run build');
        process.exit(1);
    }

    const iterations = parseInt(process.env.ITERATIONS || '100', 10);
    console.log(`\nRunning ${iterations} iterations per benchmark...\n`);

    await runNumberArrayBenchmarks(embindModule, jsonModule, msgpackModule, cstructModule, iterations);
}

main().catch(console.error);
