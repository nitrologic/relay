#include <iostream>
#include "intpixels.h"
#include "readgltf.h"

extern "C" bool initFreetype(const char *filepath,int size);

int testImage(const char *src){
	Path srcPath=src;
	size_t n = srcPath.string().size();
	intPixels* image = new intPixels();
	bool result = image->loadPNG(srcPath.string().c_str());
	if (!result) {
		std::cout << "publishRaw loadPNG failure for " << srcPath << std::endl;
		return -1;
	}
	std::cout << "image " << image->width << " x " << image->height << std::endl;
	return 0;
}

int main(int argc, char* argv[]) {
   	bool ok=initFreetype("verdanab.ttf",72);
	std::cout << "initFreetype " << (ok?"OK":"FAIL") << std::endl;
	int result=testImage("desktop.png");
	std::cout << "testImage " << (result) << std::endl;

	nitro::Asset *assets;

	int result2=nitro::readGLTF("test.gltf",&assets);

    return 0;
}