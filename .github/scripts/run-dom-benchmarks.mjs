/**
 * Discovers and runs all *.js benchmark scripts in the dom/ directory using
 * jsdom to simulate a browser environment.  Each script's console.group /
 * console.table output is captured as structured JSON.
 *
 * Output: dom-results.json in the repository root.
 */

import { createRequire } from 'module';
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';
import vm from 'vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const _require = createRequire(import.meta.url);
const { JSDOM } = _require('jsdom');

const repoRoot = join(__dirname, '..', '..');
const domDir = join(repoRoot, 'dom');

const scripts = readdirSync(domDir)
    .filter(f => f.endsWith('.js'))
    .sort();

console.log(`Found ${scripts.length} DOM benchmark script(s): ${scripts.join(', ')}\n`);

const allResults = [];

for (const script of scripts) {
    console.log(`Running ${script}...`);

    const code = readFileSync(join(domDir, script), 'utf8');
    const groups = [];
    let currentGroup = null;

    try {
        const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
            url: 'http://localhost/',
            runScripts: 'dangerously',
        });

        const { window } = dom;

        // Obtain the raw VM context used by jsdom and inject the Node.js
        // performance API directly so benchmark scripts can call
        // performance.mark / measure / getEntriesByType.
        const vmContext = dom.getInternalVMContext();
        Object.defineProperty(vmContext, 'performance', {
            value: performance,
            writable: true,
            configurable: true,
        });

        // Patch console methods to capture benchmark results
        const capturedConsole = {
            group(label) {
                currentGroup = { label: String(label ?? ''), measurements: [] };
                groups.push(currentGroup);
                console.log(`  Group: ${label}`);
            },
            table(data) {
                if (currentGroup && Array.isArray(data)) {
                    currentGroup.measurements.push(...data);
                }
            },
            groupEnd() {
                currentGroup = null;
            },
            // Pass through other console methods to avoid script errors
            log: console.log.bind(console),
            warn: console.warn.bind(console),
            error: console.error.bind(console),
        };
        vmContext.console = capturedConsole;

        // Execute the benchmark script in the jsdom VM context
        vm.runInContext(code, vmContext, { filename: script });

        allResults.push({ file: script, name: script.replace(/\.js$/, ''), groups });
    } catch (err) {
        console.error(`  Error running ${script}: ${err.message}`);
        allResults.push({
            file: script,
            name: script.replace(/\.js$/, ''),
            groups: [],
            error: err.message,
        });
    }
}

const output = {
    timestamp: new Date().toISOString(),
    commit: process.env.GITHUB_SHA || 'local',
    ref: process.env.GITHUB_REF || 'local',
    benchmarks: allResults,
};

const outputPath = join(repoRoot, 'dom-results.json');
writeFileSync(outputPath, JSON.stringify(output, null, 2));
console.log(`\nDOM benchmark results saved to ${outputPath}`);
