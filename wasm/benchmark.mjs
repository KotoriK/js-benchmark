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
 * Run: node benchmark.mjs
 */

import { performance } from 'perf_hooks';
import { createRequire } from 'module';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { decode } from '@msgpack/msgpack';
import { Struct, i32, f64, u8, sizedCharArrayAsString, sizedArray } from 'typed-cstruct';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const BUILD_DIR = join(__dirname, 'build');

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
async function loadWasmModule(createFn, wasmPath) {
    const wasmBinary = readFileSync(wasmPath);
    return await createFn({ wasmBinary });
}

/**
 * Main benchmark runner
 */
async function main() {
    console.log('Loading WebAssembly modules...');
    console.log('NOTE: Testing C++ → JS data transfer (data generated in WASM)\n');
    
    let embindModule, jsonModule, msgpackModule, cstructModule;
    
    try {
        const createEmbind = require('./build/benchmark_embind.cjs');
        embindModule = await loadWasmModule(createEmbind, join(BUILD_DIR, 'benchmark_embind.wasm'));
        console.log('✓ embind module loaded');
    } catch (e) {
        console.error('✗ Failed to load embind module:', e.message);
    }

    try {
        const createJson = require('./build/benchmark_json.cjs');
        jsonModule = await loadWasmModule(createJson, join(BUILD_DIR, 'benchmark_json.wasm'));
        console.log('✓ JSON (yyjson) module loaded');
    } catch (e) {
        console.error('✗ Failed to load JSON module:', e.message);
    }

    try {
        const createMsgpack = require('./build/benchmark_msgpack.cjs');
        msgpackModule = await loadWasmModule(createMsgpack, join(BUILD_DIR, 'benchmark_msgpack.wasm'));
        console.log('✓ MessagePack module loaded');
    } catch (e) {
        console.error('✗ Failed to load MessagePack module:', e.message);
    }

    try {
        const createCStruct = require('./build/benchmark_cstruct.cjs');
        cstructModule = await loadWasmModule(createCStruct, join(BUILD_DIR, 'benchmark_cstruct.wasm'));
        console.log('✓ typed-cstruct module loaded');
    } catch (e) {
        console.error('✗ Failed to load typed-cstruct module:', e.message);
    }

    if (!embindModule && !jsonModule && !msgpackModule && !cstructModule) {
        console.error('\nNo modules loaded. Please build the WASM modules first.');
        console.log('Run: npm run build');
        process.exit(1);
    }

    const iterations = parseInt(process.env.ITERATIONS || '100', 10);
    console.log(`\nRunning ${iterations} iterations per benchmark...\n`);

    // Run benchmarks
    await runFlatObjectBenchmarks(embindModule, jsonModule, msgpackModule, cstructModule, iterations);
    await runNestedObjectBenchmarks(embindModule, jsonModule, msgpackModule, cstructModule, iterations);
    await runNumberArrayBenchmarks(embindModule, jsonModule, msgpackModule, cstructModule, iterations);
    await runObjectArrayBenchmarks(embindModule, jsonModule, msgpackModule, cstructModule, iterations);
    await runTreeBenchmarks(embindModule, jsonModule, msgpackModule, cstructModule, iterations);
}

async function runFlatObjectBenchmarks(embind, json, msgpack, cstruct, iterations) {
    const benchmark = new Benchmark('Flat Object (C++ → JS)');
    
    for (const nameLen of [10, 100, 1000]) {
        const testName = `flat_nameLen${nameLen}`;

        // embind with value_object (automatic struct conversion)
        if (embind) {
            const stats = await benchmark.run(() => {
                const obj = embind.generateFlatStruct(nameLen);
                // Access properties to ensure full transfer
                const _ = obj.id + obj.name.length + obj.value;
            }, iterations);
            benchmark.addResult(testName, 'embind_value_object', stats);
        }

        // embind with manual val construction
        if (embind) {
            const stats = await benchmark.run(() => {
                const obj = embind.generateFlatManual(nameLen);
                const _ = obj.id + obj.name.length + obj.value;
            }, iterations);
            benchmark.addResult(testName, 'embind_manual_val', stats);
        }

        // JSON: C++ serializes, JS reads from memory and parses
        if (json) {
            const generateFlatJSON = json.cwrap('generateFlatJSON', 'number', ['number']);
            const getLastJSONLength = json.cwrap('getLastJSONLength', 'number', []);
            
            const stats = await benchmark.run(() => {
                const ptr = generateFlatJSON(nameLen);
                const jsonStr = json.UTF8ToString(ptr);
                const obj = JSON.parse(jsonStr);
                const _ = obj.id + obj.name.length + obj.value;
            }, iterations);
            benchmark.addResult(testName, 'json_memory_access', stats);
        }

        // MessagePack: C++ serializes, JS reads from memory and decodes
        if (msgpack) {
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

        // typed-cstruct: C++ exposes raw struct, JS reads binary and parses with typed-cstruct
        if (cstruct) {
            const generateFlatCStruct = cstruct.cwrap('generateFlatCStruct', 'number', ['number']);
            const getLastCStructLength = cstruct.cwrap('getLastCStructLength', 'number', []);
            
            // Define struct layout matching C++ FlatStruct
            // struct FlatStruct { int32_t id; double value; uint8_t flag; int32_t nameLen; }
            const FlatStructDef = new Struct()
                .field('id', i32)
                .field('value', f64)
                .field('flag', u8)
                .field('nameLen', i32);
            
            const stats = await benchmark.run(() => {
                const ptr = generateFlatCStruct(nameLen);
                const len = getLastCStructLength();
                const buf = new Uint8Array(cstruct.HEAPU8.buffer, ptr, len);
                
                // Parse header
                const header = FlatStructDef.read({ buf });
                // Read name string after header
                const nameBytes = buf.slice(FlatStructDef.size, FlatStructDef.size + header.nameLen);
                const name = new TextDecoder().decode(nameBytes);
                
                const obj = { ...header, name };
                const _ = obj.id + obj.name.length + obj.value;
            }, iterations);
            benchmark.addResult(testName, 'cstruct_memory_access', stats);
        }
    }

    benchmark.printResults();
}

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
                    arr.push(dataView.getFloat64(i * 8, true)); // little endian
                }
                
                const _ = arr.length;
            }, iterations);
            benchmark.addResult(testName, 'cstruct_memory_access', stats);
        }
    }

    benchmark.printResults();
}

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

async function runTreeBenchmarks(embind, json, msgpack, cstruct, iterations) {
    const benchmark = new Benchmark('Tree Structure (C++ → JS)');
    
    for (const [depth, breadth] of [[3, 2], [4, 3], [5, 2]]) {
        const testName = `tree_d${depth}_b${breadth}`;

        if (embind) {
            const stats = await benchmark.run(() => {
                const tree = embind.generateTreeStruct(depth, breadth);
                const _ = tree.depth + tree.breadth;
            }, iterations);
            benchmark.addResult(testName, 'embind_value_object', stats);
        }

        if (embind) {
            const stats = await benchmark.run(() => {
                const tree = embind.generateTreeManual(depth, breadth);
                const _ = tree.depth + tree.breadth;
            }, iterations);
            benchmark.addResult(testName, 'embind_manual_val', stats);
        }

        if (json) {
            const generateTreeJSON = json.cwrap('generateTreeJSON', 'number', ['number', 'number']);
            
            const stats = await benchmark.run(() => {
                const ptr = generateTreeJSON(depth, breadth);
                const jsonStr = json.UTF8ToString(ptr);
                const tree = JSON.parse(jsonStr);
                const _ = tree.depth + tree.breadth;
            }, iterations);
            benchmark.addResult(testName, 'json_memory_access', stats);
        }

        if (msgpack) {
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

        // typed-cstruct: Parse tree structure from binary
        if (cstruct) {
            const generateTreeCStruct = cstruct.cwrap('generateTreeCStruct', 'number', ['number', 'number']);
            const getLastCStructLength = cstruct.cwrap('getLastCStructLength', 'number', []);
            
            // TreeNodeHeader: { int32_t depth; int32_t breadth; int32_t childrenCount; }
            const TreeNodeHeaderDef = new Struct()
                .field('depth', i32)
                .field('breadth', i32)
                .field('childrenCount', i32);
            
            // Recursive tree parser
            function parseTreeNode(buf, offset) {
                const nodeBuf = buf.slice(offset);
                const header = TreeNodeHeaderDef.read({ buf: nodeBuf });
                let currentOffset = offset + TreeNodeHeaderDef.size;
                
                const node = {
                    depth: header.depth,
                    breadth: header.breadth,
                    children: []
                };
                
                for (let i = 0; i < header.childrenCount; i++) {
                    const [child, newOffset] = parseTreeNode(buf, currentOffset);
                    node.children.push(child);
                    currentOffset = newOffset;
                }
                
                return [node, currentOffset];
            }
            
            const stats = await benchmark.run(() => {
                const ptr = generateTreeCStruct(depth, breadth);
                const len = getLastCStructLength();
                const buf = new Uint8Array(cstruct.HEAPU8.buffer, ptr, len);
                
                const [tree] = parseTreeNode(buf, 0);
                const _ = tree.depth + tree.breadth;
            }, iterations);
            benchmark.addResult(testName, 'cstruct_memory_access', stats);
        }
    }

    benchmark.printResults();
}

main().catch(console.error);
