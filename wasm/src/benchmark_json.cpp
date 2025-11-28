/**
 * @file benchmark_json.cpp
 * @brief WebAssembly benchmark using JSON with yyjson
 * 
 * This module demonstrates data transfer between JS and WASM using
 * JSON serialization/deserialization via the yyjson library.
 */

#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <string>
#include <cstring>
#include "yyjson.h"

using namespace emscripten;

/**
 * Process a flat JSON object
 */
std::string processFlat(const std::string& jsonStr) {
    yyjson_doc *doc = yyjson_read(jsonStr.c_str(), jsonStr.length(), 0);
    if (!doc) return "{}";
    
    yyjson_val *root = yyjson_doc_get_root(doc);
    
    yyjson_mut_doc *mut_doc = yyjson_mut_doc_new(nullptr);
    yyjson_mut_val *result = yyjson_mut_obj(mut_doc);
    yyjson_mut_doc_set_root(mut_doc, result);
    
    // Copy fields with type checking and add processed flag
    yyjson_val *id = yyjson_obj_get(root, "id");
    yyjson_val *name = yyjson_obj_get(root, "name");
    yyjson_val *value = yyjson_obj_get(root, "value");
    yyjson_val *flag = yyjson_obj_get(root, "flag");
    
    if (id && yyjson_is_int(id)) {
        yyjson_mut_obj_add_int(mut_doc, result, "id", yyjson_get_int(id));
    }
    if (name && yyjson_is_str(name)) {
        yyjson_mut_obj_add_strcpy(mut_doc, result, "name", yyjson_get_str(name));
    }
    if (value && (yyjson_is_real(value) || yyjson_is_int(value))) {
        yyjson_mut_obj_add_real(mut_doc, result, "value", yyjson_get_num(value));
    }
    if (flag && yyjson_is_bool(flag)) {
        yyjson_mut_obj_add_bool(mut_doc, result, "flag", yyjson_get_bool(flag));
    }
    yyjson_mut_obj_add_bool(mut_doc, result, "processed", true);
    
    char *json = yyjson_mut_write(mut_doc, 0, nullptr);
    std::string resultStr(json);
    free(json);
    
    yyjson_mut_doc_free(mut_doc);
    yyjson_doc_free(doc);
    
    return resultStr;
}

/**
 * Process a nested JSON object
 */
std::string processNested(const std::string& jsonStr) {
    yyjson_doc *doc = yyjson_read(jsonStr.c_str(), jsonStr.length(), 0);
    if (!doc) return "{}";
    
    yyjson_val *root = yyjson_doc_get_root(doc);
    
    yyjson_mut_doc *mut_doc = yyjson_mut_doc_new(nullptr);
    yyjson_mut_val *result = yyjson_mut_obj(mut_doc);
    yyjson_mut_doc_set_root(mut_doc, result);
    
    yyjson_mut_obj_add_str(mut_doc, result, "type", "nested");
    
    // Count items if nested structure exists
    yyjson_val *data = yyjson_obj_get(root, "data");
    if (data) {
        yyjson_val *items = yyjson_obj_get(data, "items");
        if (items && yyjson_is_arr(items)) {
            size_t count = yyjson_arr_size(items);
            yyjson_mut_obj_add_int(mut_doc, result, "itemCount", count);
        }
    }
    
    char *json = yyjson_mut_write(mut_doc, 0, nullptr);
    std::string resultStr(json);
    free(json);
    
    yyjson_mut_doc_free(mut_doc);
    yyjson_doc_free(doc);
    
    return resultStr;
}

/**
 * Process a JSON array of numbers
 */
std::string processNumberArray(const std::string& jsonStr) {
    yyjson_doc *doc = yyjson_read(jsonStr.c_str(), jsonStr.length(), 0);
    if (!doc) return "{}";
    
    yyjson_val *root = yyjson_doc_get_root(doc);
    if (!yyjson_is_arr(root)) {
        yyjson_doc_free(doc);
        return "{}";
    }
    
    size_t len = yyjson_arr_size(root);
    double sum = 0;
    double min = 0, max = 0;
    
    if (len > 0) {
        yyjson_val *first = yyjson_arr_get_first(root);
        min = max = yyjson_get_num(first);
    }
    
    size_t idx, max_idx;
    yyjson_val *val;
    yyjson_arr_foreach(root, idx, max_idx, val) {
        double v = yyjson_get_num(val);
        sum += v;
        if (v < min) min = v;
        if (v > max) max = v;
    }
    
    yyjson_mut_doc *mut_doc = yyjson_mut_doc_new(nullptr);
    yyjson_mut_val *result = yyjson_mut_obj(mut_doc);
    yyjson_mut_doc_set_root(mut_doc, result);
    
    yyjson_mut_obj_add_int(mut_doc, result, "count", len);
    yyjson_mut_obj_add_real(mut_doc, result, "sum", sum);
    yyjson_mut_obj_add_real(mut_doc, result, "avg", len > 0 ? sum / len : 0);
    yyjson_mut_obj_add_real(mut_doc, result, "min", min);
    yyjson_mut_obj_add_real(mut_doc, result, "max", max);
    
    char *json = yyjson_mut_write(mut_doc, 0, nullptr);
    std::string resultStr(json);
    free(json);
    
    yyjson_mut_doc_free(mut_doc);
    yyjson_doc_free(doc);
    
    return resultStr;
}

/**
 * Process a JSON array of objects
 */
std::string processObjectArray(const std::string& jsonStr) {
    yyjson_doc *doc = yyjson_read(jsonStr.c_str(), jsonStr.length(), 0);
    if (!doc) return "[]";
    
    yyjson_val *root = yyjson_doc_get_root(doc);
    if (!yyjson_is_arr(root)) {
        yyjson_doc_free(doc);
        return "[]";
    }
    
    yyjson_mut_doc *mut_doc = yyjson_mut_doc_new(nullptr);
    yyjson_mut_val *results = yyjson_mut_arr(mut_doc);
    yyjson_mut_doc_set_root(mut_doc, results);
    
    size_t idx, max_idx;
    yyjson_val *val;
    yyjson_arr_foreach(root, idx, max_idx, val) {
        yyjson_val *id = yyjson_obj_get(val, "id");
        
        yyjson_mut_val *item = yyjson_mut_obj(mut_doc);
        if (id) yyjson_mut_obj_add_int(mut_doc, item, "originalId", yyjson_get_int(id));
        yyjson_mut_obj_add_bool(mut_doc, item, "processed", true);
        yyjson_mut_arr_append(results, item);
    }
    
    char *json = yyjson_mut_write(mut_doc, 0, nullptr);
    std::string resultStr(json);
    free(json);
    
    yyjson_mut_doc_free(mut_doc);
    yyjson_doc_free(doc);
    
    return resultStr;
}

static yyjson_mut_val* createComplexObjectHelper(yyjson_mut_doc *doc, int depth, int breadth) {
    yyjson_mut_val *obj = yyjson_mut_obj(doc);
    yyjson_mut_obj_add_int(doc, obj, "depth", depth);
    yyjson_mut_obj_add_int(doc, obj, "breadth", breadth);
    
    if (depth > 0) {
        yyjson_mut_val *children = yyjson_mut_arr(doc);
        for (int i = 0; i < breadth; i++) {
            yyjson_mut_arr_append(children, createComplexObjectHelper(doc, depth - 1, breadth));
        }
        yyjson_mut_obj_add_val(doc, obj, "children", children);
    }
    
    return obj;
}

/**
 * Create a complex nested JSON structure
 */
std::string createComplexObject(int depth, int breadth) {
    yyjson_mut_doc *mut_doc = yyjson_mut_doc_new(nullptr);
    yyjson_mut_val *result = createComplexObjectHelper(mut_doc, depth, breadth);
    yyjson_mut_doc_set_root(mut_doc, result);
    
    char *json = yyjson_mut_write(mut_doc, 0, nullptr);
    std::string resultStr(json);
    free(json);
    
    yyjson_mut_doc_free(mut_doc);
    
    return resultStr;
}

static int countNodesHelper(yyjson_val *obj) {
    int count = 1;
    yyjson_val *children = yyjson_obj_get(obj, "children");
    if (children && yyjson_is_arr(children)) {
        size_t idx, max_idx;
        yyjson_val *child;
        yyjson_arr_foreach(children, idx, max_idx, child) {
            count += countNodesHelper(child);
        }
    }
    return count;
}

/**
 * Count total nodes in a nested JSON structure
 */
int countNodes(const std::string& jsonStr) {
    yyjson_doc *doc = yyjson_read(jsonStr.c_str(), jsonStr.length(), 0);
    if (!doc) return 0;
    
    yyjson_val *root = yyjson_doc_get_root(doc);
    int count = countNodesHelper(root);
    
    yyjson_doc_free(doc);
    return count;
}

EMSCRIPTEN_BINDINGS(benchmark_json) {
    function("processFlat", &processFlat);
    function("processNested", &processNested);
    function("processNumberArray", &processNumberArray);
    function("processObjectArray", &processObjectArray);
    function("createComplexObject", &createComplexObject);
    function("countNodes", &countNodes);
}
