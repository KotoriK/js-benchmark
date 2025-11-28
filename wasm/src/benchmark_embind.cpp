/**
 * @file benchmark_embind.cpp
 * @brief WebAssembly benchmark using embind (emscripten::val)
 * 
 * This module demonstrates data transfer between JS and WASM using embind,
 * which provides automatic type conversion and object mapping.
 */

#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <vector>
#include <string>
#include <cstdint>
#include <map>

using namespace emscripten;

/**
 * Process a flat object with primitive types
 */
val processFlat(val obj) {
    val result = val::object();
    result.set("id", obj["id"]);
    result.set("name", obj["name"]);
    result.set("value", obj["value"]);
    result.set("flag", obj["flag"]);
    result.set("processed", true);
    return result;
}

/**
 * Process a nested object
 */
val processNested(val obj) {
    val result = val::object();
    result.set("type", std::string("nested"));
    result.set("original", obj);
    
    // Access nested data
    if (obj.hasOwnProperty("data")) {
        val data = obj["data"];
        if (data.hasOwnProperty("items")) {
            val items = data["items"];
            result.set("itemCount", items["length"]);
        }
    }
    return result;
}

/**
 * Process an array of numbers
 */
val processNumberArray(val arr) {
    size_t len = arr["length"].as<size_t>();
    double sum = 0;
    double min = len > 0 ? arr[0].as<double>() : 0;
    double max = min;
    
    for (size_t i = 0; i < len; i++) {
        double v = arr[i].as<double>();
        sum += v;
        if (v < min) min = v;
        if (v > max) max = v;
    }
    
    val result = val::object();
    result.set("count", static_cast<int>(len));
    result.set("sum", sum);
    result.set("avg", len > 0 ? sum / len : 0);
    result.set("min", min);
    result.set("max", max);
    return result;
}

/**
 * Process an array of objects
 */
val processObjectArray(val arr) {
    size_t len = arr["length"].as<size_t>();
    val results = val::array();
    
    for (size_t i = 0; i < len; i++) {
        val item = arr[i];
        val processed = val::object();
        processed.set("originalId", item["id"]);
        processed.set("processed", true);
        results.call<void>("push", processed);
    }
    
    return results;
}

/**
 * Create a complex nested structure
 */
val createComplexObject(int depth, int breadth) {
    val obj = val::object();
    obj.set("depth", depth);
    obj.set("breadth", breadth);
    
    if (depth > 0) {
        val children = val::array();
        for (int i = 0; i < breadth; i++) {
            children.call<void>("push", createComplexObject(depth - 1, breadth));
        }
        obj.set("children", children);
    }
    
    return obj;
}

/**
 * Count total nodes in a nested structure
 */
int countNodes(val obj) {
    int count = 1;
    if (obj.hasOwnProperty("children")) {
        val children = obj["children"];
        size_t len = children["length"].as<size_t>();
        for (size_t i = 0; i < len; i++) {
            count += countNodes(children[i]);
        }
    }
    return count;
}

EMSCRIPTEN_BINDINGS(benchmark_embind) {
    function("processFlat", &processFlat);
    function("processNested", &processNested);
    function("processNumberArray", &processNumberArray);
    function("processObjectArray", &processObjectArray);
    function("createComplexObject", &createComplexObject);
    function("countNodes", &countNodes);
}
