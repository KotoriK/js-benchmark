const performance = globalThis.performance ?? require('perf_hooks').performance;

const ITEM_COUNT = 100_000;

function measure(measurementName, fn) {
    fn();
    performance.measure(measurementName, 'start', 'end');
    performance.clearMarks();
}

function buildArray() {
    return Array.from({ length: ITEM_COUNT }, (_, i) => i);
}

function buildObject() {
    const obj = Object.create(null);
    for (let i = 0; i < ITEM_COUNT; i++) obj[i] = i;
    return obj;
}

function buildSet() {
    return new Set(buildArray());
}

function buildMap() {
    return new Map(buildArray().map(i => [i, i]));
}

function iterateArrayForIndex(testCase) {
    performance.mark('start');
    let sum = 0;
    for (let i = 0; i < testCase.length; i++) sum += testCase[i];
    performance.mark('end');
    return sum;
}

function iterateArrayForOf(testCase) {
    performance.mark('start');
    let sum = 0;
    for (const value of testCase) sum += value;
    performance.mark('end');
    return sum;
}

function iterateArrayForEach(testCase) {
    performance.mark('start');
    let sum = 0;
    testCase.forEach(value => { sum += value; });
    performance.mark('end');
    return sum;
}

function iterateArrayWhile(testCase) {
    performance.mark('start');
    let sum = 0;
    let i = 0;
    while (i < testCase.length) {
        sum += testCase[i];
        i++;
    }
    performance.mark('end');
    return sum;
}

function iterateObjectKeysFor(testCase) {
    performance.mark('start');
    let sum = 0;
    const keys = Object.keys(testCase);
    for (let i = 0; i < keys.length; i++) sum += testCase[keys[i]];
    performance.mark('end');
    return sum;
}

function iterateObjectForIn(testCase) {
    performance.mark('start');
    let sum = 0;
    for (const key in testCase) sum += testCase[key];
    performance.mark('end');
    return sum;
}

function iterateObjectEntriesForOf(testCase) {
    performance.mark('start');
    let sum = 0;
    for (const [, value] of Object.entries(testCase)) sum += value;
    performance.mark('end');
    return sum;
}

function iterateSetForOf(testCase) {
    performance.mark('start');
    let sum = 0;
    for (const value of testCase) sum += value;
    performance.mark('end');
    return sum;
}

function iterateSetForEach(testCase) {
    performance.mark('start');
    let sum = 0;
    testCase.forEach(value => { sum += value; });
    performance.mark('end');
    return sum;
}

function iterateSetIterator(testCase) {
    performance.mark('start');
    let sum = 0;
    const iterator = testCase.values();
    let entry = iterator.next();
    while (!entry.done) {
        sum += entry.value;
        entry = iterator.next();
    }
    performance.mark('end');
    return sum;
}

function iterateMapForOf(testCase) {
    performance.mark('start');
    let sum = 0;
    for (const [, value] of testCase) sum += value;
    performance.mark('end');
    return sum;
}

function iterateMapForEach(testCase) {
    performance.mark('start');
    let sum = 0;
    testCase.forEach(value => { sum += value; });
    performance.mark('end');
    return sum;
}

function iterateMapKeysGet(testCase) {
    performance.mark('start');
    let sum = 0;
    for (const key of testCase.keys()) sum += testCase.get(key);
    performance.mark('end');
    return sum;
}

function printMeasures(label) {
    const measures = performance.getEntriesByType('measure');
    performance.clearMeasures();
    console.group(`${label} iteration (${ITEM_COUNT.toLocaleString()} items)`);
    console.table(measures.map(({ name, duration }) => ({ name, duration })));
    console.groupEnd();
}

function runArray() {
    const testCase = buildArray();
    measure('for (index)', () => iterateArrayForIndex(testCase));
    measure('for...of', () => iterateArrayForOf(testCase));
    measure('forEach', () => iterateArrayForEach(testCase));
    measure('while', () => iterateArrayWhile(testCase));
    printMeasures('Array');
}

function runObject() {
    const testCase = buildObject();
    measure('Object.keys + for', () => iterateObjectKeysFor(testCase));
    measure('for...in', () => iterateObjectForIn(testCase));
    measure('Object.entries + for...of', () => iterateObjectEntriesForOf(testCase));
    printMeasures('Object');
}

function runSet() {
    const testCase = buildSet();
    measure('for...of', () => iterateSetForOf(testCase));
    measure('forEach', () => iterateSetForEach(testCase));
    measure('iterator.next()', () => iterateSetIterator(testCase));
    printMeasures('Set');
}

function runMap() {
    const testCase = buildMap();
    measure('for...of entries', () => iterateMapForOf(testCase));
    measure('forEach', () => iterateMapForEach(testCase));
    measure('keys() + get()', () => iterateMapKeysGet(testCase));
    printMeasures('Map');
}

runArray();
runObject();
runSet();
runMap();
