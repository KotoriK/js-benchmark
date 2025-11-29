#!/usr/bin/env node
/**
 * @file tree.mjs
 * @description Tree Structure Benchmark - C++ to JS data transfer
 */

import { decode } from '@msgpack/msgpack';
import { Struct, i32 } from 'typed-cstruct';
import { Benchmark, loadModules } from './utils.mjs';

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

async function main() {
    console.log('Tree Structure Benchmark');
    console.log('========================\n');
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

    await runTreeBenchmarks(embindModule, jsonModule, msgpackModule, cstructModule, iterations);
}

main().catch(console.error);
