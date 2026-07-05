#include <cstring>
#include "readgltf.h"
#include "json.h"

const std::string base64Header("data:application/octet-stream;base64,");

typedef size_t Size;	//rapidjson::SizeType
typedef unsigned int uint;

const uint JSON_CHUNK = 0x4E4F534A;
const uint BIN_CHUNK = 0x004E4942;

JSONParser parser;

int nitroparseGLTF2(Chunk &json, Chunk &bin, nitro::Asset **model, const char *path){
	std::string js(json.begin(), json.end());
	JSValue *result;
	int fail=parser.parseJSON(js,&result);
	JSObject *meta=result->objectMember("asset");
	nitro::Asset *asset = new nitro::Asset();
	asset->path = path;
	asset->generator = meta->stringMember("generator");
	asset->version = meta->stringMember("version");
	*model=asset;
	return 0;
}

int nitro::readGLB(const char *path, nitro::Asset **asset) {
	std::ifstream stream;

	stream.open(path);
	if (!stream) {
		return -1;
	}

	stream.seekg(0, std::ios::end);
	size_t size = stream.tellg();
	stream.seekg(0);
	
	Chunk jsonSource;

	jsonSource.resize(size);
	stream.read(jsonSource.data(), size);
	stream.close();

	if (size < 12) {
		return -2;
	}

	Chunk jsonChunk;
	Chunk binChunk;

	const char *header = jsonSource.data();

	if (memcmp(header, "glTF", 4)) {
		return -3;
	}

	int version = *(int *)(header + 4);
	int length = *(int *)(header + 8);

	size_t offset = 12;

	while (offset < size) {
		uint chunkLength = *(int*)(header + offset + 0);
		uint chunkType = *(int*)(header + offset + 4);
		offset += 8;

		Chunk chunk(header+offset, header + offset+chunkLength);

		offset += chunkLength;

		switch (chunkType) {
			case BIN_CHUNK:
				binChunk = chunk;
				break;
			case JSON_CHUNK:
				jsonChunk=chunk;
				break;
			default:
				std::cout << "chunkType: 0x" << std::hex << chunkType << " of " << std::dec << chunkLength << " bytes" << std::endl;
		}
	}

	int error=parseGLTF(jsonChunk, binChunk, asset, path);

	return error;
}

int nitro::readGLTF(const char *path, nitro::Asset **result) {

	std::ifstream stream;

	stream.open(path);
	if (!stream) {
		return -1;
	}

	stream.seekg(0, std::ios::end);
	size_t size = stream.tellg();
	stream.seekg(0);

	Chunk json;
	json.resize(size);
	stream.read(json.data(), size);
	stream.close();

	Chunk empty;

	return parseGLTF(json, empty, result, path);
}


#ifndef USE_RAPID_JSON

int nitro::parseGLTF(Chunk &json, Chunk &bin, nitro::Asset **result, const char *path) {

    std::string js(json.begin(), json.end());
    JSValue *root = nullptr;
    int fail = parser.parseJSON(js, &root);
    if (fail != 0 || !root || root->type != Object) {
        std::cout << "json.h parseGLTF: failed to parse JSON" << std::endl;
        return -2;
    }

    JSObject *doc = root->object;
    if (!doc) return -3;

    nitro::Asset *asset = new nitro::Asset();
    asset->path = path;

    // === Asset ===
    if (JSObject *meta = doc->objectMember("asset")) {
        asset->generator = meta->stringMember("generator");
        asset->version   = meta->stringMember("version");
    }

    // === Buffers ===
    if (JSArray *buffers = doc->arrayMember("buffers")) {
        for (JSValue *bufVal : buffers->values) {
            if (!bufVal || bufVal->type != Object) continue;
            JSObject *b = bufVal->object;

            size_t byteLength = (size_t)b->integerMember("byteLength");
            std::string uri = b->stringMember("uri");

            if (bin.size()) {
                asset->buffers.push_back(new Buffer({ byteLength, "", bin }));
            } else {
                Chunk empty;
                asset->buffers.push_back(new Buffer({ byteLength, uri, empty }));
            }
        }
    }

    // === BufferViews ===
    if (JSArray *bufferViews = doc->arrayMember("bufferViews")) {
        for (JSValue *bvVal : bufferViews->values) {
            if (!bvVal || bvVal->type != Object) continue;
            JSObject *bv = bvVal->object;

            int bufferIndex = (int)bv->integerMember("buffer");
            if (bufferIndex < 0 || bufferIndex >= (int)asset->buffers.size()) continue;

            Buffer *buffer = asset->buffers[bufferIndex];
            size_t byteOffset = (size_t)bv->integerMember("byteOffset");
            if (byteOffset == (size_t)NotAnInt) byteOffset = 0;

            size_t byteLength = (size_t)bv->integerMember("byteLength");
            int target = (int)bv->integerMember("target");
            if (target == (int)NotAnInt) target = -1;

            asset->bufferViews.push_back(new BufferView{ buffer, byteOffset, byteLength, target });
        }
    }

    // === Textures ===
    if (JSArray *textures = doc->arrayMember("textures")) {
        for (JSValue *texVal : textures->values) {
            if (!texVal || texVal->type != Object) continue;
            JSObject *t = texVal->object;

            int sampler = (int)t->integerMember("sampler");
            if (sampler == (int)NotAnInt) sampler = -1;
            int source  = (int)t->integerMember("source");

            asset->textures.push_back(new Texture{ sampler, source });
        }
    }

    // === Images ===
    if (JSArray *images = doc->arrayMember("images")) {
        for (JSValue *imgVal : images->values) {
            if (!imgVal || imgVal->type != Object) continue;
            JSObject *img = imgVal->object;

            std::string uri = img->stringMember("uri");
            int bufferView = (int)img->integerMember("bufferView");
            if (bufferView == (int)NotAnInt) bufferView = 0;
            std::string mimeType = img->stringMember("mimeType");

            asset->images.push_back(new TextureImage{ uri, bufferView, mimeType });
        }
    }

    // === Samplers ===
    if (JSArray *samplers = doc->arrayMember("samplers")) {
        for (JSValue *samVal : samplers->values) {
            if (!samVal || samVal->type != Object) continue;
            JSObject *s = samVal->object;

            int magFilter = (int)s->integerMember("magFilter");
            int minFilter = (int)s->integerMember("minFilter");
            int wrapS = (int)s->integerMember("wrapS");
            int wrapT = (int)s->integerMember("wrapT");

            if (wrapS == (int)NotAnInt) wrapS = Sampler::REPEAT;
            if (wrapT == (int)NotAnInt) wrapT = Sampler::REPEAT;

            asset->samplers.push_back(new Sampler{ magFilter, minFilter, wrapS, wrapT, "", "", "" });
        }
    }

    // === Materials ===
    if (JSArray *materials = doc->arrayMember("materials")) {
        for (JSValue *matVal : materials->values) {
            if (!matVal || matVal->type != Object) continue;
            JSObject *m = matVal->object;

            Material *mat = new Material();
            mat->name = m->stringMember("name");

            mat->alphaMode = m->stringMember("alphaMode");
            if (mat->alphaMode.empty()) mat->alphaMode = "OPAQUE";

            mat->alphaCutoff = m->numberMember("alphaCutoff");
            if (std::isnan(mat->alphaCutoff)) mat->alphaCutoff = 0.5;

            mat->doubleSided = (m->integerMember("doubleSided") == 1);

            // pbrMetallicRoughness
            if (JSObject *pbr = m->objectMember("pbrMetallicRoughness")) {
                pbrMetallicRoughness *rough = new pbrMetallicRoughness();

                // baseColorFactor
                if (JSArray *color = pbr->arrayMember("baseColorFactor")) {
                    for (int i = 0; i < 4 && i < (int)color->values.size(); ++i) {
                        rough->baseColorFactor[i] = color->values[i]->number;
                    }
                } else {
                    rough->baseColorFactor[0] = 1.0;
                    rough->baseColorFactor[1] = 1.0;
                    rough->baseColorFactor[2] = 1.0;
                    rough->baseColorFactor[3] = 1.0;
                }

                rough->metallicFactor = pbr->numberMember("metallicFactor");
                if (std::isnan(rough->metallicFactor)) rough->metallicFactor = 1.0;

                // baseColorTexture
                rough->baseColorTexture_Index = -1;
                if (JSObject *baseTex = pbr->objectMember("baseColorTexture")) {
                    int idx = (int)baseTex->integerMember("index");
                    if (idx != (int)NotAnInt) rough->baseColorTexture_Index = idx;
                }

                mat->rough = rough;
            }

            asset->materials.push_back(mat);
        }
    }

    // === Accessors ===
    if (JSArray *accessors = doc->arrayMember("accessors")) {
        for (JSValue *accVal : accessors->values) {
            if (!accVal || accVal->type != Object) continue;
            JSObject *a = accVal->object;

            int viewIndex = (int)a->integerMember("bufferView");
            if (viewIndex < 0 || viewIndex >= (int)asset->bufferViews.size()) continue;

            BufferView *bufferView = asset->bufferViews[viewIndex];
            size_t byteOffset = (size_t)a->integerMember("byteOffset");
            if (byteOffset == (size_t)NotAnInt) byteOffset = 0;

            int componentType = (int)a->integerMember("componentType");
            int count = (int)a->integerMember("count");
            std::string type = a->stringMember("type");

            int span = AccessorSpan.count(type) ? AccessorSpan[type] : 1;

            asset->accessors.push_back(new Accessor{
                bufferView, byteOffset, componentType, count, {}, {}, type, span
            });
        }
    }

    // === Meshes ===
    if (JSArray *meshes = doc->arrayMember("meshes")) {
        for (JSValue *meshVal : meshes->values) {
            if (!meshVal || meshVal->type != Object) continue;
            JSObject *meshObj = meshVal->object;

            std::vector<Primitive*> primitives;

            if (JSArray *prims = meshObj->arrayMember("primitives")) {
                for (JSValue *primVal : prims->values) {
                    if (!primVal || primVal->type != Object) continue;
                    JSObject *p = primVal->object;

                    int indices = (int)p->integerMember("indices");
                    if (indices == (int)NotAnInt) indices = -1;

                    int materialIndex = (int)p->integerMember("material");
                    if (materialIndex == (int)NotAnInt) materialIndex = -1;

                    Primitive::Mode mode = Primitive::TRIANGLES;
                    int modeVal = (int)p->integerMember("mode");
                    if (modeVal != (int)NotAnInt) mode = (Primitive::Mode)modeVal;

                    Attributes attributes;
                    if (JSObject *attrs = p->objectMember("attributes")) {
                        for (size_t i = 0; i < attrs->names.size(); ++i) {
                            int index = (int)attrs->values[i]->integer;
                            attributes[attrs->names[i]] = index;
                        }
                    }

                    primitives.push_back(new Primitive{ attributes, indices, mode, materialIndex });
                }
            }

            std::string name = meshObj->stringMember("name");
            asset->meshes.push_back(new Mesh{ primitives, name });
        }
    }

    // === Nodes ===
    if (JSArray *nodes = doc->arrayMember("nodes")) {
        // First pass: create nodes
        for (JSValue *nodeVal : nodes->values) {
            if (!nodeVal || nodeVal->type != Object) continue;
            JSObject *n = nodeVal->object;

            Node *node = new Node();

            int meshIndex = (int)n->integerMember("mesh");
            if (meshIndex != (int)NotAnInt && meshIndex < (int)asset->meshes.size()) {
                node->mesh = asset->meshes[meshIndex];
            }

            if (JSArray *matrixArr = n->arrayMember("matrix")) {
                for (JSValue *v : matrixArr->values) {
                    if (v->type == Number) node->matrix.push_back(v->number);
                    else if (v->type == Integer) node->matrix.push_back((double)v->integer);
                }
            }

            asset->nodes.push_back(node);
        }

        // Second pass: names + children
        for (size_t i = 0; i < nodes->values.size() && i < asset->nodes.size(); ++i) {
            JSObject *n = nodes->values[i]->object;
            Node *node = asset->nodes[i];

            node->name = n->stringMember("name");

            if (JSArray *children = n->arrayMember("children")) {
                for (JSValue *c : children->values) {
                    int childIndex = (int)c->integer;
                    if (childIndex >= 0 && childIndex < (int)asset->nodes.size()) {
                        node->children.push_back(asset->nodes[childIndex]);
                    }
                }
            }
        }
    }

    // === Scenes ===
    if (JSArray *scenes = doc->arrayMember("scenes")) {
        for (JSValue *sceneVal : scenes->values) {
            if (!sceneVal || sceneVal->type != Object) continue;
            JSObject *s = sceneVal->object;

            std::string name = s->stringMember("name");
            std::vector<Node*> sceneNodes;

            if (JSArray *nodeList = s->arrayMember("nodes")) {
                for (JSValue *nv : nodeList->values) {
                    int idx = (int)nv->integer;
                    if (idx >= 0 && idx < (int)asset->nodes.size()) {
                        sceneNodes.push_back(asset->nodes[idx]);
                    }
                }
            }

            asset->scenes.push_back(new Scene{ name, sceneNodes });
        }
    }

    // === Active Scene ===
    int sceneIndex = (int)doc->integerMember("scene");
    if (sceneIndex != (int)NotAnInt && sceneIndex < (int)asset->scenes.size()) {
        asset->scene = asset->scenes[sceneIndex];
    }

    *result = asset;
    return 0;
}

#endif




#ifdef USE_RAPID_JSON

int nitro::parseGLTF(Chunk &json, Chunk &bin, nitro::Asset **result, const char *path) {

//	rapidjson::Document White;
//	White.Parse("[1.0,1.0,1.0,1.0]");

	rapidjson::Document document;

	rapidjson::ParseResult ok = document.Parse(json.data(), json.size());

	if (!ok) {
		std::cout << "rapidjson parse error code " << ok.Code() << " offset " << ok.Offset() << std::endl;
		return -2;
	}

	if (!document.HasMember("asset")) {
		return -3;
	}

	auto meta = document["asset"].GetObject();

	// asset

	nitro::Asset *asset = new nitro::Asset();
	asset->path = path;
	asset->generator = meta.HasMember("generator") ? meta["generator"].GetString() : "";
	asset->version = meta["version"].GetString();

	// buffers

	auto buffers = document["buffers"].GetArray();
	for (Size i = 0; i < buffers.Size(); i++) {
		auto &buffer = buffers[i];
		size_t byteLength = buffer["byteLength"].GetInt64();
		std::string uri;
		if (buffer.HasMember("uri")) {
			uri = buffer["uri"].GetString();
		}

		if (bin.size()) {
			asset->buffers.push_back(new Buffer({ byteLength ,"", bin }));
		}else{
			Chunk empty;
			asset->buffers.push_back(new Buffer({ byteLength, uri, empty }));
		}	
	}

	// bufferviews

	auto bufferViews = document["bufferViews"].GetArray();
	for (Size i = 0; i < bufferViews.Size(); i++) {
		auto &bufferView = bufferViews[i];
		int bufferIndex = bufferView["buffer"].GetInt();
		Buffer *buffer = asset->buffers[bufferIndex];
		size_t byteOffset = bufferView.HasMember("byteOffset") ? bufferView["byteOffset"].GetInt64() : 0;
		size_t byteLength = bufferView["byteLength"].GetInt64();
		int target = bufferView.HasMember("target")?bufferView["target"].GetInt():-1;
		asset->bufferViews.push_back(new nitro::BufferView({ buffer, byteOffset, byteLength, target }));
	}

	// textures

	if (document.HasMember("textures")) {
		auto textures = document["textures"].GetArray();
		for (Size i = 0; i < textures.Size(); i++) {
			auto &texture = textures[i];
			int sampler = texture.HasMember("sampler") ? texture["sampler"].GetInt() : -1;
			int source = texture["source"].GetInt();
			asset->textures.push_back(new Texture({ sampler,source }));
		}
	}

	// images

	if (document.HasMember("images")) {
		auto images = document["images"].GetArray();
		for (Size i = 0; i < images.Size(); i++) {
			auto &image = images[i];
			std::string uri = image.HasMember("uri") ? image["uri"].GetString() : "";
			int bufferView = image.HasMember("bufferView") ? image["bufferView"].GetInt() : 0;
			std::string mimeType = image.HasMember("mimeType") ? image["mimeType"].GetString() : "";
			asset->images.push_back(new TextureImage({ uri, bufferView, mimeType }));
		}
	}
	// samplers

	if (document.HasMember("samplers")) {
		auto samplers = document["samplers"].GetArray();
		for (Size i = 0; i < samplers.Size(); i++) {
			auto &sampler = samplers[i];
			int magFilter = sampler.HasMember("magFilter") ? sampler["magFilter"].GetInt() : 0;
			int minFilter = sampler.HasMember("minFilter") ? sampler["magFilter"].GetInt() : 0;
			int wrapS = sampler.HasMember("wrapS") ? sampler["wrapS"].GetInt() : nitro::Sampler::REPEAT;
			int wrapT = sampler.HasMember("wrapT") ? sampler["wrapT"].GetInt() : nitro::Sampler::REPEAT;
			std::string name;
			std::string extensions;
			std::string extras;
			asset->samplers.push_back(new nitro::Sampler({ magFilter,minFilter,wrapS,wrapT,name,extensions,extras }));
		}
	}

	// materials

	if(document.HasMember("materials")){
		auto materials = document["materials"].GetArray();
		for (Size i = 0; i < materials.Size(); i++) {
			auto &material = materials[i];
			nitro::Material *mat = new nitro::Material();
			mat->extensions = nitro::Encode(material, "extensions");
			mat->extras = nitro::Encode(material, "extras");
			mat->normalTextureIndex = Index(material, "normalTextureIndex", -1);
			mat->occlusionTextureIndex = Index(material, "occlusionTextureIndex", -1);
			mat->emissiveTextureIndex = Index(material, "emissiveTextureIndex", -1);
			if (material.HasMember("emissiveFactor")) {
				auto f = material["emissiveFactor"].GetArray();
				mat->emissiveFactor[0] = f[0].GetDouble();
				mat->emissiveFactor[1] = f[1].GetDouble();
				mat->emissiveFactor[2] = f[2].GetDouble();
			}
			mat->alphaCutoff = Real(material, "alphaCutoff", 0.5);
			mat->alphaMode = String(material, "alphaMode", "OPAQUE");
			mat->doubleSided = nitro::Bool(material, "doubleSided", false);
			if (material.HasMember("pbrMetallicRoughness")) {
				const auto &rough = material["pbrMetallicRoughness"].GetObject();
				auto color = rough.HasMember("baseColorFactor") ? rough["baseColorFactor"].GetArray() : White.GetArray();
				double metallicFactor = rough.HasMember("metallicFactor") ? rough["metallicFactor"].GetDouble() : 1.0f;
				int baseColorTextureIndex = -1;
				if (rough.HasMember("baseColorTexture")) {
					const auto &colorTexture = rough["baseColorTexture"].GetObject();
					if (colorTexture.HasMember("index")) {
						baseColorTextureIndex = colorTexture["index"].GetInt();
					}
				}
				mat->rough = new pbrMetallicRoughness({ { color[0].GetDouble(),color[1].GetDouble(),color[2].GetDouble(),color[3].GetDouble() },baseColorTextureIndex,metallicFactor });
			}
			mat->name = material["name"].GetString();
			asset->materials.push_back(mat);
		}
	}

	// accessors

	auto accessors = document["accessors"].GetArray();
	for (Size i = 0; i < accessors.Size(); i++) {
		auto &accessor = accessors[i];
		int viewIndex = accessor["bufferView"].GetInt();
		nitro::BufferView *bufferView = asset->bufferViews[viewIndex];
		size_t byteOffset = accessor.HasMember("byteOffset") ? accessor["byteOffset"].GetInt64() : 0;
		int componentType = accessor["componentType"].GetInt();
		int count = accessor["count"].GetInt64();
		std::vector<double> max;
		std::vector<double> min;
		if (accessor.HasMember("max")) {
			auto maxs = accessor["max"].GetArray();
			for (Size i = 0; i < maxs.Size(); i++) {
				max.push_back(maxs[i].GetDouble());
			}
		}
		if (accessor.HasMember("min")) {
			auto mins = accessor["min"].GetArray();
			for (Size i = 0; i < mins.Size(); i++) {
				min.push_back(mins[i].GetDouble());
			}
		}
		std::string type = accessor["type"].GetString();
		int span = nitro::AccessorSpan[type];
		asset->accessors.push_back(new nitro::Accessor({ bufferView, byteOffset, componentType, count, max, min, type, span }));
	}

	// meshes

	auto meshes = document["meshes"].GetArray();
	for (Size i = 0; i < meshes.Size(); i++) {
		auto &mesh = meshes[i];
		std::vector<nitro::Primitive*> primitives;
		auto prims = mesh["primitives"].GetArray();
		for (Size j = 0; j < prims.Size(); j++) {
			auto &prim = prims[j];			
			int indices = prim.HasMember("indices") ? prim["indices"].GetInt() : -1;			
			nitro::Primitive::Mode mode = prim.HasMember("Mode") ? (nitro::Primitive::Mode)prim["mode"].GetInt() : nitro::Primitive::TRIANGLES;// 4;
			int materialIndex = prim.HasMember("material") ? prim["material"].GetInt() : -1;
//			nitro::Material *material = asset->materials[materialIndex];
			std::map<std::string, int> attributes;
			auto attributesObject = prim["attributes"].GetObject();
// simon was here
/* 
			for (rapidjson::Value::ConstMemberIterator it = attributesObject.MemberBegin(); it != attributesObject.MemberEnd(); ++it) {
				std::string name = it->name.GetString();
				int value = it->value.GetInt();
				attributes[name] = value;
			}
*/				
			primitives.push_back(new nitro::Primitive({attributes,indices,mode,materialIndex}));
		}
		std::string name;
		if (mesh.HasMember("name")) {
			name = mesh["name"].GetString();
		}
		asset->meshes.push_back(new nitro::Mesh({ primitives, name }));
	};

	// nodes

	auto nodes = document["nodes"].GetArray();
	for (Size i = 0; i < nodes.Size(); i++) {
		auto &nodeObject = nodes[i];
		nitro::Node *node = new nitro::Node();
		if (nodeObject.HasMember("mesh")) {
			int meshIndex = nodeObject["mesh"].GetInt();
			node->mesh = asset->meshes[meshIndex];
		}
		if (nodeObject.HasMember("matrix")) {
			auto m = nodeObject["matrix"].GetArray();
			for (Size j = 0; j < m.Size(); j++) {
				node->matrix.push_back(m[j].GetFloat());
			}
		}
		asset->nodes.push_back(node);
	}
	for (Size i = 0; i < nodes.Size(); i++) {
		nitro::Node *node = asset->nodes[i];
		auto &nodeObject = nodes[i];
		if (nodeObject.HasMember("name")) {
			const char *name = nodeObject["name"].GetString();
			node->name = name;
		}
		if (nodeObject.HasMember("children")) {
			const auto &children = nodeObject["children"].GetArray();
			nitro::Node *node = asset->nodes[i];
			for (Size j = 0; j < children.Size(); j++) {
				int childIndex = children[j].GetInt();
				nitro::Node *child = asset->nodes[childIndex];
				node->children.push_back(child);
			}
		}
	}

	// scenes

	auto scenes = document["scenes"].GetArray();
	for (Size i = 0; i < scenes.Size(); i++) {
		auto &scene = scenes[i];
		std::string name;
		if (scene.HasMember("name")) {
			name = scene["name"].GetString();
		}
		std::vector<nitro::Node*>nodes;
		const auto &nodesObject = scene["nodes"].GetArray();
		for (Size j = 0; j < nodesObject.Size(); j++) {
			int nodeIndex = nodesObject[j].GetInt();
			nitro::Node *node = asset->nodes[nodeIndex];
			nodes.push_back(node);
		}
		asset->scenes.push_back(new nitro::Scene({ name, nodes }));
	}

	// scene

	if (document.HasMember("scene")) {
		int sceneIndex = document["scene"].GetInt();
		asset->scene = asset->scenes[sceneIndex];
	}

	*result = asset;
	return 0;
}

#endif

//enum JSType{Object,Array,String,Number,Integer,True,False,Null};
//struct JSValue{JSType type;utf8 string;

//typedef JSValue JSONValue;

/*
bool Bool(JSONValue &value, const char *member, bool def) {
	if (value.HasMember(member)) {
		return value[member].GetBool();
	}
	return def;
}

int Index(JSONValue &value, const char *member, int def) {
	if (value.HasMember(member)){
		return value[member].GetInt();
	}
	return def;
}

double Real(JSONValue &value, const char *member, double def) {
	if (value.HasMember(member)) {
		return value[member].GetDouble();
	}
	return def;
}

std::string String(JSONValue &value, const char *member, const char *def) {
	if (value.HasMember(member)) {
		return value[member].GetString();
	}
	return def;
}

std::string Encode(JSONValue &object, const char *member) {
	if (object.HasMember(member)) {
		rapidjson::StringBuffer buffer;
		rapidjson::Writer<rapidjson::StringBuffer> writer(buffer);
		object[member].Accept(writer);
		return buffer.GetString();
	}
	return std::string();
}
*/

Chunk resolveURI(std::string uri) {
	Chunk chunk;
	size_t headerSize = base64Header.size();
	if (uri.substr(0, headerSize) == base64Header) {
		int n = 4;
		int d24 = 0;	
		for (size_t o = headerSize; o < uri.size(); ++o) {
			char c = uri[o];
			int d = -1;
			if (c >= 'A'&&c <= 'Z') {
				d = c - 'A';
			}
			else if (c >= 'a'&&c <= 'z') {
				d = c + 26 - 'a';
			}
			else if (c >= '0'&&c <= '9') {
				d = c + 52 - '0';
			}
			else if (c == '+') {
				d = 62;
			}
			else if (c == '/') {
				d = 63;
			}
			if (d >= 0) {
				d24 = (d24 << 6) | d;
				if (--n == 0) {
					chunk.push_back((d24 >> 16) & 0xff);
					chunk.push_back((d24 >> 8) & 0xff);
					chunk.push_back((d24) & 0xff);
					d24 = 0;
					n = 4;
				}
			}
		}
		if (n != 4) {
			d24 = (d24 << (6*n));
			chunk.push_back((d24 >> 16) & 0xff);
			chunk.push_back((d24 >> 8) & 0xff);
			chunk.push_back((d24) & 0xff);
		}
	}
	std::ifstream stream(uri, std::ifstream::binary);
	if (stream){
		stream.seekg(0, std::ios::end);
		size_t size = stream.tellg();
		stream.seekg(0);
		chunk.resize(size);
		stream.read(chunk.data(), size);
	}

	return chunk;
}
