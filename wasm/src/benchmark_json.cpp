/**
 * @file benchmark_json.cpp
 * @brief WebAssembly benchmark using JSON for C++ to JS data transfer
 * 
 * This module benchmarks data transfer FROM C++ (WASM) TO JavaScript using JSON.
 * Data is serialized using yyjson in C++, then the raw JSON string is transferred
 * to JavaScript via direct WASM memory access (preamble.js APIs).
 * 
 * JavaScript should use UTF8ToString() or similar to read the string from WASM memory.
 */

#include <emscripten.h>
#include <string>
#include <cstring>
#include <cmath>
#include "yyjson.h"

// ============================================================================
// Data Generation and JSON Serialization
// ============================================================================

/**
 * Result struct to return pointer and length to JS
 */
struct StringResult {
    const char* ptr;
    size_t len;
};

// Global buffer for JSON output (to avoid memory management issues)
static std::string g_json_buffer;

/**
 * Generate a flat object as JSON
 */
extern "C" {

EMSCRIPTEN_KEEPALIVE
const char* generateFlatJSON(int nameLen) {
    yyjson_mut_doc *doc = yyjson_mut_doc_new(nullptr);
    yyjson_mut_val *root = yyjson_mut_obj(doc);
    yyjson_mut_doc_set_root(doc, root);
    
    yyjson_mut_obj_add_int(doc, root, "id", 42);
    
    std::string name(nameLen, 'x');
    yyjson_mut_obj_add_strcpy(doc, root, "name", name.c_str());
    yyjson_mut_obj_add_real(doc, root, "value", 3.14159265359);
    yyjson_mut_obj_add_bool(doc, root, "flag", true);
    
    char *json = yyjson_mut_write(doc, 0, nullptr);
    g_json_buffer = json;
    free(json);
    yyjson_mut_doc_free(doc);
    
    return g_json_buffer.c_str();
}

EMSCRIPTEN_KEEPALIVE
size_t getLastJSONLength() {
    return g_json_buffer.length();
}

EMSCRIPTEN_KEEPALIVE
const char* generateNestedJSON(int itemCount) {
    yyjson_mut_doc *doc = yyjson_mut_doc_new(nullptr);
    yyjson_mut_val *root = yyjson_mut_obj(doc);
    yyjson_mut_doc_set_root(doc, root);
    
    yyjson_mut_val *data = yyjson_mut_obj(doc);
    yyjson_mut_val *items = yyjson_mut_arr(doc);
    
    for (int i = 0; i < itemCount; i++) {
        yyjson_mut_val *item = yyjson_mut_obj(doc);
        yyjson_mut_obj_add_int(doc, item, "id", i);
        
        std::string name = "item_" + std::to_string(i);
        yyjson_mut_obj_add_strcpy(doc, item, "name", name.c_str());
        yyjson_mut_obj_add_real(doc, item, "value", static_cast<double>(i) * 1.5);
        yyjson_mut_arr_append(items, item);
    }
    
    yyjson_mut_obj_add_val(doc, data, "items", items);
    yyjson_mut_obj_add_val(doc, root, "data", data);
    
    char *json = yyjson_mut_write(doc, 0, nullptr);
    g_json_buffer = json;
    free(json);
    yyjson_mut_doc_free(doc);
    
    return g_json_buffer.c_str();
}

EMSCRIPTEN_KEEPALIVE
const char* generateNumberArrayJSON(int count) {
    yyjson_mut_doc *doc = yyjson_mut_doc_new(nullptr);
    yyjson_mut_val *arr = yyjson_mut_arr(doc);
    yyjson_mut_doc_set_root(doc, arr);
    
    for (int i = 0; i < count; i++) {
        double val = static_cast<double>(i) * 0.5 + sin(static_cast<double>(i));
        yyjson_mut_arr_add_real(doc, arr, val);
    }
    
    char *json = yyjson_mut_write(doc, 0, nullptr);
    g_json_buffer = json;
    free(json);
    yyjson_mut_doc_free(doc);
    
    return g_json_buffer.c_str();
}

EMSCRIPTEN_KEEPALIVE
const char* generateObjectArrayJSON(int count) {
    yyjson_mut_doc *doc = yyjson_mut_doc_new(nullptr);
    yyjson_mut_val *arr = yyjson_mut_arr(doc);
    yyjson_mut_doc_set_root(doc, arr);
    
    for (int i = 0; i < count; i++) {
        yyjson_mut_val *item = yyjson_mut_obj(doc);
        yyjson_mut_obj_add_int(doc, item, "id", i);
        
        std::string name = "object_" + std::to_string(i);
        yyjson_mut_obj_add_strcpy(doc, item, "name", name.c_str());
        yyjson_mut_obj_add_real(doc, item, "value", static_cast<double>(i) * 2.5);
        yyjson_mut_arr_append(arr, item);
    }
    
    char *json = yyjson_mut_write(doc, 0, nullptr);
    g_json_buffer = json;
    free(json);
    yyjson_mut_doc_free(doc);
    
    return g_json_buffer.c_str();
}

static void buildTreeJSON(yyjson_mut_doc *doc, yyjson_mut_val *node, int depth, int breadth) {
    yyjson_mut_obj_add_int(doc, node, "depth", depth);
    yyjson_mut_obj_add_int(doc, node, "breadth", breadth);
    
    if (depth > 0) {
        yyjson_mut_val *children = yyjson_mut_arr(doc);
        for (int i = 0; i < breadth; i++) {
            yyjson_mut_val *child = yyjson_mut_obj(doc);
            buildTreeJSON(doc, child, depth - 1, breadth);
            yyjson_mut_arr_append(children, child);
        }
        yyjson_mut_obj_add_val(doc, node, "children", children);
    }
}

EMSCRIPTEN_KEEPALIVE
const char* generateTreeJSON(int depth, int breadth) {
    yyjson_mut_doc *doc = yyjson_mut_doc_new(nullptr);
    yyjson_mut_val *root = yyjson_mut_obj(doc);
    yyjson_mut_doc_set_root(doc, root);
    
    buildTreeJSON(doc, root, depth, breadth);
    
    char *json = yyjson_mut_write(doc, 0, nullptr);
    g_json_buffer = json;
    free(json);
    yyjson_mut_doc_free(doc);
    
    return g_json_buffer.c_str();
}

} // extern "C"
