/**
 * @file benchmark_msgpack.cpp
 * @brief WebAssembly benchmark using MessagePack for C++ to JS data transfer
 * 
 * This module benchmarks data transfer FROM C++ (WASM) TO JavaScript using MessagePack.
 * Data is serialized using a lightweight msgpack implementation in C++, then the raw
 * binary data is transferred to JavaScript via direct WASM memory access (HEAPU8).
 * 
 * JavaScript should use Module.HEAPU8 to read the binary data and decode with @msgpack/msgpack.
 */

#include <emscripten.h>
#include <vector>
#include <string>
#include <cstdint>
#include <cstring>
#include <cmath>

// ============================================================================
// Lightweight MessagePack Packer
// ============================================================================

class MsgpackPacker {
    std::vector<uint8_t> buffer;
    
public:
    void pack_nil() { buffer.push_back(0xc0); }
    void pack_true() { buffer.push_back(0xc3); }
    void pack_false() { buffer.push_back(0xc2); }
    void pack_bool(bool v) { buffer.push_back(v ? 0xc3 : 0xc2); }
    
    void pack_int(int64_t v) {
        if (v >= 0 && v <= 127) {
            buffer.push_back(static_cast<uint8_t>(v));
        } else if (v >= -32 && v < 0) {
            buffer.push_back(static_cast<uint8_t>(v));
        } else if (v >= -128 && v <= 127) {
            buffer.push_back(0xd0);
            buffer.push_back(static_cast<uint8_t>(v));
        } else if (v >= -32768 && v <= 32767) {
            buffer.push_back(0xd1);
            buffer.push_back(static_cast<uint8_t>((v >> 8) & 0xff));
            buffer.push_back(static_cast<uint8_t>(v & 0xff));
        } else if (v >= -2147483648LL && v <= 2147483647LL) {
            buffer.push_back(0xd2);
            buffer.push_back(static_cast<uint8_t>((v >> 24) & 0xff));
            buffer.push_back(static_cast<uint8_t>((v >> 16) & 0xff));
            buffer.push_back(static_cast<uint8_t>((v >> 8) & 0xff));
            buffer.push_back(static_cast<uint8_t>(v & 0xff));
        } else {
            buffer.push_back(0xd3);
            for (int i = 7; i >= 0; i--) {
                buffer.push_back(static_cast<uint8_t>((v >> (i * 8)) & 0xff));
            }
        }
    }
    
    void pack_double(double v) {
        buffer.push_back(0xcb);
        uint64_t bits;
        memcpy(&bits, &v, sizeof(bits));
        for (int i = 7; i >= 0; i--) {
            buffer.push_back(static_cast<uint8_t>((bits >> (i * 8)) & 0xff));
        }
    }
    
    void pack_string(const std::string& s) {
        size_t len = s.length();
        if (len <= 31) {
            buffer.push_back(0xa0 | static_cast<uint8_t>(len));
        } else if (len <= 255) {
            buffer.push_back(0xd9);
            buffer.push_back(static_cast<uint8_t>(len));
        } else if (len <= 65535) {
            buffer.push_back(0xda);
            buffer.push_back(static_cast<uint8_t>((len >> 8) & 0xff));
            buffer.push_back(static_cast<uint8_t>(len & 0xff));
        } else {
            buffer.push_back(0xdb);
            buffer.push_back(static_cast<uint8_t>((len >> 24) & 0xff));
            buffer.push_back(static_cast<uint8_t>((len >> 16) & 0xff));
            buffer.push_back(static_cast<uint8_t>((len >> 8) & 0xff));
            buffer.push_back(static_cast<uint8_t>(len & 0xff));
        }
        for (char c : s) {
            buffer.push_back(static_cast<uint8_t>(c));
        }
    }
    
    void pack_array_header(size_t size) {
        if (size <= 15) {
            buffer.push_back(0x90 | static_cast<uint8_t>(size));
        } else if (size <= 65535) {
            buffer.push_back(0xdc);
            buffer.push_back(static_cast<uint8_t>((size >> 8) & 0xff));
            buffer.push_back(static_cast<uint8_t>(size & 0xff));
        } else {
            buffer.push_back(0xdd);
            buffer.push_back(static_cast<uint8_t>((size >> 24) & 0xff));
            buffer.push_back(static_cast<uint8_t>((size >> 16) & 0xff));
            buffer.push_back(static_cast<uint8_t>((size >> 8) & 0xff));
            buffer.push_back(static_cast<uint8_t>(size & 0xff));
        }
    }
    
    void pack_map_header(size_t size) {
        if (size <= 15) {
            buffer.push_back(0x80 | static_cast<uint8_t>(size));
        } else if (size <= 65535) {
            buffer.push_back(0xde);
            buffer.push_back(static_cast<uint8_t>((size >> 8) & 0xff));
            buffer.push_back(static_cast<uint8_t>(size & 0xff));
        } else {
            buffer.push_back(0xdf);
            buffer.push_back(static_cast<uint8_t>((size >> 24) & 0xff));
            buffer.push_back(static_cast<uint8_t>((size >> 16) & 0xff));
            buffer.push_back(static_cast<uint8_t>((size >> 8) & 0xff));
            buffer.push_back(static_cast<uint8_t>(size & 0xff));
        }
    }
    
    const uint8_t* data() const { return buffer.data(); }
    size_t size() const { return buffer.size(); }
    
    void clear() { buffer.clear(); }
};

// Global packer and buffer
static MsgpackPacker g_packer;

// ============================================================================
// Data Generation and MessagePack Serialization
// ============================================================================

extern "C" {

EMSCRIPTEN_KEEPALIVE
const uint8_t* generateFlatMsgpack(int nameLen) {
    g_packer.clear();
    
    g_packer.pack_map_header(4);
    
    g_packer.pack_string("id");
    g_packer.pack_int(42);
    
    g_packer.pack_string("name");
    g_packer.pack_string(std::string(nameLen, 'x'));
    
    g_packer.pack_string("value");
    g_packer.pack_double(3.14159265359);
    
    g_packer.pack_string("flag");
    g_packer.pack_true();
    
    return g_packer.data();
}

EMSCRIPTEN_KEEPALIVE
size_t getLastMsgpackLength() {
    return g_packer.size();
}

EMSCRIPTEN_KEEPALIVE
const uint8_t* generateNestedMsgpack(int itemCount) {
    g_packer.clear();
    
    g_packer.pack_map_header(1);
    g_packer.pack_string("data");
    
    g_packer.pack_map_header(1);
    g_packer.pack_string("items");
    
    g_packer.pack_array_header(itemCount);
    for (int i = 0; i < itemCount; i++) {
        g_packer.pack_map_header(3);
        
        g_packer.pack_string("id");
        g_packer.pack_int(i);
        
        g_packer.pack_string("name");
        g_packer.pack_string("item_" + std::to_string(i));
        
        g_packer.pack_string("value");
        g_packer.pack_double(static_cast<double>(i) * 1.5);
    }
    
    return g_packer.data();
}

EMSCRIPTEN_KEEPALIVE
const uint8_t* generateNumberArrayMsgpack(int count) {
    g_packer.clear();
    
    g_packer.pack_array_header(count);
    for (int i = 0; i < count; i++) {
        double val = static_cast<double>(i) * 0.5 + sin(static_cast<double>(i));
        g_packer.pack_double(val);
    }
    
    return g_packer.data();
}

EMSCRIPTEN_KEEPALIVE
const uint8_t* generateObjectArrayMsgpack(int count) {
    g_packer.clear();
    
    g_packer.pack_array_header(count);
    for (int i = 0; i < count; i++) {
        g_packer.pack_map_header(3);
        
        g_packer.pack_string("id");
        g_packer.pack_int(i);
        
        g_packer.pack_string("name");
        g_packer.pack_string("object_" + std::to_string(i));
        
        g_packer.pack_string("value");
        g_packer.pack_double(static_cast<double>(i) * 2.5);
    }
    
    return g_packer.data();
}

static void buildTreeMsgpack(MsgpackPacker& packer, int depth, int breadth) {
    if (depth > 0) {
        packer.pack_map_header(3);
    } else {
        packer.pack_map_header(2);
    }
    
    packer.pack_string("depth");
    packer.pack_int(depth);
    
    packer.pack_string("breadth");
    packer.pack_int(breadth);
    
    if (depth > 0) {
        packer.pack_string("children");
        packer.pack_array_header(breadth);
        for (int i = 0; i < breadth; i++) {
            buildTreeMsgpack(packer, depth - 1, breadth);
        }
    }
}

EMSCRIPTEN_KEEPALIVE
const uint8_t* generateTreeMsgpack(int depth, int breadth) {
    g_packer.clear();
    buildTreeMsgpack(g_packer, depth, breadth);
    return g_packer.data();
}

} // extern "C"
