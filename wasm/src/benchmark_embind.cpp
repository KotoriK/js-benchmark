/**
 * @file benchmark_embind.cpp
 * @brief WebAssembly benchmark using embind for C++ to JS data transfer
 * 
 * This module benchmarks data transfer FROM C++ (WASM) TO JavaScript using embind.
 * Two approaches are tested:
 * 1. value_object: Register C++ structs with embind for automatic conversion
 * 2. Manual val: Build JS objects manually using emscripten::val
 */

#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <vector>
#include <string>
#include <cstdint>
#include <cmath>

using namespace emscripten;

// ============================================================================
// Test Data Structures (for value_object approach)
// ============================================================================

struct FlatObject {
    int id;
    std::string name;
    double value;
    bool flag;
};

struct Item {
    int id;
    std::string name;
    double value;
};

struct NestedData {
    std::vector<Item> items;
};

struct NestedObject {
    NestedData data;
};

struct TreeNode {
    int depth;
    int breadth;
    std::vector<TreeNode> children;
};

// ============================================================================
// Data Generation Functions
// ============================================================================

/**
 * Generate a flat object with specified string length
 */
FlatObject generateFlatStruct(int nameLen) {
    FlatObject obj;
    obj.id = 42;
    obj.name = std::string(nameLen, 'x');
    obj.value = 3.14159265359;
    obj.flag = true;
    return obj;
}

/**
 * Generate flat object using manual val construction
 */
val generateFlatManual(int nameLen) {
    val obj = val::object();
    obj.set("id", 42);
    obj.set("name", std::string(nameLen, 'x'));
    obj.set("value", 3.14159265359);
    obj.set("flag", true);
    return obj;
}

/**
 * Generate nested object struct
 */
NestedObject generateNestedStruct(int itemCount) {
    NestedObject result;
    for (int i = 0; i < itemCount; i++) {
        Item item;
        item.id = i;
        item.name = "item_" + std::to_string(i);
        item.value = static_cast<double>(i) * 1.5;
        result.data.items.push_back(item);
    }
    return result;
}

/**
 * Generate nested object using manual val construction
 */
val generateNestedManual(int itemCount) {
    val items = val::array();
    for (int i = 0; i < itemCount; i++) {
        val item = val::object();
        item.set("id", i);
        item.set("name", "item_" + std::to_string(i));
        item.set("value", static_cast<double>(i) * 1.5);
        items.call<void>("push", item);
    }
    
    val data = val::object();
    data.set("items", items);
    
    val result = val::object();
    result.set("data", data);
    return result;
}

/**
 * Generate number array as vector
 */
std::vector<double> generateNumberArrayStruct(int count) {
    std::vector<double> arr;
    arr.reserve(count);
    for (int i = 0; i < count; i++) {
        arr.push_back(static_cast<double>(i) * 0.5 + sin(static_cast<double>(i)));
    }
    return arr;
}

/**
 * Generate number array using manual val construction
 */
val generateNumberArrayManual(int count) {
    val arr = val::array();
    for (int i = 0; i < count; i++) {
        arr.call<void>("push", static_cast<double>(i) * 0.5 + sin(static_cast<double>(i)));
    }
    return arr;
}

/**
 * Generate object array struct
 */
std::vector<Item> generateObjectArrayStruct(int count) {
    std::vector<Item> arr;
    arr.reserve(count);
    for (int i = 0; i < count; i++) {
        Item item;
        item.id = i;
        item.name = "object_" + std::to_string(i);
        item.value = static_cast<double>(i) * 2.5;
        arr.push_back(item);
    }
    return arr;
}

/**
 * Generate object array using manual val construction
 */
val generateObjectArrayManual(int count) {
    val arr = val::array();
    for (int i = 0; i < count; i++) {
        val item = val::object();
        item.set("id", i);
        item.set("name", "object_" + std::to_string(i));
        item.set("value", static_cast<double>(i) * 2.5);
        arr.call<void>("push", item);
    }
    return arr;
}

/**
 * Generate tree structure (struct version)
 */
TreeNode generateTreeStruct(int depth, int breadth) {
    TreeNode node;
    node.depth = depth;
    node.breadth = breadth;
    if (depth > 0) {
        for (int i = 0; i < breadth; i++) {
            node.children.push_back(generateTreeStruct(depth - 1, breadth));
        }
    }
    return node;
}

/**
 * Generate tree structure using manual val construction
 */
val generateTreeManual(int depth, int breadth) {
    val node = val::object();
    node.set("depth", depth);
    node.set("breadth", breadth);
    if (depth > 0) {
        val children = val::array();
        for (int i = 0; i < breadth; i++) {
            children.call<void>("push", generateTreeManual(depth - 1, breadth));
        }
        node.set("children", children);
    }
    return node;
}

// ============================================================================
// Embind Bindings
// ============================================================================

EMSCRIPTEN_BINDINGS(benchmark_embind) {
    // Register value_object types for automatic conversion
    value_object<FlatObject>("FlatObject")
        .field("id", &FlatObject::id)
        .field("name", &FlatObject::name)
        .field("value", &FlatObject::value)
        .field("flag", &FlatObject::flag);
    
    value_object<Item>("Item")
        .field("id", &Item::id)
        .field("name", &Item::name)
        .field("value", &Item::value);
    
    value_object<NestedData>("NestedData")
        .field("items", &NestedData::items);
    
    value_object<NestedObject>("NestedObject")
        .field("data", &NestedObject::data);
    
    value_object<TreeNode>("TreeNode")
        .field("depth", &TreeNode::depth)
        .field("breadth", &TreeNode::breadth)
        .field("children", &TreeNode::children);
    
    // Register vector types
    register_vector<double>("VectorDouble");
    register_vector<Item>("VectorItem");
    register_vector<TreeNode>("VectorTreeNode");
    
    // Functions using value_object (automatic conversion)
    function("generateFlatStruct", &generateFlatStruct);
    function("generateNestedStruct", &generateNestedStruct);
    function("generateNumberArrayStruct", &generateNumberArrayStruct);
    function("generateObjectArrayStruct", &generateObjectArrayStruct);
    function("generateTreeStruct", &generateTreeStruct);
    
    // Functions using manual val construction
    function("generateFlatManual", &generateFlatManual);
    function("generateNestedManual", &generateNestedManual);
    function("generateNumberArrayManual", &generateNumberArrayManual);
    function("generateObjectArrayManual", &generateObjectArrayManual);
    function("generateTreeManual", &generateTreeManual);
}
