const performance = globalThis.performance ?? require('perf_hooks').performance;

function prepareCase(len) {
    return Array.from({ length: len }, () => Math.floor(Math.random() * len));
}

function testArraySlice(testCase) {
    performance.mark('start');
    const result = testCase.slice();
    performance.mark('end');
    return result
}

function testArrayFrom(testCase) {
    performance.mark('start');
    const result = Array.from(testCase);
    performance.mark('end');
    return result
}



function testArrayMap(testCase) {
    performance.mark('start');
    const result = testCase.map(i => i);
    performance.mark('end');
    return result
}

function testArraySpread(testCase) {
    performance.mark('start');
    const result = [...testCase];
    performance.mark('end');
    return result
}

function testArrayPush(testCase) {
    performance.mark('start');
    const result = [];
    for (const i of testCase) {
        result.push(i);
    }
    performance.mark('end');
    return result
}

function run(testCase) {
    {
        testArraySlice(testCase);
        performance.measure('[].slice', 'start', 'end');
        performance.clearMarks();
    }
    {
        testArrayFrom(testCase);
        performance.measure('Array.from', 'start', 'end');
        performance.clearMarks();

    }
    {
        testArrayMap(testCase);
        performance.measure('[].map', 'start', 'end');
        performance.clearMarks();

    }
    {
        testArraySpread(testCase);
        performance.measure('[...spread]', 'start', 'end');
        performance.clearMarks();
    }
    {
        testArrayPush(testCase);
        performance.measure('[].push', 'start', 'end');
        performance.clearMarks();
    }
    const measures = performance.getEntriesByType('measure');
    performance.clearMeasures();
    console.group(`Array clone 2^${Math.log2(testCase.length)}(${testCase.length}) items`);
    console.table(measures.map(({ name, duration }) => ({ name, duration })));
    console.groupEnd();
}

for (let i = 2; i < 32; i += 3) {
    const testCase = prepareCase(2 ** i);
    run(testCase)
}


