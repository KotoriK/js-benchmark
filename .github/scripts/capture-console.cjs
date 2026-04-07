'use strict';

/**
 * Preload script that captures console.group / console.table output from
 * benchmark scripts and writes structured JSON to BENCHMARK_OUTPUT_FILE.
 *
 * Usage:
 *   node --require ./capture-console.cjs <benchmark-script.js>
 *
 * The file path to write results to must be set via the environment variable
 * BENCHMARK_OUTPUT_FILE before invoking node.
 */

const fs = require('fs');

const groups = [];
let currentGroup = null;

const _group = console.group.bind(console);
const _table = console.table.bind(console);
const _groupEnd = console.groupEnd.bind(console);

console.group = function (...args) {
    currentGroup = { label: String(args[0] ?? ''), measurements: [] };
    groups.push(currentGroup);
    _group(...args);
};

console.table = function (data, ...rest) {
    if (currentGroup && Array.isArray(data)) {
        currentGroup.measurements.push(...data);
    }
    _table(data, ...rest);
};

console.groupEnd = function (...args) {
    currentGroup = null;
    _groupEnd(...args);
};

process.on('exit', function () {
    const outFile = process.env.BENCHMARK_OUTPUT_FILE;
    if (outFile && groups.length > 0) {
        try {
            fs.writeFileSync(outFile, JSON.stringify(groups));
        } catch (_) {
            // Ignore write errors on exit
        }
    }
});
