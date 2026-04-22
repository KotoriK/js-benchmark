const performance = globalThis.performance ?? require('perf_hooks').performance;

const SIZES = [10, 1_000, 100_000];

function measure(measurementName, fn) {
    performance.mark('start');
    try {
        fn();
    } finally {
        performance.mark('end');
    }
    performance.measure(measurementName, 'start', 'end');
    performance.clearMarks();
}

function buildArray(n) {
    return Array.from({ length: n }, (_, i) => i);
}

function buildObject(n) {
    const obj = Object.create(null);
    for (let i = 0; i < n; i++) obj[i] = i;
    return obj;
}

function buildSet(n) {
    return new Set(buildArray(n));
}

function buildMap(n) {
    const map = new Map();
    for (let i = 0; i < n; i++) map.set(i, i);
    return map;
}

function iterateArrayForIndex(testCase) {
    let sum = 0;
    for (let i = 0; i < testCase.length; i++) sum += testCase[i];
    return sum;
}

function iterateArrayForOf(testCase) {
    let sum = 0;
    for (const value of testCase) sum += value;
    return sum;
}

function iterateArrayForEach(testCase) {
    let sum = 0;
    testCase.forEach(value => { sum += value; });
    return sum;
}

function iterateArrayWhile(testCase) {
    let sum = 0;
    let i = 0;
    while (i < testCase.length) {
        sum += testCase[i];
        i++;
    }
    return sum;
}

function iterateObjectKeysFor(testCase) {
    let sum = 0;
    const keys = Object.keys(testCase);
    for (let i = 0; i < keys.length; i++) sum += testCase[keys[i]];
    return sum;
}

function iterateObjectForIn(testCase) {
    let sum = 0;
    for (const key in testCase) sum += testCase[key];
    return sum;
}

function iterateObjectEntriesForOf(testCase) {
    let sum = 0;
    for (const [, value] of Object.entries(testCase)) sum += value;
    return sum;
}

function iterateSetForOf(testCase) {
    let sum = 0;
    for (const value of testCase) sum += value;
    return sum;
}

function iterateSetForEach(testCase) {
    let sum = 0;
    testCase.forEach(value => { sum += value; });
    return sum;
}

function iterateSetIterator(testCase) {
    let sum = 0;
    const iterator = testCase.values();
    let entry = iterator.next();
    while (!entry.done) {
        sum += entry.value;
        entry = iterator.next();
    }
    return sum;
}

function iterateMapForOf(testCase) {
    let sum = 0;
    for (const [, value] of testCase) sum += value;
    return sum;
}

function iterateMapForEach(testCase) {
    let sum = 0;
    testCase.forEach(value => { sum += value; });
    return sum;
}

function iterateMapKeysGet(testCase) {
    let sum = 0;
    for (const key of testCase.keys()) sum += testCase.get(key);
    return sum;
}

function printMeasures(label, n) {
    const measures = performance.getEntriesByType('measure');
    performance.clearMeasures();
    console.group(`${label} iteration (${n.toLocaleString()} items)`);
    console.table(measures.map(({ name, duration }) => ({ name, duration })));
    console.groupEnd();
}

function runArray(n) {
    const testCase = buildArray(n);
    measure('for (index)', () => iterateArrayForIndex(testCase));
    measure('for...of', () => iterateArrayForOf(testCase));
    measure('forEach', () => iterateArrayForEach(testCase));
    measure('while', () => iterateArrayWhile(testCase));
    printMeasures('Array', n);
}

function runObject(n) {
    const testCase = buildObject(n);
    measure('Object.keys + for', () => iterateObjectKeysFor(testCase));
    measure('for...in', () => iterateObjectForIn(testCase));
    measure('Object.entries + for...of', () => iterateObjectEntriesForOf(testCase));
    printMeasures('Object', n);
}

function runSet(n) {
    const testCase = buildSet(n);
    measure('for...of', () => iterateSetForOf(testCase));
    measure('forEach', () => iterateSetForEach(testCase));
    measure('iterator.next()', () => iterateSetIterator(testCase));
    printMeasures('Set', n);
}

function runMap(n) {
    const testCase = buildMap(n);
    measure('for...of entries', () => iterateMapForOf(testCase));
    measure('forEach', () => iterateMapForEach(testCase));
    measure('keys() + get()', () => iterateMapKeysGet(testCase));
    printMeasures('Map', n);
}

for (const n of SIZES) {
    runArray(n);
    runObject(n);
    runSet(n);
    runMap(n);
}
