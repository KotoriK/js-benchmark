/**
 * @file benchmark_msgpack.cpp
 * @brief WebAssembly benchmark using MessagePack with msgpack-c
 * 
 * This module demonstrates data transfer between JS and WASM using
 * MessagePack binary serialization via the msgpack-c library.
 */

#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <msgpack.hpp>
#include <string>
#include <vector>
#include <sstream>
#include <cstdint>

using namespace emscripten;

/**
 * Helper: Pack data to binary buffer and return as Uint8Array
 */
val packToUint8Array(const msgpack::sbuffer& sbuf) {
    val jsArray = val::global("Uint8Array").new_(sbuf.size());
    val memView = val::module_property("HEAPU8");
    
    for (size_t i = 0; i < sbuf.size(); i++) {
        jsArray.set(i, static_cast<uint8_t>(sbuf.data()[i]));
    }
    
    return jsArray;
}

/**
 * Helper: Unpack Uint8Array to msgpack object
 */
msgpack::object_handle unpackFromUint8Array(val data) {
    size_t len = data["length"].as<size_t>();
    std::vector<char> buffer(len);
    
    for (size_t i = 0; i < len; i++) {
        buffer[i] = static_cast<char>(data[i].as<int>());
    }
    
    return msgpack::unpack(buffer.data(), buffer.size());
}

/**
 * Process a flat object from msgpack binary
 */
val processFlat(val data) {
    auto oh = unpackFromUint8Array(data);
    auto obj = oh.get();
    
    msgpack::sbuffer sbuf;
    msgpack::packer<msgpack::sbuffer> pk(&sbuf);
    
    pk.pack_map(5);
    
    // Copy fields from input
    if (obj.type == msgpack::type::MAP) {
        auto m = obj.as<std::map<std::string, msgpack::object>>();
        
        pk.pack("id");
        if (m.count("id")) {
            pk.pack(m["id"].as<int>());
        } else {
            pk.pack(0);
        }
        
        pk.pack("name");
        if (m.count("name")) {
            pk.pack(m["name"].as<std::string>());
        } else {
            pk.pack("");
        }
        
        pk.pack("value");
        if (m.count("value")) {
            pk.pack(m["value"].as<double>());
        } else {
            pk.pack(0.0);
        }
        
        pk.pack("flag");
        if (m.count("flag")) {
            pk.pack(m["flag"].as<bool>());
        } else {
            pk.pack(false);
        }
    } else {
        pk.pack("id"); pk.pack(0);
        pk.pack("name"); pk.pack("");
        pk.pack("value"); pk.pack(0.0);
        pk.pack("flag"); pk.pack(false);
    }
    
    pk.pack("processed");
    pk.pack(true);
    
    return packToUint8Array(sbuf);
}

/**
 * Process a nested object from msgpack binary
 */
val processNested(val data) {
    auto oh = unpackFromUint8Array(data);
    auto obj = oh.get();
    
    msgpack::sbuffer sbuf;
    msgpack::packer<msgpack::sbuffer> pk(&sbuf);
    
    pk.pack_map(2);
    pk.pack("type");
    pk.pack("nested");
    
    int itemCount = 0;
    if (obj.type == msgpack::type::MAP) {
        auto m = obj.as<std::map<std::string, msgpack::object>>();
        if (m.count("data")) {
            auto dataMap = m["data"].as<std::map<std::string, msgpack::object>>();
            if (dataMap.count("items")) {
                auto items = dataMap["items"].as<std::vector<msgpack::object>>();
                itemCount = items.size();
            }
        }
    }
    
    pk.pack("itemCount");
    pk.pack(itemCount);
    
    return packToUint8Array(sbuf);
}

/**
 * Process an array of numbers from msgpack binary
 */
val processNumberArray(val data) {
    auto oh = unpackFromUint8Array(data);
    auto obj = oh.get();
    
    auto arr = obj.as<std::vector<double>>();
    size_t len = arr.size();
    
    double sum = 0;
    double min = len > 0 ? arr[0] : 0;
    double max = min;
    
    for (const auto& v : arr) {
        sum += v;
        if (v < min) min = v;
        if (v > max) max = v;
    }
    
    msgpack::sbuffer sbuf;
    msgpack::packer<msgpack::sbuffer> pk(&sbuf);
    
    pk.pack_map(5);
    pk.pack("count"); pk.pack(static_cast<int>(len));
    pk.pack("sum"); pk.pack(sum);
    pk.pack("avg"); pk.pack(len > 0 ? sum / len : 0);
    pk.pack("min"); pk.pack(min);
    pk.pack("max"); pk.pack(max);
    
    return packToUint8Array(sbuf);
}

/**
 * Process an array of objects from msgpack binary
 */
val processObjectArray(val data) {
    auto oh = unpackFromUint8Array(data);
    auto obj = oh.get();
    
    auto arr = obj.as<std::vector<std::map<std::string, msgpack::object>>>();
    
    msgpack::sbuffer sbuf;
    msgpack::packer<msgpack::sbuffer> pk(&sbuf);
    
    pk.pack_array(arr.size());
    
    for (const auto& item : arr) {
        pk.pack_map(2);
        pk.pack("originalId");
        if (item.count("id")) {
            pk.pack(item.at("id").as<int>());
        } else {
            pk.pack(0);
        }
        pk.pack("processed");
        pk.pack(true);
    }
    
    return packToUint8Array(sbuf);
}

void packComplexObject(msgpack::packer<msgpack::sbuffer>& pk, int depth, int breadth) {
    if (depth > 0) {
        pk.pack_map(3);
        pk.pack("depth"); pk.pack(depth);
        pk.pack("breadth"); pk.pack(breadth);
        pk.pack("children");
        pk.pack_array(breadth);
        for (int i = 0; i < breadth; i++) {
            packComplexObject(pk, depth - 1, breadth);
        }
    } else {
        pk.pack_map(2);
        pk.pack("depth"); pk.pack(depth);
        pk.pack("breadth"); pk.pack(breadth);
    }
}

/**
 * Create a complex nested structure in msgpack format
 */
val createComplexObject(int depth, int breadth) {
    msgpack::sbuffer sbuf;
    msgpack::packer<msgpack::sbuffer> pk(&sbuf);
    
    packComplexObject(pk, depth, breadth);
    
    return packToUint8Array(sbuf);
}

int countNodesHelper(const msgpack::object& obj) {
    int count = 1;
    
    if (obj.type == msgpack::type::MAP) {
        auto m = obj.as<std::map<std::string, msgpack::object>>();
        if (m.count("children")) {
            auto children = m["children"].as<std::vector<msgpack::object>>();
            for (const auto& child : children) {
                count += countNodesHelper(child);
            }
        }
    }
    
    return count;
}

/**
 * Count total nodes in a nested msgpack structure
 */
int countNodes(val data) {
    auto oh = unpackFromUint8Array(data);
    return countNodesHelper(oh.get());
}

EMSCRIPTEN_BINDINGS(benchmark_msgpack) {
    function("processFlat", &processFlat);
    function("processNested", &processNested);
    function("processNumberArray", &processNumberArray);
    function("processObjectArray", &processObjectArray);
    function("createComplexObject", &createComplexObject);
    function("countNodes", &countNodes);
}
