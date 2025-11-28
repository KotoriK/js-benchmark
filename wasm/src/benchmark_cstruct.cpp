/**
 * @file benchmark_cstruct.cpp
 * @brief WebAssembly benchmark using typed-cstruct for C++ to JS data transfer
 * 
 * This module benchmarks data transfer FROM C++ (WASM) TO JavaScript using typed-cstruct.
 * Data is stored as raw C structs in WASM memory, then the pointer address is exposed
 * to JavaScript which reads the binary data via HEAPU8 and parses it using typed-cstruct.
 * 
 * JavaScript should use Module.HEAPU8 to read the binary data and parse with typed-cstruct.
 */

#include <emscripten.h>
#include <cstdint>
#include <cstring>
#include <cmath>
#include <vector>
#include <string>

// ============================================================================
// C-style struct definitions for binary layout
// These structs use fixed-size types for predictable binary representation
// ============================================================================

// Use packed structs (no padding) for consistent binary layout across platforms.
// Note: Packed structs may have performance penalties on some architectures
// due to unaligned memory access, but this ensures JavaScript can parse
// the exact binary layout without needing to account for compiler-specific padding.
#pragma pack(push, 1)

/**
 * Flat object struct - fixed size with inline string buffer
 */
struct FlatStruct {
    int32_t id;
    double value;
    uint8_t flag;
    int32_t nameLen;  // Store name length separately
    // Name is stored after this struct in memory
};

/**
 * Item struct for arrays and nested objects
 */
struct ItemStruct {
    int32_t id;
    double value;
    int32_t nameLen;
    // Name follows
};

/**
 * Nested object header
 */
struct NestedHeader {
    int32_t itemCount;
    // Items array follows
};

/**
 * Number array header
 */
struct NumberArrayHeader {
    int32_t count;
    // Array of doubles follows
};

/**
 * Object array header
 */
struct ObjectArrayHeader {
    int32_t count;
    // Array of ItemStruct with names follows
};

/**
 * Tree node struct
 */
struct TreeNodeHeader {
    int32_t depth;
    int32_t breadth;
    int32_t childrenCount;
    // Children follow (each is a variable-length TreeNodeHeader + children)
};

#pragma pack(pop)

// ============================================================================
// Global buffers for binary output
// Note: Single-threaded WASM environment - thread safety not required.
// ============================================================================

static std::vector<uint8_t> g_buffer;
static size_t g_last_size = 0;

// ============================================================================
// Data Generation Functions
// ============================================================================

extern "C" {

/**
 * Generate a flat struct with fixed name length stored as binary
 * Layout: FlatStruct header + name bytes
 */
EMSCRIPTEN_KEEPALIVE
const uint8_t* generateFlatCStruct(int nameLen) {
    // Calculate total size
    size_t totalSize = sizeof(FlatStruct) + nameLen;
    g_buffer.resize(totalSize);
    g_last_size = totalSize;
    
    uint8_t* ptr = g_buffer.data();
    
    // Write header
    FlatStruct* header = reinterpret_cast<FlatStruct*>(ptr);
    header->id = 42;
    header->value = 3.14159265359;
    header->flag = 1;  // true
    header->nameLen = nameLen;
    
    // Write name string (filled with 'x')
    std::memset(ptr + sizeof(FlatStruct), 'x', nameLen);
    
    return ptr;
}

EMSCRIPTEN_KEEPALIVE
size_t getLastCStructLength() {
    return g_last_size;
}

/**
 * Generate nested object as binary
 * Layout: NestedHeader + N * (ItemStruct + name bytes)
 */
EMSCRIPTEN_KEEPALIVE
const uint8_t* generateNestedCStruct(int itemCount) {
    // Pre-calculate total size
    size_t totalSize = sizeof(NestedHeader);
    for (int i = 0; i < itemCount; i++) {
        std::string name = "item_" + std::to_string(i);
        totalSize += sizeof(ItemStruct) + name.length();
    }
    
    g_buffer.resize(totalSize);
    g_last_size = totalSize;
    uint8_t* ptr = g_buffer.data();
    
    // Write header
    NestedHeader* header = reinterpret_cast<NestedHeader*>(ptr);
    header->itemCount = itemCount;
    
    // Write items
    size_t offset = sizeof(NestedHeader);
    for (int i = 0; i < itemCount; i++) {
        ItemStruct* item = reinterpret_cast<ItemStruct*>(ptr + offset);
        std::string name = "item_" + std::to_string(i);
        
        item->id = i;
        item->value = static_cast<double>(i) * 1.5;
        item->nameLen = static_cast<int32_t>(name.length());
        
        offset += sizeof(ItemStruct);
        
        // Copy name string
        std::memcpy(ptr + offset, name.c_str(), name.length());
        offset += name.length();
    }
    
    return ptr;
}

/**
 * Generate number array as binary
 * Layout: NumberArrayHeader + N * double
 */
EMSCRIPTEN_KEEPALIVE
const uint8_t* generateNumberArrayCStruct(int count) {
    size_t totalSize = sizeof(NumberArrayHeader) + count * sizeof(double);
    g_buffer.resize(totalSize);
    g_last_size = totalSize;
    
    uint8_t* ptr = g_buffer.data();
    
    // Write header
    NumberArrayHeader* header = reinterpret_cast<NumberArrayHeader*>(ptr);
    header->count = count;
    
    // Write numbers
    double* numbers = reinterpret_cast<double*>(ptr + sizeof(NumberArrayHeader));
    for (int i = 0; i < count; i++) {
        numbers[i] = static_cast<double>(i) * 0.5 + std::sin(static_cast<double>(i));
    }
    
    return ptr;
}

/**
 * Generate object array as binary
 * Layout: ObjectArrayHeader + N * (ItemStruct + name bytes)
 */
EMSCRIPTEN_KEEPALIVE
const uint8_t* generateObjectArrayCStruct(int count) {
    // Pre-calculate total size
    size_t totalSize = sizeof(ObjectArrayHeader);
    for (int i = 0; i < count; i++) {
        std::string name = "object_" + std::to_string(i);
        totalSize += sizeof(ItemStruct) + name.length();
    }
    
    g_buffer.resize(totalSize);
    g_last_size = totalSize;
    uint8_t* ptr = g_buffer.data();
    
    // Write header
    ObjectArrayHeader* header = reinterpret_cast<ObjectArrayHeader*>(ptr);
    header->count = count;
    
    // Write items
    size_t offset = sizeof(ObjectArrayHeader);
    for (int i = 0; i < count; i++) {
        ItemStruct* item = reinterpret_cast<ItemStruct*>(ptr + offset);
        std::string name = "object_" + std::to_string(i);
        
        item->id = i;
        item->value = static_cast<double>(i) * 2.5;
        item->nameLen = static_cast<int32_t>(name.length());
        
        offset += sizeof(ItemStruct);
        
        // Copy name string
        std::memcpy(ptr + offset, name.c_str(), name.length());
        offset += name.length();
    }
    
    return ptr;
}

/**
 * Build tree structure recursively into buffer
 * Returns the number of bytes written
 */
static size_t buildTreeCStruct(uint8_t* ptr, int depth, int breadth) {
    TreeNodeHeader* header = reinterpret_cast<TreeNodeHeader*>(ptr);
    header->depth = depth;
    header->breadth = breadth;
    
    size_t offset = sizeof(TreeNodeHeader);
    
    if (depth > 0) {
        header->childrenCount = breadth;
        for (int i = 0; i < breadth; i++) {
            offset += buildTreeCStruct(ptr + offset, depth - 1, breadth);
        }
    } else {
        header->childrenCount = 0;
    }
    
    return offset;
}

/**
 * Calculate tree size recursively
 */
static size_t calculateTreeSize(int depth, int breadth) {
    size_t size = sizeof(TreeNodeHeader);
    if (depth > 0) {
        for (int i = 0; i < breadth; i++) {
            size += calculateTreeSize(depth - 1, breadth);
        }
    }
    return size;
}

/**
 * Generate tree structure as binary
 * Layout: TreeNodeHeader + children (each is TreeNodeHeader + ...)
 */
EMSCRIPTEN_KEEPALIVE
const uint8_t* generateTreeCStruct(int depth, int breadth) {
    size_t totalSize = calculateTreeSize(depth, breadth);
    g_buffer.resize(totalSize);
    g_last_size = totalSize;
    
    buildTreeCStruct(g_buffer.data(), depth, breadth);
    
    return g_buffer.data();
}

} // extern "C"
