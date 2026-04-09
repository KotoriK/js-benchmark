/**
 * Shared utilities for benchmark runner scripts.
 */

import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

/** Absolute path to the `.github/scripts/` directory. */
export const scriptsDir = dirname(fileURLToPath(import.meta.url));

/** Absolute path to the repository root. */
export const repoRoot = join(scriptsDir, '..', '..');

/**
 * Collect system information from the current Node.js process.
 *
 * @returns {{ platform: string, arch: string, nodeVersion: string, cpuModel: string, cpuSpeed: number, cpuCores: number, totalMemoryGB: string, freeMemoryGB: string }}
 */
export function buildSystemInfo() {
    const cpus = os.cpus();
    return {
        platform:      process.platform,
        arch:          process.arch,
        nodeVersion:   process.version,
        cpuModel:      cpus[0]?.model || 'Unknown',
        cpuSpeed:      cpus[0]?.speed || 0,
        cpuCores:      cpus.length,
        totalMemoryGB: (os.totalmem() / 1024 / 1024 / 1024).toFixed(2),
        freeMemoryGB:  (os.freemem()  / 1024 / 1024 / 1024).toFixed(2),
    };
}

/**
 * Build a standard result object for a benchmark category.
 *
 * @param {object[]} benchmarks
 * @returns {{ timestamp: string, commit: string, ref: string, systemInfo: object, benchmarks: object[] }}
 */
export function buildResultsObject(benchmarks) {
    return {
        timestamp:  new Date().toISOString(),
        commit:     process.env.GITHUB_SHA || 'local',
        ref:        process.env.GITHUB_REF || 'local',
        systemInfo: buildSystemInfo(),
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
