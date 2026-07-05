#include "nitrologic.h"
#include "intpixels.h"
#include <mutex>

typedef std::deque<IntPixel*> PixelCache;
typedef std::map<size_t, PixelCache> PixelHeap;
PixelHeap pixelHeap;
std::mutex pixelMutex;

void RecycleIntPixels(IntPixel* pixels, size_t size) {
	Lock guard(pixelMutex);
	PixelCache& cache = pixelHeap[size];
	cache.push_back(pixels);
}

IntPixel* AllocateIntPixels(size_t size) {
	Lock guard(pixelMutex);
	PixelCache& cache = pixelHeap[size];
	if (cache.size()) {
		IntPixel* result = cache.back();
		cache.pop_back();
		memset(result, 0, size * 4);
		return result;
	}
	return new int[size];
}
