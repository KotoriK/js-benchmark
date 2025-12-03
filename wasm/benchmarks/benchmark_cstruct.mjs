/**
 * @file benchmark_cstruct.mjs
 * @description typed-cstruct benchmarks - C++ to JS data transfer using raw C structs
 * 
 * Exposes raw C struct binary data in WASM memory, JavaScript reads binary data
 * via HEAPU8, then parses using typed-cstruct.
 */

import { Benchmark, require, BUILD_DIR, loadWasmModule, FLOAT64_BYTE_SIZE } from './utils.mjs';
import { join } from 'path';
import { Struct, i32, f64, u8 } from 'typed-cstruct';

/**
 * Run all typed-cstruct benchmarks
 */
export async function runCStructBenchmarks(iterations) {
    let cstructModule;
    
    try {
        const createCStruct = require('../build/benchmark_cstruct.cjs');
        cstructModule = await loadWasmModule(createCStruct, join(BUILD_DIR, 'benchmark_cstruct.wasm'));
        console.log('✓ typed-cstruct module loaded');
    } catch (e) {
        console.error('✗ Failed to load typed-cstruct module:', e.message);
        return;
    }

    await runFlatObjectBenchmarks(cstructModule, iterations);
    await runNestedObjectBenchmarks(cstructModule, iterations);
    await runNumberArrayBenchmarks(cstructModule, iterations);
    await runObjectArrayBenchmarks(cstructModule, iterations);
    await runTreeBenchmarks(cstructModule, iterations);
}

async function runFlatObjectBenchmarks(cstruct, iterations) {
    const benchmark = new Benchmark('Flat Object (C++ → JS) - typed-cstruct');
    
    for (const nameLen of [10, 100, 1000]) {
        const testName = `flat_nameLen${nameLen}`;

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

    benchmark.printResults();
}

async function runNestedObjectBenchmarks(cstruct, iterations) {
    const benchmark = new Benchmark('Nested Object (C++ → JS) - typed-cstruct');
    
    for (const itemCount of [10, 50, 100]) {
        const testName = `nested_items${itemCount}`;

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

    benchmark.printResults();
}

async function runNumberArrayBenchmarks(cstruct, iterations) {
    const benchmark = new Benchmark('Number Array (C++ → JS) - typed-cstruct');
    
    for (const count of [100, 1000, 10000]) {
        const testName = `numbers_${count}`;

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

    benchmark.printResults();
}

async function runObjectArrayBenchmarks(cstruct, iterations) {
    const benchmark = new Benchmark('Object Array (C++ → JS) - typed-cstruct');
    
    for (const count of [10, 100, 500]) {
        const testName = `objects_${count}`;

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

    benchmark.printResults();
}

async function runTreeBenchmarks(cstruct, iterations) {
    const benchmark = new Benchmark('Tree Structure (C++ → JS) - typed-cstruct');
    
    for (const [depth, breadth] of [[3, 2], [4, 3], [5, 2]]) {
        const testName = `tree_d${depth}_b${breadth}`;

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

    benchmark.printResults();
}
