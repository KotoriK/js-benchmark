/**
 * 比较长列表中多级嵌套列表项的三种创建方式。
 */

const LIST_LENGTHS = [100, 1_000];
const NESTING_DEPTHS = [1, 5];

function appendNestedItem(parent, itemIndex, depth) {
    const item = document.createElement('li');
    item.textContent = `Item ${itemIndex}, level ${depth}`;

    if (depth > 1) {
        const nestedList = document.createElement('ul');
        appendNestedItem(nestedList, itemIndex, depth - 1);
        item.append(nestedList);
    }

    parent.append(item);
}

function createElementByElement(length, depth) {
    const list = document.createElement('ul');
    for (let i = 0; i < length; i++) {
        appendNestedItem(list, i, depth);
    }
    document.body.append(list);
}

function nestedListHtml(itemIndex, depth) {
    const item = `<li>Item ${itemIndex}, level ${depth}`;
    return depth === 1 ? `${item}</li>` : `${item}<ul>${nestedListHtml(itemIndex, depth - 1)}</ul></li>`;
}

function createWithInnerHtml(length, depth) {
    let html = '<ul>';
    for (let i = 0; i < length; i++) {
        html += nestedListHtml(i, depth);
    }
    document.body.innerHTML = `${html}</ul>`;
}

function createWithDocumentFragment(length, depth) {
    const list = document.createElement('ul');
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < length; i++) {
        appendNestedItem(fragment, i, depth);
    }
    list.append(fragment);
    document.body.append(list);
}

function measure(name, create) {
    document.body.replaceChildren();
    const start = performance.now();
    create();
    return performance.now() - start;
}

function run() {
    for (const length of LIST_LENGTHS) {
        for (const depth of NESTING_DEPTHS) {
            const measurements = [
                {
                    name: 'createElement',
                    duration: measure('createElement', () => createElementByElement(length, depth)),
                },
                {
                    name: 'innerHTML',
                    duration: measure('innerHTML', () => createWithInnerHtml(length, depth)),
                },
                {
                    name: 'DocumentFragment',
                    duration: measure('DocumentFragment', () => createWithDocumentFragment(length, depth)),
                },
            ];

            console.group(`Nested List Benchmark (${length} items, depth ${depth})`);
            console.table(measurements);
            console.groupEnd();
        }
    }

    document.body.replaceChildren();
}

run();
