/**
 * Parses text output from the WASM benchmark runner into structured JSON.
 *
 * Usage:
 *   node parse-wasm-output.mjs [input-file] [output-file]
 *
 * Defaults:
 *   input-file  – wasm/benchmark-output.txt  (relative to repo root)
 *   output-file – wasm-results.json          (relative to repo root)
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..');

const inputFile  = process.argv[2] || join(repoRoot, 'wasm', 'benchmark-output.txt');
const outputFile = process.argv[3] || join(repoRoot, 'wasm-results.json');

const output = readFileSync(inputFile, 'utf8');

// ---------------------------------------------------------------------------
// Parse system information
// ---------------------------------------------------------------------------
let systemInfo = {
    platform: 'unknown',
    arch: 'unknown',
    nodeVersion: 'unknown',
    cpuModel: 'unknown',
    cpuCores: 0,
    totalMemoryGB: '0',
    freeMemoryGB: '0',
};

const sysInfoMatch = output.match(/System Information:[\s\S]*?(?=Loading WebAssembly modules|$)/);
if (sysInfoMatch) {
    const sysText = sysInfoMatch[0];
    const platformMatch = sysText.match(/Platform:\s*([^(]+)\(([^)]+)\)/);
    const nodeMatch     = sysText.match(/Node\.js:\s*([^\n]+)/);
    const cpuMatch      = sysText.match(/CPU:\s*(\d+)x\s*([^\n]+)/);
    const memMatch      = sysText.match(/Memory:\s*([\d.]+)\s*GB total,\s*([\d.]+)\s*GB free/);

    if (platformMatch) {
        systemInfo.platform = platformMatch[1].trim();
        systemInfo.arch     = platformMatch[2].trim();
    }
    if (nodeMatch) systemInfo.nodeVersion = nodeMatch[1].trim();
    if (cpuMatch) {
        systemInfo.cpuCores = parseInt(cpuMatch[1], 10);
        systemInfo.cpuModel = cpuMatch[2].trim();
    }
    if (memMatch) {
        systemInfo.totalMemoryGB = memMatch[1];
        systemInfo.freeMemoryGB  = memMatch[2];
    }
}

// ---------------------------------------------------------------------------
// Parse benchmark results
// ---------------------------------------------------------------------------
const results = {
    timestamp:  new Date().toISOString(),
    commit:     process.env.GITHUB_SHA || 'local',
    ref:        process.env.GITHUB_REF || 'local',
    iterations: parseInt(process.env.ITERATIONS || '200', 10),
    systemInfo,
    benchmarks: [],
};

const lines = output.split('\n');
let currentBenchmark    = null;
let currentTestName     = 'unknown';
let currentBenchmarkType = null;
let inResults           = false;

for (const line of lines) {
    if (line.startsWith('Benchmark Results:')) {
        currentBenchmark = {
            name:          line.replace('Benchmark Results:', '').trim(),
            benchmarkType: null,
            tests:         [],
        };
        results.benchmarks.push(currentBenchmark);
        inResults            = false;
        currentTestName      = 'unknown';
        currentBenchmarkType = null;
    } else if (line.startsWith('Benchmark Type:')) {
        currentBenchmarkType = line.replace('Benchmark Type:', '').trim();
        if (currentBenchmark) currentBenchmark.benchmarkType = currentBenchmarkType;
    } else if (line.includes('Method') && line.includes('Avg')) {
        inResults = true;
    } else if (line.endsWith(':') && !line.includes('Benchmark') && !line.startsWith('-') && !line.startsWith('=')) {
        currentTestName = line.replace(':', '').trim();
        inResults       = false;
    } else if (inResults && line.trim() && !line.startsWith('-') && !line.startsWith('=')) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 5) {
            const method = parts[0];
            const avg    = parseFloat(parts[1]);
            const median = parseFloat(parts[2]);
            const min    = parseFloat(parts[3]);
            const p95    = parseFloat(parts[4]);

            if (!isNaN(avg) && currentBenchmark) {
                currentBenchmark.tests.push({
                    test:          currentTestName,
                    method,
                    benchmarkType: currentBenchmarkType,
                    avg,
                    median,
                    min,
                    p95,
                });
            }
        }
    }
}

writeFileSync(outputFile, JSON.stringify(results, null, 2));
console.log(`WASM benchmark results saved to ${outputFile}`);
