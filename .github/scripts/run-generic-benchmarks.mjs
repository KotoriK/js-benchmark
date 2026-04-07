/**
 * Discovers and runs all *.js benchmark scripts in the generic/ directory.
 * Each script is executed in a child Node.js process with capture-console.cjs
 * preloaded so that console.group / console.table output is captured as JSON.
 *
 * Output: generic-results.json in the repository root.
 */

import { execFileSync } from 'child_process';
import { readdirSync, readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..');
const genericDir = join(repoRoot, 'generic');
const captureConsole = join(__dirname, 'capture-console.cjs');

/** Maximum milliseconds to wait for a single benchmark script to complete. */
const SCRIPT_TIMEOUT_MS = 180_000;

const scripts = readdirSync(genericDir)
    .filter(f => f.endsWith('.js'))
    .sort();

console.log(`Found ${scripts.length} generic benchmark script(s): ${scripts.join(', ')}\n`);

const allResults = [];

for (const script of scripts) {
    const scriptPath = join(genericDir, script);
    const outFile = join(tmpdir(), `benchmark-${script}-${Date.now()}.json`);

    console.log(`Running ${script}...`);

    try {
        execFileSync(process.execPath, ['--require', captureConsole, scriptPath], {
            env: { ...process.env, BENCHMARK_OUTPUT_FILE: outFile },
            timeout: SCRIPT_TIMEOUT_MS,
            stdio: ['ignore', 'inherit', 'pipe'],
        });

        if (existsSync(outFile)) {
            const groups = JSON.parse(readFileSync(outFile, 'utf8'));
            allResults.push({ file: script, name: script.replace(/\.js$/, ''), groups });
            unlinkSync(outFile);
        } else {
            console.warn(`  Warning: No output captured from ${script}`);
            allResults.push({
                file: script,
                name: script.replace(/\.js$/, ''),
                groups: [],
                error: 'No output captured',
            });
        }
    } catch (err) {
        const stderr = err.stderr ? err.stderr.toString().trim() : '';
        console.error(`  Error running ${script}: ${err.message}`);
        if (stderr) console.error(`  stderr: ${stderr.substring(0, 500)}`);
        allResults.push({
            file: script,
            name: script.replace(/\.js$/, ''),
            groups: [],
            error: err.message,
        });
        if (existsSync(outFile)) unlinkSync(outFile);
    }
}

const output = {
    timestamp: new Date().toISOString(),
    commit: process.env.GITHUB_SHA || 'local',
    ref: process.env.GITHUB_REF || 'local',
    benchmarks: allResults,
};

const outputPath = join(repoRoot, 'generic-results.json');
writeFileSync(outputPath, JSON.stringify(output, null, 2));
console.log(`\nGeneric benchmark results saved to ${outputPath}`);
