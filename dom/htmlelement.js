/**
 * 测试创建AudioElement，修改他们的属性，以及删除他们所需要的时间。应该看第一个属性就够了，就是创建HTMLElement是真的开销很大
 *
 * @author KotoriK
 */
const performance = globalThis.performance;

const ELEMENT_COUNT = 1000;

function create(array, eleNum) {
    for (let i = 0; i < eleNum; i++) {
        array.push(document.createElement('audio'));
    }
}

function modify(array, url) {
    for (const el of array) {
        el.src = url;
    }
}

function deleteGC(array) {
    while (array.length > 0) {
        array.shift();
    }
}

function deleteNull(array) {
    for (let i = 0; i < array.length; i++) {
        array[i] = null;
    }
}

function run() {
    var array = [];

    performance.mark('start');
    create(array, ELEMENT_COUNT);
    performance.mark('end');
    performance.measure('create', 'start', 'end');
    performance.clearMarks();

    performance.mark('start');
    modify(array, 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=');
    performance.mark('end');
    performance.measure('modify', 'start', 'end');
    performance.clearMarks();

    var array2 = [...array];

    performance.mark('start');
    deleteGC(array);
    performance.mark('end');
    performance.measure('deleteGC', 'start', 'end');
    performance.clearMarks();

    performance.mark('start');
    deleteNull(array2);
    performance.mark('end');
    performance.measure('deleteNull', 'start', 'end');
    performance.clearMarks();

    const measures = performance.getEntriesByType('measure');
    performance.clearMeasures();
    console.group(`HTMLElement Benchmark (${ELEMENT_COUNT} elements)`);
    console.table(measures.map(({ name, duration }) => ({ name, duration })));
    console.groupEnd();
}

run();