/**
 * Shared utilities for benchmark runner scripts.
 */

import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

/** Absolute path to the `.github/scripts/` directory. */
export const scriptsDir = dirname(fileURLToPath(import.meta.url));

/** Absolute path to the repository root. */
export const repoRoot = join(scriptsDir, '..', '..');

/**
 * Build a standard result object for a benchmark category.
 *
 * @param {object[]} benchmarks
 * @returns {{ timestamp: string, commit: string, ref: string, benchmarks: object[] }}
 */
export function buildResultsObject(benchmarks) {
    return {
        timestamp: new Date().toISOString(),
        commit:    process.env.GITHUB_SHA || 'local',
        ref:       process.env.GITHUB_REF || 'local',
        benchmarks,
    };
}

/**
 * Read and parse a JSON file, returning null on any error.
 *
 * @param {string} filePath
 * @returns {object|null}
 */
export function tryReadJson(filePath) {
    if (!existsSync(filePath)) return null;
    try {
        return JSON.parse(readFileSync(filePath, 'utf8'));
    } catch (err) {
        console.warn(`Warning: Failed to parse ${filePath}: ${err.message}`);
        return null;
    }
}
