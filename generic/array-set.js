/**
 * 测试set和array的添加、查找、删除元素性能。结论就是没有必要不要用shift。看来array并不能当Queue的js版？
 *
 * @author KotoriK
 */
const performance = globalThis.performance ?? require('perf_hooks').performance;

const TIMES = 10000;

function test(times) {
    var a = new Set(), b = [], c = [], d = [];

    // --- Add ---
    {
        performance.mark('start');
        for (let i = 0; i < times; i++) a.add(i);
        performance.mark('end');
        performance.measure('set add', 'start', 'end');
        performance.clearMarks();
    }
    {
        performance.mark('start');
        for (let i = 0; i < times; i++) b.push(i);
        performance.mark('end');
        performance.measure('array push', 'start', 'end');
        performance.clearMarks();
    }
    {
        performance.mark('start');
        for (let i = 0; i < times; i++) c.unshift(i);
        performance.mark('end');
        performance.measure('array unshift', 'start', 'end');
        performance.clearMarks();
    }
    {
        performance.mark('start');
        for (let i = 0; i < times; i++) d[i] = i;
        performance.mark('end');
        performance.measure('array [i]=i', 'start', 'end');
        performance.clearMarks();
    }

    // --- Get last ---
    {
        let last;
        performance.mark('start');
        for (let i = 0; i < times; i++) {
            let count = 0, target = a.size - 1;
            for (const v of a.values()) {
                if (count === target) { last = v; break; }
                count++;
            }
        }
        performance.mark('end');
        performance.measure('set getLast', 'start', 'end');
        performance.clearMarks();
    }
    {
        let last;
        performance.mark('start');
        for (let i = 0; i < times; i++) last = b[b.length - 1];
        performance.mark('end');
        performance.measure('array getLast', 'start', 'end');
        performance.clearMarks();
    }

    // --- Delete ---
    {
        performance.mark('start');
        for (let i = 0; i < times; i++) a.delete(i);
        performance.mark('end');
        performance.measure('set delete', 'start', 'end');
        performance.clearMarks();
    }
    {
        performance.mark('start');
        for (let i = 0; i < times; i++) b.pop();
        performance.mark('end');
        performance.measure('array pop', 'start', 'end');
        performance.clearMarks();
    }
    {
        performance.mark('start');
        for (let i = 0; i < times; i++) c.shift();
        performance.mark('end');
        performance.measure('array shift', 'start', 'end');
        performance.clearMarks();
    }

    const measures = performance.getEntriesByType('measure');
    performance.clearMeasures();
    console.group(`Set vs Array (${times.toLocaleString()} items)`);
    console.table(measures.map(({ name, duration }) => ({ name, duration })));
    console.groupEnd();
}

test(TIMES);