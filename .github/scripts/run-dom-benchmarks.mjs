/**
 * Discovers and runs all *.js benchmark scripts in the dom/ directory in
 * headless Chromium. Each script's console.group / console.table output is
 * captured as structured JSON.
 *
 * Output: dom-results.json in the repository root.
 */

import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { chromium } from 'playwright';
import { repoRoot, buildResultsObject } from './utils.mjs';

const domDir = join(repoRoot, 'dom');

const scripts = readdirSync(domDir)
    .filter(f => f.endsWith('.js'))
    .sort();

console.log(`Found ${scripts.length} DOM benchmark scripts: ${scripts.join(', ')}\n`);

const browser = await chromium.launch({ headless: true });
const allResults = [];

try {
    for (const script of scripts) {
        console.log(`Running ${script}...`);

        const code = readFileSync(join(domDir, script), 'utf8');
        const page = await browser.newPage();

        try {
            await page.setContent('<!DOCTYPE html><html><body></body></html>');
            await page.evaluate(() => {
                const groups = [];
                let currentGroup = null;

                window.console.group = label => {
                    currentGroup = { label: String(label ?? ''), measurements: [] };
                    groups.push(currentGroup);
                };
                window.console.table = data => {
                    if (currentGroup && Array.isArray(data)) {
                        currentGroup.measurements.push(...data);
                    }
                };
                window.console.groupEnd = () => {
                    currentGroup = null;
                };
                window.__benchmarkGroups = groups;
            });

            await page.addScriptTag({ content: code });
            const groups = await page.evaluate(() => window.__benchmarkGroups);
            allResults.push({ file: script, name: script.replace(/\.js$/, ''), groups });
        } catch (err) {
            console.error(`  Error running ${script}: ${err.message}`);
            allResults.push({
                file: script,
                name: script.replace(/\.js$/, ''),
                groups: [],
                error: err.message,
            });
        } finally {
            await page.close();
        }
    }
} finally {
    await browser.close();
}

const outputPath = join(repoRoot, 'dom-results.json');
writeFileSync(outputPath, JSON.stringify(buildResultsObject(allResults), null, 2));
console.log(`\nDOM benchmark results saved to ${outputPath}`);
