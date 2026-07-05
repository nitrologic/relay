#include <iostream>

extern "C" bool initFreetype(const char *filepath,int size);

int main(int argc, char* argv[]) {
   	bool ok=initFreetype("verdanab.ttf",72);
	std::cout << "initFreetype " << (ok?"OK":"FAIL") << std::endl;
    return 0;
}