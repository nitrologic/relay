// readgltf.h

#pragma once

//#include "rapidjson/document.h"
#include <istream>
#include <iostream>
#include <fstream>
#include <vector>
#include <map>

#define assert

#include <filesystem>
namespace fs = std::filesystem;

typedef std::vector<char> Chunk;

/*
typedef rapidjson::GenericValue<rapidjson::UTF8<>> JSONValue;
//const std::string base64Header("data:application/octet-stream;base64,");
bool Bool(JSONValue &value, const char *member, bool def);
int Index(JSONValue &value, const char *member, int def);
double Real(JSONValue &value, const char *member, double def);
std::string String(JSONValue &value, const char *member, const char *def);
std::string Encode(JSONValue &object, const char *member);
*/

Chunk resolveURI(std::string uri);

namespace nitro {

struct Buffer {
	size_t byteLength;
	std::string uri;
	Chunk data;

	char *lock() {
		if (data.empty() && uri.size()) {
			data = resolveURI(uri);
			assert(data.size() == byteLength);
		}
		return data.data();
	}
};

struct BufferView {
	Buffer *buffer;
	size_t byteOffset;
	size_t byteLength;
	int target;
};

struct pbrMetallicRoughness {
	double baseColorFactor[4];
	int baseColorTexture_Index;
	double metallicFactor;
};

struct Texture {
	int samplerIndex;
	int sourceIndex;
};
struct TextureImage{
	std::string uri;
	int bufferViewIndex;
	std::string mimeType;
};
struct Sampler {
	enum FilterType {
		NEAREST = 9728,
		LINEAR = 9729,
		NEAREST_MIPMAP_NEAREST = 9984,
		LINEAR_MIPMAP_NEAREST = 9985,
		NEAREST_MIPMAP_LINEAR = 9986,
		LINEAR_MIPMAP_LINEAR = 9987
	};
	enum WrapMode {
		CLAMP_TO_EDGE = 33071,
		MIRRORED_REPEAT = 33648,
		REPEAT = 10497
	};
	int magFilter;
	int minFilter;
	int wrapS;
	int wrapT;
	std::string name;
	std::string object;
	std::string extras;
};

struct Material {
	std::string name;
	std::string extensions;
	std::string extras;
	int normalTextureIndex;
	int occlusionTextureIndex;
	int emissiveTextureIndex;
	double emissiveFactor[3];
	double alphaCutoff;
	std::string alphaMode;
	bool doubleSided;
	pbrMetallicRoughness *rough;
};

static const char *AccessorTypes[] = { 
	"SCALAR",
	"VEC2",
	"VEC3",
	"VEC4",
	"MAT2",
	"MAT3",
	"MAT4"
};

static std::map<std::string, int> AccessorSpan({
	{"SCALAR",1},
	{"VEC2",2},
	{"VEC3",3},
	{"VEC4",4},
	{"MAT2",4},
	{"MAT3",9},
	{"MAT4",16}
});

struct Accessor {
	enum ComponentType {
		BYTE=120,
		UNSIGNED_BYTE=5121,
		SHORT=5122,
		UNSIGNED_SHORT=5123,
		UNSIGNED_INT=5125,
		FLOAT=5126
	};
	BufferView *bufferView;
	size_t byteOffset;
	int componentType;
	int count;
	std::vector<double> max;
	std::vector<double> min;
	std::string accessorType;
	int span;

	float getFloat(int index,int element) {
		assert(element < span);
		Buffer *buffer = bufferView->buffer;
		size_t offset = bufferView->byteOffset + byteOffset;
		switch (componentType) {
		case FLOAT:
			float *f = (float *)(buffer->lock() + offset);
			return f[index*span+element];
		}
		return 0.0f;
	}

	int getInt(int index, int element) {
		assert(element < span);
		Buffer *buffer = bufferView->buffer;
		size_t offset = bufferView->byteOffset + byteOffset;
		int *i32;
		unsigned short *u16;
		switch (componentType) {
			case UNSIGNED_INT:
				i32 = (int *)(buffer->lock() + offset);
				return i32[index*span + element];
			case UNSIGNED_SHORT:
				u16 = (unsigned short *)(buffer->lock() + offset);
				return u16[index*span + element];
		}
		return -1;
	}
};

typedef std::map<std::string, int> Attributes;
typedef Attributes::iterator AttibutesIterator;

struct Primitive {
	enum Mode {
		POINTS,
		LINES,
		LINE_LOOP,
		LINE_STRIP,
		TRIANGLES,
		TRIANGLE_STRIP,
		TRIANGLE_FAN,
	};
	Attributes attributes;
	int indices;
	Mode mode;
	int materialIndex;
};

struct Mesh {
	std::vector<Primitive*> primitives;
	std::string name;
};

struct Node {
	std::vector<Node*> children;
	std::vector<double> matrix;
	Mesh *mesh;
	std::string name;
};

struct Scene {
	std::string name;
	std::vector<Node*> nodes;
};

struct Asset {
	std::string generator;
	std::string version;
	Scene *scene;
	std::vector<Scene*> scenes;
	std::vector<Node*> nodes;
	std::vector<Mesh*> meshes;
	std::vector<Accessor*> accessors;
	std::vector<Texture *> textures;
	std::vector<TextureImage *> images;
	std::vector<Sampler*> samplers;
	std::vector<Material*> materials;
	std::vector<BufferView*> bufferViews;
	std::vector<Buffer*> buffers;
	fs::path path;
};

int parseGLTF(Chunk &json, Chunk &bin, Asset **result, const char *path);
int readGLB(const char *path, Asset **asset);
int readGLTF(const char *path, Asset **result);

};
