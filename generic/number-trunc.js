/**
 * 测试去除数字小数部分的几种方法之间的运行时差距。
 * 包括 Math.trunc, Math.floor, x | 0, ~~x
 *
 * @author KotoriK
 */
const performance = globalThis.performance ?? require('perf_hooks').performance;

function prepareCase(len) {
    return Array.from({ length: len }, () => Math.random() * 1e9 - 5e8);
}

function testMathTrunc(testCase) {
    performance.mark('start');
    const result = testCase.map(x => Math.trunc(x));
    performance.mark('end');
    return result;
}

function testMathFloor(testCase) {
    performance.mark('start');
    const result = testCase.map(x => Math.floor(x));
    performance.mark('end');
    return result;
}

function testBitwiseOr(testCase) {
    performance.mark('start');
    const result = testCase.map(x => x | 0);
    performance.mark('end');
    return result;
}

function testDoubleBitwiseNot(testCase) {
    performance.mark('start');
    const result = testCase.map(x => ~~x);
    performance.mark('end');
    return result;
}

function run(testCase) {
    {
        testMathTrunc(testCase);
        performance.measure('Math.trunc', 'start', 'end');
        performance.clearMarks();
    }
    {
        testMathFloor(testCase);
        performance.measure('Math.floor', 'start', 'end');
        performance.clearMarks();
    }
    {
        testBitwiseOr(testCase);
        performance.measure('x | 0', 'start', 'end');
        performance.clearMarks();
    }
    {
        testDoubleBitwiseNot(testCase);
        performance.measure('~~x', 'start', 'end');
        performance.clearMarks();
    }
    const measures = performance.getEntriesByType('measure');
    performance.clearMeasures();
    console.group(`Number trunc 2^${Math.log2(testCase.length)}(${testCase.length}) items`);
    console.table(measures.map(({ name, duration }) => ({ name, duration })));
    console.groupEnd();
}

for (let i = 2; i < 25; i += 3) {
    const testCase = prepareCase(2 ** i);
    run(testCase);
}
