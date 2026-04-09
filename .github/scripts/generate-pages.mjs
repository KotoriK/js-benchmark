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
 *   index.html + assets  – built by Vite (pages/dist/), or falls back to
 *                          index-template.html for local development
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, cpSync } from 'fs';
import { join } from 'path';
import { scriptsDir, repoRoot, tryReadJson, buildSystemInfo } from './utils.mjs';

const publicDir   = join(repoRoot, 'public');
const pagesDistDir = join(scriptsDir, 'pages', 'dist');

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

// Prefer WASM systemInfo (most complete), then generic/dom, then local
const systemInfo =
    wasmResults?.systemInfo    ||
    genericResults?.systemInfo ||
    domResults?.systemInfo     ||
    buildSystemInfo();

const repoEnv = process.env.GITHUB_REPOSITORY;
const repoUrl = repoEnv ? `https://github.com/${repoEnv}` : null;

const benchmarkData = {
    timestamp:  new Date().toISOString(),
    commit:     process.env.GITHUB_SHA || 'local',
    repoUrl,
    ref:        process.env.GITHUB_REF || 'local',
    systemInfo,
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

// Copy built Vite assets (preferred) or fall back to the legacy template
if (existsSync(pagesDistDir)) {
    cpSync(pagesDistDir, publicDir, { recursive: true });
    console.log('Copied: pages/dist → public/');
} else {
    const templatePath = join(scriptsDir, 'index-template.html');
    writeFileSync(join(publicDir, 'index.html'), readFileSync(templatePath, 'utf8'));
    console.log('Written: public/index.html (legacy template – run pages build for production)');
}

console.log('\nGitHub Pages content generated in ./public/');
