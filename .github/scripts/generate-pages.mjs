/**
 * Merges benchmark result JSON files from all categories and generates the
 * GitHub Pages output directory.
 *
 * Reads (all optional):
 *   generic-results.json
 *   dom-results.json
 *   wasm-results.json
 *
 * Writes to ./public/:
 *   benchmark-data.json  – merged results consumed by index.html
 *   index.html           – report page (copied from index-template.html)
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { scriptsDir, repoRoot, tryReadJson } from './utils.mjs';

const publicDir = join(repoRoot, 'public');

const genericResults = tryReadJson(join(repoRoot, 'generic-results.json'));
const domResults     = tryReadJson(join(repoRoot, 'dom-results.json'));
const wasmResults    = tryReadJson(join(repoRoot, 'wasm-results.json'));

if (!genericResults && !domResults && !wasmResults) {
    console.error('Error: No benchmark result files found. Exiting.');
    process.exit(1);
}

// ---------------------------------------------------------------------------
// Build unified data object
// ---------------------------------------------------------------------------
const benchmarkData = {
    timestamp:  new Date().toISOString(),
    commit:     process.env.GITHUB_SHA || 'local',
    ref:        process.env.GITHUB_REF || 'local',
    systemInfo: wasmResults?.systemInfo || null,
    categories: {},
};

if (genericResults) {
    benchmarkData.categories.generic = {
        title:      'Generic JavaScript',
        type:       'simple',
        timestamp:  genericResults.timestamp,
        benchmarks: genericResults.benchmarks,
    };
}
if (domResults) {
    benchmarkData.categories.dom = {
        title:      'DOM',
        type:       'simple',
        timestamp:  domResults.timestamp,
        benchmarks: domResults.benchmarks,
    };
}
if (wasmResults) {
    benchmarkData.categories.wasm = {
        title:      'WebAssembly',
        type:       'wasm',
        timestamp:  wasmResults.timestamp,
        iterations: wasmResults.iterations,
        benchmarks: wasmResults.benchmarks,
    };
}

// ---------------------------------------------------------------------------
// Write output files
// ---------------------------------------------------------------------------
if (existsSync(publicDir)) {
    rmSync(publicDir, { recursive: true, force: true });
}
mkdirSync(publicDir, { recursive: true });

writeFileSync(
    join(publicDir, 'benchmark-data.json'),
    JSON.stringify(benchmarkData, null, 2),
);
console.log('Written: public/benchmark-data.json');

const templatePath = join(scriptsDir, 'index-template.html');
writeFileSync(join(publicDir, 'index.html'), readFileSync(templatePath, 'utf8'));
console.log('Written: public/index.html');

console.log('\nGitHub Pages content generated in ./public/');
