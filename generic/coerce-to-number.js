const performance = globalThis.performance ?? require('perf_hooks').performance;

const ITERATIONS = 1_000_000;

// --- Boolean coercion ---

function boolBitwiseOr(testCase) {
    performance.mark('start');
    let result = 0;
    for (let i = 0; i < testCase.length; i++) {
        result = testCase[i] | 0;
    }
    performance.mark('end');
    return result;
}

function boolDoubleNot(testCase) {
    performance.mark('start');
    let result = 0;
    for (let i = 0; i < testCase.length; i++) {
        result = ~~testCase[i];
    }
    performance.mark('end');
    return result;
}

function boolUnaryPlus(testCase) {
    performance.mark('start');
    let result = 0;
    for (let i = 0; i < testCase.length; i++) {
        result = +testCase[i];
    }
    performance.mark('end');
    return result;
}

function boolNumberConstructor(testCase) {
    performance.mark('start');
    let result = 0;
    for (let i = 0; i < testCase.length; i++) {
        result = Number(testCase[i]);
    }
    performance.mark('end');
    return result;
}

function boolTernary(testCase) {
    performance.mark('start');
    let result = 0;
    for (let i = 0; i < testCase.length; i++) {
        result = testCase[i] ? 1 : 0;
    }
    performance.mark('end');
    return result;
}

// --- String coercion ---

function strBitwiseOr(testCase) {
    performance.mark('start');
    let result = 0;
    for (let i = 0; i < testCase.length; i++) {
        result = testCase[i] | 0;
    }
    performance.mark('end');
    return result;
}

function strDoubleNot(testCase) {
    performance.mark('start');
    let result = 0;
    for (let i = 0; i < testCase.length; i++) {
        result = ~~testCase[i];
    }
    performance.mark('end');
    return result;
}

function strUnaryPlus(testCase) {
    performance.mark('start');
    let result = 0;
    for (let i = 0; i < testCase.length; i++) {
        result = +testCase[i];
    }
    performance.mark('end');
    return result;
}

function strNumberConstructor(testCase) {
    performance.mark('start');
    let result = 0;
    for (let i = 0; i < testCase.length; i++) {
        result = Number(testCase[i]);
    }
    performance.mark('end');
    return result;
}

function strParseInt(testCase) {
    performance.mark('start');
    let result = 0;
    for (let i = 0; i < testCase.length; i++) {
        result = parseInt(testCase[i], 10);
    }
    performance.mark('end');
    return result;
}

function strParseFloat(testCase) {
    performance.mark('start');
    let result = 0;
    for (let i = 0; i < testCase.length; i++) {
        result = parseFloat(testCase[i]);
    }
    performance.mark('end');
    return result;
}

function measure(label, fn, testCase) {
    fn(testCase);
    performance.measure(label, 'start', 'end');
    performance.clearMarks();
}

function runBoolean() {
    const booleans = Array.from({ length: ITERATIONS }, () => Math.random() < 0.5);

    measure('x | 0', boolBitwiseOr, booleans);
    measure('~~x', boolDoubleNot, booleans);
    measure('+x', boolUnaryPlus, booleans);
    measure('Number(x)', boolNumberConstructor, booleans);
    measure('x ? 1 : 0', boolTernary, booleans);

    const measures = performance.getEntriesByType('measure');
    performance.clearMeasures();
    console.group(`Boolean → Number (${ITERATIONS.toLocaleString()} iterations)`);
    console.table(measures.map(({ name, duration }) => ({ name, duration })));
    console.groupEnd();
}

function runString() {
    const strings = Array.from({ length: ITERATIONS }, () => String(Math.floor(Math.random() * ITERATIONS)));

    measure('x | 0', strBitwiseOr, strings);
    measure('~~x', strDoubleNot, strings);
    measure('+x', strUnaryPlus, strings);
    measure('Number(x)', strNumberConstructor, strings);
    measure('parseInt(x, 10)', strParseInt, strings);
    measure('parseFloat(x)', strParseFloat, strings);

    const measures = performance.getEntriesByType('measure');
    performance.clearMeasures();
    console.group(`String → Number (${ITERATIONS.toLocaleString()} iterations)`);
    console.table(measures.map(({ name, duration }) => ({ name, duration })));
    console.groupEnd();
}

runBoolean();
runString();
