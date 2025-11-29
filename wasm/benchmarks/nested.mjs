#!/usr/bin/env node
/**
 * @file nested.mjs
 * @description Nested Object Benchmark - C++ to JS data transfer
 */

import { decode } from '@msgpack/msgpack';
import { Struct, i32, f64 } from 'typed-cstruct';
import { Benchmark, loadModules } from './utils.mjs';

async function runNestedObjectBenchmarks(embind, json, msgpack, cstruct, iterations) {
    const benchmark = new Benchmark('Nested Object (C++ → JS)');
    
    for (const itemCount of [10, 50, 100]) {
        const testName = `nested_items${itemCount}`;

        if (embind) {
            const stats = await benchmark.run(() => {
                const obj = embind.generateNestedStruct(itemCount);
                const _ = obj.data.items.size();
            }, iterations);
            benchmark.addResult(testName, 'embind_value_object', stats);
        }

        if (embind) {
            const stats = await benchmark.run(() => {
                const obj = embind.generateNestedManual(itemCount);
                const _ = obj.data.items.length;
            }, iterations);
            benchmark.addResult(testName, 'embind_manual_val', stats);
        }

        if (json) {
            const generateNestedJSON = json.cwrap('generateNestedJSON', 'number', ['number']);
            
            const stats = await benchmark.run(() => {
                const ptr = generateNestedJSON(itemCount);
                const jsonStr = json.UTF8ToString(ptr);
                const obj = JSON.parse(jsonStr);
                const _ = obj.data.items.length;
            }, iterations);
            benchmark.addResult(testName, 'json_memory_access', stats);
        }

        if (msgpack) {
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

        // typed-cstruct: Parse nested struct from binary
        if (cstruct) {
            const generateNestedCStruct = cstruct.cwrap('generateNestedCStruct', 'number', ['number']);
            const getLastCStructLength = cstruct.cwrap('getLastCStructLength', 'number', []);
            
            // NestedHeader: { int32_t itemCount; }
            const NestedHeaderDef = new Struct().field('itemCount', i32);
            // ItemStruct: { int32_t id; double value; int32_t nameLen; }
            const ItemStructDef = new Struct()
                .field('id', i32)
                .field('value', f64)
                .field('nameLen', i32);
            
            const stats = await benchmark.run(() => {
                const ptr = generateNestedCStruct(itemCount);
                const len = getLastCStructLength();
                const buf = new Uint8Array(cstruct.HEAPU8.buffer, ptr, len);
                
                // Parse header
                const header = NestedHeaderDef.read({ buf });
                const items = [];
                
                let offset = NestedHeaderDef.size;
                for (let i = 0; i < header.itemCount; i++) {
                    const itemBuf = buf.slice(offset);
                    const item = ItemStructDef.read({ buf: itemBuf });
                    offset += ItemStructDef.size;
                    
                    // Read name string
                    const nameBytes = buf.slice(offset, offset + item.nameLen);
                    const name = new TextDecoder().decode(nameBytes);
                    offset += item.nameLen;
                    
                    items.push({ ...item, name });
                }
                
                const obj = { data: { items } };
                const _ = obj.data.items.length;
            }, iterations);
            benchmark.addResult(testName, 'cstruct_memory_access', stats);
        }
    }

    benchmark.printResults();
}

async function main() {
    console.log('Nested Object Benchmark');
    console.log('=======================\n');
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

    await runNestedObjectBenchmarks(embindModule, jsonModule, msgpackModule, cstructModule, iterations);
}

main().catch(console.error);
