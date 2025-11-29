#!/usr/bin/env node
/**
 * @file flat.mjs
 * @description Flat Object Benchmark - C++ to JS data transfer
 */

import { decode } from '@msgpack/msgpack';
import { Struct, i32, f64, u8 } from 'typed-cstruct';
import { Benchmark, loadModules } from './utils.mjs';

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

async function main() {
    console.log('Flat Object Benchmark');
    console.log('====================\n');
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

    await runFlatObjectBenchmarks(embindModule, jsonModule, msgpackModule, cstructModule, iterations);
}

main().catch(console.error);
