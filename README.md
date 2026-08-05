# js-benchmark

一组 JavaScript 性能基准测试，涵盖通用 JS、DOM 操作和 WebAssembly 数据传输场景。

**📊 测试结果：<https://KotoriK.github.io/js-benchmark/>**

## 测试分类

### Generic（通用 JS）
纯 JavaScript 运行时性能对比，包括：
- **array-clone** — 数组克隆方式（`slice` / `Array.from` / `map` / 展开运算符 / `push`）
- **array-set** — `Array` 与 `Set` 的增删查性能
- **iteration** — `Array` / `Object` / `Set` / `Map` 的多种遍历方式性能对比
- **coerce-to-number** — 各种数值强制转换方式
- **number-trunc** — 去除小数部分的方法（`Math.trunc` / `Math.floor` / `x | 0` / `~~x`）

### DOM
在 Chromium 浏览器环境中运行的 DOM 操作性能测试，包括：
- **htmlelement** — 批量创建 AudioElement、修改其属性以及清理引用的耗时对比
- **nested-list** — 在不同列表长度和嵌套深度下，逐个创建元素、使用 `innerHTML`、使用 `DocumentFragment` 构建多级列表的耗时对比

### WASM（WebAssembly）
测试从 C++（WASM）向 JavaScript 传输复杂对象数据的各种方式：
- embind（value_object）
- embind（manual val）
- JSON（yyjson + 内存直接访问）
- MessagePack（msgpack-c + HEAPU8 内存访问）
- typed-cstruct（原始 C 结构体 + 内存直接访问）

详见 [wasm/README.md](wasm/README.md)。
