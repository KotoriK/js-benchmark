#!/usr/bin/env node
/**
 * @file objects.mjs
 * @description Object Array Benchmark - C++ to JS data transfer
 */

import { decode } from '@msgpack/msgpack';
import { Struct, i32, f64 } from 'typed-cstruct';
import { Benchmark, loadModules } from './utils.mjs';

async function runObjectArrayBenchmarks(embind, json, msgpack, cstruct, iterations) {
    const benchmark = new Benchmark('Object Array (C++ → JS)');
    
    for (const count of [10, 100, 500]) {
        const testName = `objects_${count}`;

        if (embind) {
            const stats = await benchmark.run(() => {
                const arr = embind.generateObjectArrayStruct(count);
                const _ = arr.size();
            }, iterations);
            benchmark.addResult(testName, 'embind_value_object', stats);
        }

        if (embind) {
            const stats = await benchmark.run(() => {
                const arr = embind.generateObjectArrayManual(count);
                const _ = arr.length;
            }, iterations);
            benchmark.addResult(testName, 'embind_manual_val', stats);
        }

        if (json) {
            const generateObjectArrayJSON = json.cwrap('generateObjectArrayJSON', 'number', ['number']);
            
            const stats = await benchmark.run(() => {
                const ptr = generateObjectArrayJSON(count);
                const jsonStr = json.UTF8ToString(ptr);
                const arr = JSON.parse(jsonStr);
                const _ = arr.length;
            }, iterations);
            benchmark.addResult(testName, 'json_memory_access', stats);
        }

        if (msgpack) {
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

        // typed-cstruct: Parse object array from binary
        if (cstruct) {
            const generateObjectArrayCStruct = cstruct.cwrap('generateObjectArrayCStruct', 'number', ['number']);
            const getLastCStructLength = cstruct.cwrap('getLastCStructLength', 'number', []);
            
            // ObjectArrayHeader: { int32_t count; }
            const ObjectArrayHeaderDef = new Struct().field('count', i32);
            // ItemStruct: { int32_t id; double value; int32_t nameLen; }
            const ItemStructDef = new Struct()
                .field('id', i32)
                .field('value', f64)
                .field('nameLen', i32);
            
            const stats = await benchmark.run(() => {
                const ptr = generateObjectArrayCStruct(count);
                const len = getLastCStructLength();
                const buf = new Uint8Array(cstruct.HEAPU8.buffer, ptr, len);
                
                // Parse header
                const header = ObjectArrayHeaderDef.read({ buf });
                const arr = [];
                
                let offset = ObjectArrayHeaderDef.size;
                for (let i = 0; i < header.count; i++) {
                    const itemBuf = buf.slice(offset);
                    const item = ItemStructDef.read({ buf: itemBuf });
                    offset += ItemStructDef.size;
                    
                    // Read name string
                    const nameBytes = buf.slice(offset, offset + item.nameLen);
                    const name = new TextDecoder().decode(nameBytes);
                    offset += item.nameLen;
                    
                    arr.push({ ...item, name });
                }
                
                const _ = arr.length;
            }, iterations);
            benchmark.addResult(testName, 'cstruct_memory_access', stats);
        }
    }

    benchmark.printResults();
}

async function main() {
    console.log('Object Array Benchmark');
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

    await runObjectArrayBenchmarks(embindModule, jsonModule, msgpackModule, cstructModule, iterations);
}

main().catch(console.error);
