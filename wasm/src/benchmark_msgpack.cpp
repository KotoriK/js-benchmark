/**
 * @file benchmark_msgpack.cpp
 * @brief WebAssembly benchmark using MessagePack for C++ to JS data transfer
 * 
 * This module benchmarks data transfer FROM C++ (WASM) TO JavaScript using MessagePack.
 * Data is serialized using msgpack-c library in C++, then the raw binary data is
 * transferred to JavaScript via direct WASM memory access (HEAPU8).
 * 
 * JavaScript should use Module.HEAPU8 to read the binary data and decode with @msgpack/msgpack.
 */

#include <emscripten.h>
#include <msgpack.hpp>
#include <vector>
#include <string>
#include <cstdint>
#include <cmath>
#include <sstream>

// Global buffer for msgpack output
static msgpack::sbuffer g_buffer;

// ============================================================================
// Data Generation and MessagePack Serialization using msgpack-c
// ============================================================================

extern "C" {

EMSCRIPTEN_KEEPALIVE
const uint8_t* generateFlatMsgpack(int nameLen) {
    g_buffer.clear();
    msgpack::packer<msgpack::sbuffer> pk(&g_buffer);
    
    // Pack as map with 4 elements
    pk.pack_map(4);
    
    pk.pack("id");
    pk.pack(42);
    
    pk.pack("name");
    pk.pack(std::string(nameLen, 'x'));
    
    pk.pack("value");
    pk.pack(3.14159265359);
    
    pk.pack("flag");
    pk.pack(true);
    
    return reinterpret_cast<const uint8_t*>(g_buffer.data());
}

EMSCRIPTEN_KEEPALIVE
size_t getLastMsgpackLength() {
    return g_buffer.size();
}

EMSCRIPTEN_KEEPALIVE
const uint8_t* generateNestedMsgpack(int itemCount) {
    g_buffer.clear();
    msgpack::packer<msgpack::sbuffer> pk(&g_buffer);
    
    // Root object with "data" key
    pk.pack_map(1);
    pk.pack("data");
    
    // "data" object with "items" key
    pk.pack_map(1);
    pk.pack("items");
    
    // "items" array
    pk.pack_array(itemCount);
    for (int i = 0; i < itemCount; i++) {
        pk.pack_map(3);
        
        pk.pack("id");
        pk.pack(i);
        
        pk.pack("name");
        pk.pack("item_" + std::to_string(i));
        
        pk.pack("value");
        pk.pack(static_cast<double>(i) * 1.5);
    }
    
    return reinterpret_cast<const uint8_t*>(g_buffer.data());
}

EMSCRIPTEN_KEEPALIVE
const uint8_t* generateNumberArrayMsgpack(int count) {
    g_buffer.clear();
    msgpack::packer<msgpack::sbuffer> pk(&g_buffer);
    
    pk.pack_array(count);
    for (int i = 0; i < count; i++) {
        double val = static_cast<double>(i) * 0.5 + sin(static_cast<double>(i));
        pk.pack(val);
    }
    
    return reinterpret_cast<const uint8_t*>(g_buffer.data());
}

EMSCRIPTEN_KEEPALIVE
const uint8_t* generateObjectArrayMsgpack(int count) {
    g_buffer.clear();
    msgpack::packer<msgpack::sbuffer> pk(&g_buffer);
    
    pk.pack_array(count);
    for (int i = 0; i < count; i++) {
        pk.pack_map(3);
        
        pk.pack("id");
        pk.pack(i);
        
        pk.pack("name");
        pk.pack("object_" + std::to_string(i));
        
        pk.pack("value");
        pk.pack(static_cast<double>(i) * 2.5);
    }
    
    return reinterpret_cast<const uint8_t*>(g_buffer.data());
}

static void buildTreeMsgpack(msgpack::packer<msgpack::sbuffer>& pk, int depth, int breadth) {
    if (depth > 0) {
        pk.pack_map(3);
    } else {
        pk.pack_map(2);
    }
    
    pk.pack("depth");
    pk.pack(depth);
    
    pk.pack("breadth");
    pk.pack(breadth);
    
    if (depth > 0) {
        pk.pack("children");
        pk.pack_array(breadth);
        for (int i = 0; i < breadth; i++) {
            buildTreeMsgpack(pk, depth - 1, breadth);
        }
    }
}

EMSCRIPTEN_KEEPALIVE
const uint8_t* generateTreeMsgpack(int depth, int breadth) {
    g_buffer.clear();
    msgpack::packer<msgpack::sbuffer> pk(&g_buffer);
    buildTreeMsgpack(pk, depth, breadth);
    return reinterpret_cast<const uint8_t*>(g_buffer.data());
}

} // extern "C"
