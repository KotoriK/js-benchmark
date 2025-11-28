/**
 * @file benchmark_msgpack.cpp
 * @brief WebAssembly benchmark using MessagePack binary serialization
 * 
 * This module demonstrates data transfer between JS and WASM using
 * MessagePack binary format. It uses a lightweight custom implementation
 * for encoding/decoding since msgpack-c requires Boost headers.
 * 
 * The WASM module receives msgpack-encoded data from JavaScript (using @msgpack/msgpack)
 * processes it internally using a simplified msgpack decoder/encoder, and returns
 * msgpack-encoded results.
 */

#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <string>
#include <vector>
#include <cstdint>
#include <cstring>
#include <map>
#include <variant>
#include <stdexcept>

using namespace emscripten;

// ============================================================================
// Lightweight MessagePack Implementation for WASM
// ============================================================================

namespace msgpack_lite {

// Simple packer
class Packer {
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
        } else {
            buffer.push_back(0xd2);
            buffer.push_back(static_cast<uint8_t>((v >> 24) & 0xff));
            buffer.push_back(static_cast<uint8_t>((v >> 16) & 0xff));
            buffer.push_back(static_cast<uint8_t>((v >> 8) & 0xff));
            buffer.push_back(static_cast<uint8_t>(v & 0xff));
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
        } else {
            buffer.push_back(0xda);
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
        } else {
            buffer.push_back(0xdc);
            buffer.push_back(static_cast<uint8_t>((size >> 8) & 0xff));
            buffer.push_back(static_cast<uint8_t>(size & 0xff));
        }
    }
    
    void pack_map_header(size_t size) {
        if (size <= 15) {
            buffer.push_back(0x80 | static_cast<uint8_t>(size));
        } else {
            buffer.push_back(0xde);
            buffer.push_back(static_cast<uint8_t>((size >> 8) & 0xff));
            buffer.push_back(static_cast<uint8_t>(size & 0xff));
        }
    }
    
    const std::vector<uint8_t>& data() const { return buffer; }
    size_t size() const { return buffer.size(); }
};

// Forward declarations
struct Value;
using Map = std::map<std::string, Value>;
using Array = std::vector<Value>;

// Value type that can hold any msgpack value
struct Value {
    std::variant<std::nullptr_t, bool, int64_t, double, std::string, Array, Map> data;
    
    Value() : data(nullptr) {}
    Value(std::nullptr_t) : data(nullptr) {}
    Value(bool v) : data(v) {}
    Value(int v) : data(static_cast<int64_t>(v)) {}
    Value(int64_t v) : data(v) {}
    Value(double v) : data(v) {}
    Value(const std::string& v) : data(v) {}
    Value(const char* v) : data(std::string(v)) {}
    Value(Array v) : data(std::move(v)) {}
    Value(Map v) : data(std::move(v)) {}
    
    bool is_nil() const { return std::holds_alternative<std::nullptr_t>(data); }
    bool is_bool() const { return std::holds_alternative<bool>(data); }
    bool is_int() const { return std::holds_alternative<int64_t>(data); }
    bool is_double() const { return std::holds_alternative<double>(data); }
    bool is_string() const { return std::holds_alternative<std::string>(data); }
    bool is_array() const { return std::holds_alternative<Array>(data); }
    bool is_map() const { return std::holds_alternative<Map>(data); }
    
    bool as_bool() const { return std::get<bool>(data); }
    int64_t as_int() const { return std::get<int64_t>(data); }
    double as_double() const {
        if (is_int()) return static_cast<double>(as_int());
        return std::get<double>(data);
    }
    const std::string& as_string() const { return std::get<std::string>(data); }
    const Array& as_array() const { return std::get<Array>(data); }
    const Map& as_map() const { return std::get<Map>(data); }
    
    bool has(const std::string& key) const {
        if (!is_map()) return false;
        return as_map().count(key) > 0;
    }
    
    const Value& operator[](const std::string& key) const {
        static Value nil;
        if (!is_map()) return nil;
        auto& m = as_map();
        auto it = m.find(key);
        if (it == m.end()) return nil;
        return it->second;
    }
    
    const Value& operator[](size_t idx) const {
        static Value nil;
        if (!is_array()) return nil;
        auto& arr = as_array();
        if (idx >= arr.size()) return nil;
        return arr[idx];
    }
    
    size_t size() const {
        if (is_array()) return as_array().size();
        if (is_map()) return as_map().size();
        return 0;
    }
};

// Simple unpacker
class Unpacker {
    const uint8_t* data;
    size_t len;
    size_t pos = 0;
    
    uint8_t read_byte() {
        if (pos >= len) throw std::runtime_error("Unexpected end of data");
        return data[pos++];
    }
    
    uint16_t read_uint16() {
        uint16_t v = (static_cast<uint16_t>(read_byte()) << 8);
        v |= read_byte();
        return v;
    }
    
    uint32_t read_uint32() {
        uint32_t v = (static_cast<uint32_t>(read_byte()) << 24);
        v |= (static_cast<uint32_t>(read_byte()) << 16);
        v |= (static_cast<uint32_t>(read_byte()) << 8);
        v |= read_byte();
        return v;
    }
    
    int8_t read_int8() { return static_cast<int8_t>(read_byte()); }
    int16_t read_int16() { return static_cast<int16_t>(read_uint16()); }
    int32_t read_int32() { return static_cast<int32_t>(read_uint32()); }
    
    double read_double() {
        uint64_t bits = 0;
        for (int i = 0; i < 8; i++) {
            bits = (bits << 8) | read_byte();
        }
        double v;
        memcpy(&v, &bits, sizeof(v));
        return v;
    }
    
    std::string read_string(size_t length) {
        std::string s;
        s.reserve(length);
        for (size_t i = 0; i < length; i++) {
            s += static_cast<char>(read_byte());
        }
        return s;
    }

public:
    Unpacker(const uint8_t* d, size_t l) : data(d), len(l) {}
    
    Value unpack() {
        uint8_t b = read_byte();
        
        // Positive fixint
        if ((b & 0x80) == 0) {
            return Value(static_cast<int64_t>(b));
        }
        // Negative fixint
        if ((b & 0xe0) == 0xe0) {
            return Value(static_cast<int64_t>(static_cast<int8_t>(b)));
        }
        // Fixmap
        if ((b & 0xf0) == 0x80) {
            size_t size = b & 0x0f;
            Map m;
            for (size_t i = 0; i < size; i++) {
                Value key = unpack();
                Value val = unpack();
                if (key.is_string()) {
                    m[key.as_string()] = std::move(val);
                }
            }
            return Value(std::move(m));
        }
        // Fixarray
        if ((b & 0xf0) == 0x90) {
            size_t size = b & 0x0f;
            Array arr;
            arr.reserve(size);
            for (size_t i = 0; i < size; i++) {
                arr.push_back(unpack());
            }
            return Value(std::move(arr));
        }
        // Fixstr
        if ((b & 0xe0) == 0xa0) {
            size_t length = b & 0x1f;
            return Value(read_string(length));
        }
        
        switch (b) {
            case 0xc0: return Value(nullptr);
            case 0xc2: return Value(false);
            case 0xc3: return Value(true);
            case 0xcc: return Value(static_cast<int64_t>(read_byte()));
            case 0xcd: return Value(static_cast<int64_t>(read_uint16()));
            case 0xce: return Value(static_cast<int64_t>(read_uint32()));
            case 0xd0: return Value(static_cast<int64_t>(read_int8()));
            case 0xd1: return Value(static_cast<int64_t>(read_int16()));
            case 0xd2: return Value(static_cast<int64_t>(read_int32()));
            case 0xca: {
                uint32_t bits = read_uint32();
                float f;
                memcpy(&f, &bits, sizeof(f));
                return Value(static_cast<double>(f));
            }
            case 0xcb: return Value(read_double());
            case 0xd9: return Value(read_string(read_byte()));
            case 0xda: return Value(read_string(read_uint16()));
            case 0xdc: {
                size_t size = read_uint16();
                Array arr;
                arr.reserve(size);
                for (size_t i = 0; i < size; i++) {
                    arr.push_back(unpack());
                }
                return Value(std::move(arr));
            }
            case 0xdd: {
                size_t size = read_uint32();
                Array arr;
                arr.reserve(size);
                for (size_t i = 0; i < size; i++) {
                    arr.push_back(unpack());
                }
                return Value(std::move(arr));
            }
            case 0xde: {
                size_t size = read_uint16();
                Map m;
                for (size_t i = 0; i < size; i++) {
                    Value key = unpack();
                    Value val = unpack();
                    if (key.is_string()) {
                        m[key.as_string()] = std::move(val);
                    }
                }
                return Value(std::move(m));
            }
            default:
                return Value(nullptr);
        }
    }
};

} // namespace msgpack_lite

// ============================================================================
// Benchmark Functions
// ============================================================================

/**
 * Helper: Create Uint8Array from packer
 */
val packToUint8Array(const msgpack_lite::Packer& pk) {
    val jsArray = val::global("Uint8Array").new_(pk.size());
    const auto& data = pk.data();
    for (size_t i = 0; i < data.size(); i++) {
        jsArray.set(i, data[i]);
    }
    return jsArray;
}

/**
 * Helper: Read Uint8Array into vector
 */
std::vector<uint8_t> readUint8Array(val arr) {
    size_t len = arr["length"].as<size_t>();
    std::vector<uint8_t> data(len);
    for (size_t i = 0; i < len; i++) {
        data[i] = static_cast<uint8_t>(arr[i].as<int>());
    }
    return data;
}

/**
 * Process a flat object from msgpack binary
 */
val processFlat(val data) {
    auto buffer = readUint8Array(data);
    msgpack_lite::Unpacker unpacker(buffer.data(), buffer.size());
    auto obj = unpacker.unpack();
    
    msgpack_lite::Packer pk;
    pk.pack_map_header(5);
    
    pk.pack_string("id");
    pk.pack_int(obj["id"].is_int() ? obj["id"].as_int() : 0);
    
    pk.pack_string("name");
    pk.pack_string(obj["name"].is_string() ? obj["name"].as_string() : "");
    
    pk.pack_string("value");
    pk.pack_double(obj["value"].is_double() || obj["value"].is_int() ? obj["value"].as_double() : 0.0);
    
    pk.pack_string("flag");
    pk.pack_bool(obj["flag"].is_bool() ? obj["flag"].as_bool() : false);
    
    pk.pack_string("processed");
    pk.pack_true();
    
    return packToUint8Array(pk);
}

/**
 * Process a nested object from msgpack binary
 */
val processNested(val data) {
    auto buffer = readUint8Array(data);
    msgpack_lite::Unpacker unpacker(buffer.data(), buffer.size());
    auto obj = unpacker.unpack();
    
    int itemCount = 0;
    if (obj.has("data")) {
        auto& dataVal = obj["data"];
        if (dataVal.has("items")) {
            itemCount = dataVal["items"].size();
        }
    }
    
    msgpack_lite::Packer pk;
    pk.pack_map_header(2);
    pk.pack_string("type");
    pk.pack_string("nested");
    pk.pack_string("itemCount");
    pk.pack_int(itemCount);
    
    return packToUint8Array(pk);
}

/**
 * Process an array of numbers from msgpack binary
 */
val processNumberArray(val data) {
    auto buffer = readUint8Array(data);
    msgpack_lite::Unpacker unpacker(buffer.data(), buffer.size());
    auto arr = unpacker.unpack();
    
    size_t len = arr.size();
    double sum = 0;
    double min = len > 0 ? arr[0].as_double() : 0;
    double max = min;
    
    for (size_t i = 0; i < len; i++) {
        double v = arr[i].as_double();
        sum += v;
        if (v < min) min = v;
        if (v > max) max = v;
    }
    
    msgpack_lite::Packer pk;
    pk.pack_map_header(5);
    pk.pack_string("count");
    pk.pack_int(static_cast<int64_t>(len));
    pk.pack_string("sum");
    pk.pack_double(sum);
    pk.pack_string("avg");
    pk.pack_double(len > 0 ? sum / len : 0);
    pk.pack_string("min");
    pk.pack_double(min);
    pk.pack_string("max");
    pk.pack_double(max);
    
    return packToUint8Array(pk);
}

/**
 * Process an array of objects from msgpack binary
 */
val processObjectArray(val data) {
    auto buffer = readUint8Array(data);
    msgpack_lite::Unpacker unpacker(buffer.data(), buffer.size());
    auto arr = unpacker.unpack();
    
    size_t len = arr.size();
    
    msgpack_lite::Packer pk;
    pk.pack_array_header(len);
    
    for (size_t i = 0; i < len; i++) {
        auto& item = arr[i];
        pk.pack_map_header(2);
        pk.pack_string("originalId");
        pk.pack_int(item["id"].is_int() ? item["id"].as_int() : 0);
        pk.pack_string("processed");
        pk.pack_true();
    }
    
    return packToUint8Array(pk);
}

void packComplexObject(msgpack_lite::Packer& pk, int depth, int breadth) {
    if (depth > 0) {
        pk.pack_map_header(3);
        pk.pack_string("depth");
        pk.pack_int(depth);
        pk.pack_string("breadth");
        pk.pack_int(breadth);
        pk.pack_string("children");
        pk.pack_array_header(breadth);
        for (int i = 0; i < breadth; i++) {
            packComplexObject(pk, depth - 1, breadth);
        }
    } else {
        pk.pack_map_header(2);
        pk.pack_string("depth");
        pk.pack_int(depth);
        pk.pack_string("breadth");
        pk.pack_int(breadth);
    }
}

/**
 * Create a complex nested structure in msgpack format
 */
val createComplexObject(int depth, int breadth) {
    msgpack_lite::Packer pk;
    packComplexObject(pk, depth, breadth);
    return packToUint8Array(pk);
}

int countNodesHelper(const msgpack_lite::Value& obj) {
    int count = 1;
    if (obj.has("children")) {
        auto& children = obj["children"];
        for (size_t i = 0; i < children.size(); i++) {
            count += countNodesHelper(children[i]);
        }
    }
    return count;
}

/**
 * Count total nodes in a nested msgpack structure
 */
int countNodes(val data) {
    auto buffer = readUint8Array(data);
    msgpack_lite::Unpacker unpacker(buffer.data(), buffer.size());
    auto obj = unpacker.unpack();
    return countNodesHelper(obj);
}

EMSCRIPTEN_BINDINGS(benchmark_msgpack) {
    function("processFlat", &processFlat);
    function("processNested", &processNested);
    function("processNumberArray", &processNumberArray);
    function("processObjectArray", &processObjectArray);
    function("createComplexObject", &createComplexObject);
    function("countNodes", &countNodes);
}
