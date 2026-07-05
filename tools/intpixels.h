// image.h

#pragma once

#include "nitrologic.h"
#include <jpeglib.h>
#include <zlib.h>
#include <png.h>

struct GeoPos {
	double lat;	 // negative south
	double lon;  // positive east
};

struct GeoRect {
	GeoPos a;
	GeoPos b;
};

struct GeoQuad {
	GeoPos a;
	GeoPos b;
	GeoPos c;
	GeoPos d;
};


enum Projection { MERC41, WGS, NZTM };

struct MercPos {
	double north;
	double east;
};

// bottom left to top right

struct MercRect {
	MercPos a;
	MercPos b;
};


#include "geo/tileaddress.h"

/*
#include <zlib.h>
#include "geod.h"
#include "libtiff/tiffiop.h"
#include <jasper/jasper.h>
*/

#include <deque>
#include <map>
#include <fstream>

#define GDAL_NODATA 42113

const int AlphaBits = 0xff000000;

const uint32_t PixelBit[] = {
	0x00000080,0x00000040,0x00000020,0x00000010,
	0x00000008,0x00000004,0x00000002,0x00000001,
	0x00008000,0x00004000,0x00002000,0x00001000,
	0x00000800,0x00000400,0x00000200,0x00000100,
	0x00800000,0x00400000,0x00200000,0x00100000,
	0x00080000,0x00040000,0x00020000,0x00010000,
	0x80000000,0x40000000,0x20000000,0x10000000,
	0x08000000,0x04000000,0x02000000,0x01000000,
};

typedef int IntPixel;

void RecycleIntPixels(IntPixel* pixels, size_t size);
IntPixel* AllocateIntPixels(size_t size);

class intPixels {

public:
	int width;
	int height;
	int bitdepth;
	int channels;
	int span;	//int words per line

	size_t size;
	size_t count = 0;	//pixels modified

	int refcount = 1;

	bool empty = true;
	bool retired = false;
	bool inCache = false;
	bool onDisk = false;

	TileAddress address;

	std::mutex image_mutex;

	intPixels() {
	}

	intPixels(int w, int h, int d, int c) {
		setSize(w, h, d, c);
	}

	intPixels(int w, int h, int d, int c, TileAddress a) {
		setSize(w, h, d, c);
		address = a;
	}

	~intPixels() {
		if (refcount) {
			std::cout << "&";
			//			std::cout << "image destructor detected non zero refcount" << EOL;
		}
		else {
			//		delete[]pixels;
			if (pixels) {
				RecycleIntPixels(pixels, size);
			}
		}
	}

	void saveLocked() {
		if (!empty) {
			std::error_code error;
			Path dir = address.path.parent_path();
			bool success = fs::create_directories(dir, error);
			std::string path = address.path.string();
			//			lockPixels();
			if (onDisk) {
				std::cout << "intPixels save onDisk is true for " << address.path << EOL;
			}
			bool saved = false;
			if (path.rfind(".png") == path.length() - 4) {
				saved = savePNG(path.c_str(), address.license);
			}
			else {
				saved = saveRAW16GZ(path.c_str());
			}
			if (!saved) {
				std::cout << "intPixels save failure for " << address.path << EOL;
			}
			//			unlock();
		}
		release();
	}

	void saveRawPixelsLocked() {
		Path path = address.path;
		path.replace_extension(".temp");
		std::ofstream raw;
		raw.open(path, std::ofstream::out | std::ofstream::binary);
		const char* p = (const char*)pixels;
		size_t n = sizeof(int) * span * height;
		raw.write(p, n);
		raw.close();
		delete[]pixels;
		pixels = 0;
		inCache = false;
		onDisk = true;
	}

	int* pixels = nullptr;

	void lock() {
		image_mutex.lock();
	}

	void applyGamma(double g) {
		int* p = pixels;
		for (int i = 0; i < size; i++) {
			p[i] = sRGB((unsigned char*)(p + i), g);
		}
		//		unlock();
	}

	intPixels* mipmap() {
		int w = width >> 1;
		int h = height >> 1;
		intPixels* mip = new intPixels(w, h, bitdepth, channels);
		for (int y = 0; y < h; y++) {
			for (int x = 0; x < w; x++) {
				int c = point32_2x2(x * 2, y * 2);
				mip->plot(x, y, c);
			}
		}
		return mip;
	}

	static int blend32(int c0, int c1) {
		// black is mask
		if ((c0&0xffffff )== 0) return c1;
		if ((c1 & 0xffffff) == 0) return c0;
		int r0 = (c0 >> 16) & 255;
		int g0 = (c0 >> 8) & 255;
		int b0 = c0 & 255;
		int r1 = (c1 >> 16) & 255;
		int g1 = (c1 >> 8) & 255;
		int b1 = c1 & 255;
		// todo add curve
		int r = (r0 + r1) >> 1;
		int g = (g0 + g1) >> 1;
		int b = (b0 + b1) >> 1;
		return 0xff000000 | (r << 16) | (g << 8) | b;
	}

	int point32_2x2(int x, int y) {
		int c0 = point32(x + 0, y + 0);
		int c1 = point32(x + 1, y + 0);
		int c2 = point32(x + 0, y + 1);
		int c3 = point32(x + 1, y + 1);
		int c01 = blend32(c0, c1);
		int c23 = blend32(c2, c3);
		int c = blend32(c01, c23);
		return c;
	}

	static int widen(int argb) {
		int r = (argb >> 17) & 0x7f;
		int g = (argb >> 9) & 0x7f;
		int b = (argb >> 1) & 0x7f;
		return (r << 20) | (g << 10) | b;
	}

	static int sharpen(int argb, int c30) {
		int r = (argb >> 16) & 0xff;
		int g = (argb >> 8) & 0xff;
		int b = (argb) & 0xff;
		int rr = (c30 >> 22) & 0xff;
		int gg = (c30 >> 12) & 0xff;
		int bb = (c30 >> 2) & 0xff;
		r += (r - rr) >> 1;
		if (r > 255 || r < 0) return argb;
		g += (g - gg) >> 1;
		if (g > 255 || g < 0) return argb;
		b += (b - bb) >> 1;
		if (b > 255 || b < 0) return argb;
		return 0xff000000 | (r << 16) | (g << 8) | b;
	}

	void unsharpen() {
		int* average = new int[width * height];
		int* p = pixels;
		for (int y = 1; y < height - 1; y++) {
			for (int x = 1; x < width - 1; x++) {
				int rgb30 = widen(p[0]) + widen(p[1]) + widen(p[2]);
				rgb30 += widen(p[width]) + widen(p[width + 2]);
				rgb30 += widen(p[width * 2 + 0]) + widen(p[width * 2 + 1]) + widen(p[width * 2 + 2]);
				average[y * width + x] = rgb30;
				p++;
			}
			p += 2;
		}
		for (int y = 1; y < height - 1; y++) {
			for (int x = 1; x < width - 1; x++) {
				pixels[y * width + x] = sharpen(pixels[y * width + x], average[y * width + x]);
			}
		}
		delete[] average;
	}

	// negative values only

	static void lumenAdd(int* p, int l) {
		unsigned char* u = (unsigned char*)p;
		int r = u[0] + l;
		int g = u[1] + l;
		int b = u[2] + l;
		int x = 0;
		if (r < 0) {
			x = std::min(r, x);
		}
		if (g < 0) {
			x = std::min(g, x);
		}
		if (b < 0) {
			x = std::min(b, x);
		}
		u[0] = r - x;
		u[1] = g - x;
		u[2] = b - x;
	}

	static void lumenAmp(int* p, double d) {
		unsigned char* u = (unsigned char*)p;
		int r = u[0] * d;
		int g = u[1] * d;
		int b = u[2] * d;
		int x = 255;
		if (r > 255) {
			x = std::max(r, x);
		}
		if (g > 255) {
			x = std::max(g, x);
		}
		if (b > 255) {
			x = std::max(b, x);
		}
		u[0] = r + 255 - x;
		u[1] = g + 255 - x;
		u[2] = b + 255 - x;
	}

	void addLumen(int l) {
		int* p = pixels;
		for (int y = 0; y < height; y++) {
			for (int x = 0; x < width; x++) {
				lumenAdd(p++, l);
			}
		}
	}

	void ampLumen(double d) {
		int* p = pixels;
		for (int y = 0; y < height; y++) {
			for (int x = 0; x < width; x++) {
				lumenAmp(p++, d);
			}
		}
	}

	bool hasTransparency() {
		for (int y = 0; y < height; y++) {
			int* p = pixels + y * span;
			for (int x = 0; x < width; x++) {
				if ((p[x] & AlphaBits) != AlphaBits) {
					return true;
				}
			}
		}
		return false;
	}

	bool hasMask() {
		for (int y = 0; y < height; y++) {
			int* p = pixels + y * span;
			for (int x = 0; x < width; x++) {
				if (p[x] == AlphaBits){
					return true;
				}
			}
		}
		return false;
	}

	void bakeMask(S path) {
		intPixels png;
		png.setSize(width, height, 1, 1);		
		for (int y = 0; y < height; y++) {
			int* p = pixels + y * span;
			for (int x = 0; x < width; x++) {
				if (p[x] != AlphaBits) {
					png.plot1(x,y,1);
				}
			}
		}
		png.savePNG(path.c_str());
		png.release();
	}

	void setSize(int w, int h, int d, int c) {
		if (pixels) {
			RecycleIntPixels(pixels, size);
			//delete[]pixels;
		}
		width = w;
		height = h;
		bitdepth = d;
		channels = c;
		int bits = bitdepth * channels;
		if (bits == 24) bits = 32; // RGB -> xRGB
		span = ((width * bits) + 31) / 32;
		size = span * height;
		//		pixels = new int[size];
		pixels = AllocateIntPixels(size);
		if (pixels == 0) {
			std::cout << "pixel allocation failure" << std::endl;
			// throw here
		}
		zero();
	}

	void unlock() {
		image_mutex.unlock();
	}

	void retain() {
		refcount++;
	}


	void release() {
		if (refcount) {
			refcount--;
			if (refcount == 0) {
				RecycleIntPixels(pixels, size);
				// delete[]pixels;
				pixels = nullptr;
				//			delete this;
			}
		}
		else {
			std::cout << "refcount issue with intPixels" << EOL;
		}
	}
	/*
		static void validate() {
			if (imageCache.size()) {
				std::cout << "intPixels::validate failure" << EOL;
			}
		}

		int *lockPixels() {
			lock();

			if (inCache) {
				cacheMutex.lock();
				auto it = std::find(imageCache.begin(), imageCache.end(), this);
				imageCache.erase(it);
				inCache = false;
				cacheMutex.unlock();
			}

			if (onDisk) {
				_loadRawPixels();
			}

			if (!retired && !pixels) {
				std::cout << "lockPixels detected absence of pixels" << EOL;
			}

			return pixels;
		}


		static void regulateImageCache() {
			cacheMutex.lock();
			while (imageCache.size() > IMAGE_CACHE_SIZE) {
				intPixels *tile = imageCache.front();
				imageCache.pop_front();
				tile->inCache = false;
				if (tile->retired) {
					std::cout << "tile from imagecache already retired" << EOL;
					continue;
				}
				tile->saveRawPixels();
			}
			cacheMutex.unlock();
		}

		void cache() {
			if (retired) return;
			cacheMutex.lock();
			imageCache.push_back(this);
			inCache = true;
			cacheMutex.unlock();
		}

	*/

	void _loadRawPixels() {
		Path path = address.path;
		path.replace_extension(".temp");
		std::ifstream raw;
		raw.open(path, std::ifstream::in | std::ifstream::binary);
		setSize(width, height, bitdepth, channels);
		char* p = (char*)pixels;
		size_t n = sizeof(int) * span * height;
		raw.read(p, n);
		raw.close();
		fs::remove(path);
		onDisk = false;
	}

	int point32(int x, int y) {
		int c = pixels[y * span + x];
		return c;
	}
	int pointlo(int x, int y) {
		int c = point32(x, y);
		return c & 0xffff;
	}
	int pointhi(int x, int y) {
		int c = point32(x, y);
		return (c >> 16) & 0xffff;
	}

	void plot1(int x, int y, int c) {
		int p = y * span + (x >> 5);
		int b = PixelBit[x & 31];
		if (c) {
			pixels[p] |= b;
		}
		else {
			pixels[p] &= ~b;
		}
	}

	void plot32(int x, int y, int c) {
		pixels[y * span + x] = c;
	}

	void safeplot32(int x, int y, int c) {
		if (x >= 0 && y >= 0 && x < width && y < height) {
			plot32(x, y, c);
		}
	}

	void plotline32(P x0, P y0, P x1, P y1, int c) {
		P dx = x1 - x0;
		P dy = y1 - y0;
		int d = (int)sqrt(dx * dx + dy * dy);
		for (int i = 0; i < d; i++) {
			P x = x0 + i * dx / d;
			P y = y0 + i * dy / d;
			safeplot32(x, y, c);
		}
	}

	bool insideLat(const MercRect& rect, double n) const {
		double y = height * (n - rect.a.north) / (rect.b.north - rect.a.north);
		int iy = ifloor(y);
		if (iy < 0 || iy > height - 1) return false;
		return true;
	}

	bool sampleColor(const MercRect& rect, double n, double e, u32& color) const {
		int rx = 1;
		int ry = span;
		double x = width * (e - rect.a.east) / (rect.b.east - rect.a.east);
		int ix = ifloor(x);
		if (ix < 0 || ix > width - 1) return false;
		if (ix == width - 1) rx = 0;
		double y = height * (n - rect.a.north) / (rect.b.north - rect.a.north);
		int iy = ifloor(y);
		if (iy < 0 || iy > height - 1) return false;
		if (iy == height - 1) ry = 0;
		int p = ix + iy * width;
		x -= ix;
		y -= iy;
		u32 c0 = pixels[p];
		u32 c1 = pixels[p + rx];
		u32 c2 = pixels[p + ry];
		u32 c3 = pixels[p + ry + rx];
		u32 c4 = lerpColor(c0, c1, x);
		u32 c5 = lerpColor(c2, c3, x);
		u32 c6 = lerpColor(c4, c5, y);
		if (c6 < 0x03000000) return false;
		color = c6;
		return true;
	}

	bool sampleColor(const GeoRect& rect, double lat, double lon, int& color) const {
		int rx = 1;
		int ry = span;
		double x = width * (lon - rect.a.lon) / (rect.b.lon - rect.a.lon);
		int ix = ifloor(x);
		if (ix < 0 || ix > width - 1) return false;
		if (ix == width - 1)rx = 0;
		double y = height * (lat - rect.a.lat) / (rect.b.lat - rect.a.lat);
		int iy = ifloor(y);
		if (iy < 0 || iy > height - 1) return false;
		if (iy == height - 1) ry = 0;
		int p = ix + iy * width;
		x -= ix;
		y -= iy;
		int c0 = pixels[p];
		int c1 = pixels[p + rx];
		int c2 = pixels[p + ry];
		int c3 = pixels[p + ry + rx];
		int c4 = lerpColor(c0, c1, x);
		int c5 = lerpColor(c2, c3, x);
		int c6 = lerpColor(c4, c5, y);
		color = c6;
		return true;
	}

	void clear(int c) {
		for (size_t i = 0; i < size; i++) {
			pixels[i] = c;
		}
	}

	void zero() {
		memset(pixels, 0x00, 4 * span * height);
	}

	void plot(int x, int y, int c) {
		pixels[y * span + x] = c;
	}

	void parse(int& minValue, int& maxValue) {
		int min = 0x7fffffff;
		int max = 0x80000000;
		for (size_t i = 0; i < size; i++) {
			int p = pixels[i];
			min = std::min(min, p);
			max = std::max(max, p);
		}
		minValue = min;
		maxValue = max;
	}

	void frame() {
		for (int i = 0; i < 256; i++) {
			plot(i, 0, -1);
			plot(0, i, -1);
			plot(255, i, -1);
			plot(i, 255, -1);
		}
	}

	bool savePPM(const char* path) {
		FILE* fd = fopen(path, "wb");
		if (!fd) return false;
		fprintf(fd, "P6\n%d %d\n255\n", width, height);
		//		fwrite(buf, 1, rbuf.width() * rbuf.height() * 3, fd);
		fclose(fd);
		return true;
	}

#define BLOCK_SIZE 16384

	static std::string jpegBuffer;

	static void initDestination(j_compress_ptr cinfo) {
		jpegBuffer.resize(BLOCK_SIZE);
		cinfo->dest->next_output_byte = (JOCTET*)&jpegBuffer[0];
		cinfo->dest->free_in_buffer = jpegBuffer.size();
	}

	static boolean emptyOutputBuffer(j_compress_ptr cinfo) {
		size_t oldsize = jpegBuffer.size();
		jpegBuffer.resize(oldsize + BLOCK_SIZE);
		cinfo->dest->next_output_byte = (JOCTET*)&jpegBuffer[oldsize];
		cinfo->dest->free_in_buffer = jpegBuffer.size() - oldsize;
		return true;
	}

	static void termDestination(j_compress_ptr cinfo) {
		jpegBuffer.resize(jpegBuffer.size() - cinfo->dest->free_in_buffer);
	}

	static std::string encodeExif() {
		std::string exif = "Exif\0\0";
		return exif;
	}

	static void jpegMeta(j_compress_ptr cinfo, std::string comment, std::string exif = "") {
		if (comment.length()) {
			cinfo->write_JFIF_header = TRUE;
			jpeg_write_marker(cinfo, JPEG_COM, (JOCTET*)comment.c_str(), comment.length() + 1);
		}
		if (exif.length()) {
			cinfo->write_JFIF_header = TRUE;
			jpeg_write_marker(cinfo, JPEG_APP0 + 1, (JOCTET*)exif.c_str(), exif.length());
		}
	}

	std::string createJPG(int quality) {
//		assert(channels == 4);
		jpeg_error_mgr errorHandler;
		jpeg_compress_struct ccinfo;
		jpeg_error_mgr jerr;
		jpeg_destination_mgr mgr;
		ccinfo.err = jpeg_std_error(&errorHandler);
		jpeg_create_compress(&ccinfo);

		mgr.init_destination = &initDestination;
		mgr.empty_output_buffer = &emptyOutputBuffer;
		mgr.term_destination = &termDestination;

		ccinfo.dest = &mgr;

		ccinfo.image_width = width;				//* image width and height, in pixels
		ccinfo.image_height = height;
		ccinfo.input_components = 3;				// # of color components per pixel
		ccinfo.in_color_space = JCS_RGB;			// colorspace of input image
		jpeg_set_defaults(&ccinfo);
		jpeg_set_quality(&ccinfo, quality, TRUE);
		jpeg_start_compress(&ccinfo, TRUE);

		//		jpegMeta(&ccinfo,"This is a test", encodeExif());

		JSAMPROW pix = new JSAMPLE[width * 3];
		for (int y = 0; y < height; y++) {
			int* src = pixels + y * span;
			for (int x = 0; x < width; x++) {
				int rgb = src[x];
				pix[x * 3 + 0] = rgb & 255;
				pix[x * 3 + 1] = (rgb >> 8) & 255;
				pix[x * 3 + 2] = (rgb >> 16) & 255;
			}
			JDIMENSION result = jpeg_write_scanlines(&ccinfo, &pix, 1);
		}
		delete[]pix;
		jpeg_finish_compress(&ccinfo);
		jpeg_destroy_compress(&ccinfo);
		return jpegBuffer;
	}

	bool saveJPEG(const char* path, int quality) {
		if (channels != 4) return false;
		FILE* fp = fopen(path, "wb");
		if (!fp) return false;
		jpeg_error_mgr errorHandler;
		jpeg_compress_struct ccinfo;
		jpeg_error_mgr jerr;
		ccinfo.err = jpeg_std_error(&errorHandler);

		jpeg_create_compress(&ccinfo);
		jpeg_stdio_dest(&ccinfo, fp);

		ccinfo.image_width = width;				//* image width and height, in pixels
		ccinfo.image_height = height;
		ccinfo.input_components = 3;				// # of color components per pixel
		ccinfo.in_color_space = JCS_RGB;			// colorspace of input image
		jpeg_set_defaults(&ccinfo);
		jpeg_set_quality(&ccinfo, quality, TRUE);
		jpeg_start_compress(&ccinfo, TRUE);
		JSAMPROW pix = new JSAMPLE[width * 3];
		for (int y = 0; y < height; y++) {
			int* src = pixels + y * span;
			for (int x = 0; x < width; x++) {
				int rgb = src[x];
				pix[x * 3 + 0] = rgb & 255;
				pix[x * 3 + 1] = (rgb >> 8) & 255;
				pix[x * 3 + 2] = (rgb >> 16) & 255;
			}
			JDIMENSION result = jpeg_write_scanlines(&ccinfo, &pix, 1);
		}
		delete[]pix;
		jpeg_finish_compress(&ccinfo);
		jpeg_destroy_compress(&ccinfo);
		int success = fclose(fp);
		return success == 0;
	}

	static void write(png_structp png, png_bytep bytes, png_size_t size) {
		ByteBuffer* buffer = (ByteBuffer*)png_get_io_ptr(png);
		size_t n = buffer->size();
		buffer->resize(n + size);
		memcpy(buffer->data() + n, bytes, size);
	}

	static void flush_png(png_structp png) {
	}

	ByteBuffer createPNG() {
		ByteBuffer byteBuffer;
		png_structp png = png_create_write_struct(PNG_LIBPNG_VER_STRING, nullptr, nullptr, nullptr);
		png_set_write_fn(png, &byteBuffer, write, flush_png);
		bool success = writePNG(png);
		return byteBuffer;
	}

	bool savePNG(const char* path, const char* license = NULL) {
		FILE* fp = fopen(path, "wb");
		if (!fp) return false;
		png_structp png = png_create_write_struct(PNG_LIBPNG_VER_STRING, nullptr, nullptr, nullptr);
		png_init_io(png, fp);
		bool result = writePNG(png, (char*)license);
		int closed = fclose(fp);
		if (closed == EOF) {
			result = false;
		}
		return result;
	}

	bool saveRAW16GZ(const char* path) {
		size_t n = sizeof(int) * span * height;
		gzFile gz = gzopen(path, "wb");;
		if (gz != 0) {
			gzwrite(gz, pixels, n);
			gzclose(gz);
			return true;
		}
		return false;
	}

	bool saveRAW16Deflate(const char* path) {
		size_t n = sizeof(int) * span * height;
		uLongf size = n + 32;
		Bytef* buffer = (Bytef*)malloc(size);
		int ok = compress((Bytef*)buffer, &size, (const Bytef*)pixels, n);
		if (ok == Z_OK) {
			std::ofstream raw;
			raw.open(path, std::ofstream::out | std::ofstream::binary);
			raw.write((const char*)buffer, size);
			raw.close();
			free(buffer);
			return true;
		}
		std::cout << "?" << n << std::flush;
		free(buffer);
		return false;
	}


	bool writePNG(png_structp& png, png_charp license = NULL) {

		int color_type;
		switch (channels) {
		case 4:
			color_type = PNG_COLOR_TYPE_RGB_ALPHA;
			break;
		case 3:
			color_type = PNG_COLOR_TYPE_RGB;
			break;
		case 2:
			color_type = PNG_COLOR_TYPE_GRAY_ALPHA;
			break;
		case 1:
			color_type = PNG_COLOR_TYPE_GRAY;
			break;
		default:
			return false;
		}

		int bits = channels * bitdepth;
		int bit_depth = bitdepth;

		int interlace_method = PNG_INTERLACE_NONE;
		int compression_method = PNG_COMPRESSION_TYPE_DEFAULT;
		int filter_method = PNG_FILTER_TYPE_DEFAULT;

		png_infop info = png_create_info_struct(png);
		png_set_IHDR(png, info, width, height, bit_depth, color_type, interlace_method, compression_method, filter_method);

		if (license) {
			//			int numText = 1;
			//			png_charp License = "License";
			//			png_text text = { -1,License,license,strlen(license),0 };
			//			png_set_text(png, info, &text, 1);
						/*
					{
						int  compression;       // compression value: -1: tEXt, none 0: zTXt, deflate 1: iTXt, none 2: iTXt, deflate
						png_charp key;          // keyword, 1-79 character description of "text"
						png_charp text;         // comment, may be an empty string (ie "") or a NULL pointer
						png_size_t text_length; // length of the text string
						png_size_t itxt_length; // length of the itxt string
						png_charp lang;         // language code, 0-79 characters or a NULL pointer
						png_charp lang_key;     // keyword translated UTF-8 string, 0 or more chars or a NULL pointer
					} png_text;
					*/
		}
		png_write_info(png, info);	//png_set_bgr(png);

		png_bytep* rows = new png_bytep[height];
		for (int y = 0; y < height; y++) {
			rows[y] = (png_bytep)(pixels + y * span);
		}
		png_write_rows(png, rows, height);
		delete[]rows;

		png_write_end(png, info);
		png_destroy_write_struct(&png, &info);

		return true;
	}


#ifdef TO_BE_SUPPORTED

	bool readjp2fromstream(jas_stream_t* in) {
		int flags = 0;
		jas_image_t* img;
		jas_matrix_t* matrix;
		int w, h, d, res;
		int i, x, y;
		int* src;
		int* buffer;
		int alpha;
		int shift;

		//  img=jas_image_decode(in,-1,"");    //jas_stream_t *in, int fmt, char *optstr)
		img = jp2_decode(in, "");

		if (!img)
			return false;

		w = img->brx_;
		h = img->bry_;
		d = img->numcmpts_;

		//		std::cout << "decoding jp2 stream " << w << " x " << h << " x " << d << EOL;

		matrix = jas_matrix_create(1, w);
		src = (int*)matrix->rows_[0];

		setSize(w, h, 8, 4);

		//		pix = owner->createtexture(w, h, flags);

		buffer = new int[w];
		alpha = 0;
		if (d == 3) {
			alpha = 0xff000000;
		}
		/*
		int jas_image_readcmpt(jas_image_t *image, int cmptno, jas_image_coord_t x,
		jas_image_coord_t y, jas_image_coord_t width, jas_image_coord_t height,
		jas_matrix_t *data)
		*/
		for (y = 0; y < h; y++) {
			for (x = 0; x < w; x++) {
				buffer[x] = alpha;
			}
			//			memset(buffer, 0, w * 4);
			for (i = 0; i < d; i++) {
				res = jas_image_readcmpt(img, i, 0, y, w, 1, matrix);
				if (res) {
					std::cout << "jas_image_readcmpt fail" << EOL;
				}
				shift = i * 8;	// (d - i - 1) * 8;
				for (x = 0; x < w; x++) {
					buffer[x] |= src[x] << shift;

				}
			}
			for (x = 0; x < w; x++) {
				int c = buffer[x] | alpha;
				plot(x, y, c);
			}
		}

		delete[]buffer;
		jas_matrix_destroy(matrix);
		jas_image_destroy(img);

		return true;
	}

	bool loadJasper(const char* path) {
		jas_stream_t* in;
		if (jas_init()) {
			return false;
		}
		jas_setdbglevel(0);
		in = jas_stream_fopen(path, "rb");
		bool result = readjp2fromstream(in);
		jas_stream_close(in);
		jas_cleanup();
		return result;
	}
#endif

	static int encodeGamma8(int a, double g) {
		double a2 = pow(a / 255.0, 1.0 / g) * 255;
		if (a2 > 255) a2 = 255;
		return (int)a2;
	}

	static int sRGB(unsigned char* raw, double gamma) {
		int b = encodeGamma8(raw[0], gamma);
		int g = encodeGamma8(raw[1], gamma);
		int r = encodeGamma8(raw[2], gamma);
		int a = raw[3];
		return (a << 24) | (r << 16) | (g << 8) | b;
	}

	static int encodeGamma16(int a, double g) {
		double a2 = pow(a / 65535.0, 1.0 / g) * 255 * 1.5;
		if (a2 > 255) a2 = 255;
		return (int)a2;
	}

	static int sentinelRGB(unsigned short* raw) {
		double gamma = 2.2;
		int b = encodeGamma16(raw[0], gamma);
		int g = encodeGamma16(raw[1], gamma);
		int r = encodeGamma16(raw[2], gamma);
		return 0xff000000 | (r << 16) | (g << 8) | b;
	}

#ifdef TO_BE_SUPPORTED

	int TiffField(TIFF* tif, ttag_t tag) {
		int result = 0;
		int status = TIFFGetField(tif, tag, &result);
		return result;
	}

	void readNoDataValue(TIFF* tif) {
		uint32 count = 0;
		char* data;
		int status = TIFFGetField(tif, GDAL_NODATA, &count, &data);
		if (status) {
			noData = atof(data);
		}
	}

	double noData = 0.0;

	bool loadTIF(const char* path) {
		TIFF* tif = TIFFOpen(path, "rb");
		if (!tif) {
			return false;
		}

#ifdef LIST_TIF_CUSTOM_FIELDS
		TIFFDirectory* td = &tif->tif_dir;
		for (int fi = 0, nfi = tif->tif_nfields; nfi > 0; nfi--, fi++) {
			const TIFFFieldInfo* fip = tif->tif_fieldinfo[fi];
			if (fip->field_bit == FIELD_CUSTOM) {
				int ci, is_set = FALSE;
				for (ci = 0; ci < td->td_customValueCount; ci++)
					is_set |= (td->td_customValues[ci].info == fip);
				if (!is_set)
					continue;
			}
			else if (!TIFFFieldSet(tif, fip->field_bit))
				continue;
			std::cout << fip->field_name << EOL;
		}
#endif

		int imageWidth = TiffField(tif, TIFFTAG_IMAGEWIDTH);
		int imageLength = TiffField(tif, TIFFTAG_IMAGELENGTH);
		int samplesPerPixel = TiffField(tif, TIFFTAG_SAMPLESPERPIXEL);

		int bitsPerSample = TiffField(tif, TIFFTAG_BITSPERSAMPLE);
		int sampleFormat = TiffField(tif, TIFFTAG_SAMPLEFORMAT);

		// std::cout << "load TIF path:" << path << " size:" << imageWidth << "x" << imageLength << " depth:" << bitsPerSample << " channels:" << samplesPerPixel << " format:" << sampleFormat << EOL;

		int wordSize = (bitsPerSample * samplesPerPixel) / 8;

		setSize(imageWidth, imageLength, 8, 4);

		//		readNoDataValue(tif);

				// std::cout << "load TIF path:" << path << " noData=" << noData << EOL;

		tdata_t buf;

		if (isTiled(tif)) {
			tsize_t tileSize = TIFFTileSize(tif);
			ttile_t tileCount = TIFFNumberOfTiles(tif);
			tsize_t tileRowSize = TIFFTileRowSize(tif);

			int tileWidth = TiffField(tif, TIFFTAG_TILEWIDTH);
			int tileLength = TiffField(tif, TIFFTAG_TILELENGTH);

			//			TIFFTileMethod
			buf = _TIFFmalloc(tileSize);
			int xpos = 0;
			int ypos = 0;
			for (ttile_t tile = 0; tile < tileCount; tile++) {
				tsize_t res = TIFFReadEncodedTile(tif, tile, buf, (tsize_t)-1);
				unsigned char* raw = (unsigned char*)buf;

				int w = (xpos > imageWidth - tileWidth) ? imageWidth - xpos : tileWidth;
				int h = (ypos > imageLength - tileLength) ? imageLength - ypos : tileLength;
				if (h < 0) h = imageLength - ypos;

				for (int y = 0; y < h; y++) {
					for (int x = 0; x < w; x++) {
						int argb = sRGB(raw, 1.3);
						raw += 4;
						plot32(xpos + x, ypos + y, argb);
					}
					raw += 4 * (tileWidth - w);
				}
				xpos += w;
				if (xpos == imageWidth) {
					xpos = 0;
					ypos += h;
				}
			}
		}
		else {
			tstrip_t stripSize = TIFFStripSize(tif);
			tstrip_t stripCount = TIFFNumberOfStrips(tif);
			tstrip_t strip;

			buf = _TIFFmalloc(stripSize);
			int ypos = 0;

			for (strip = 0; strip < stripCount; strip++) {
				//			tsize_t ssize = TIFFReadEncodedStrip(tif, strip, buf, (tsize_t)-1);
				tsize_t ssize = TIFFReadEncodedStrip(tif, strip, buf, (tsize_t)stripSize);
				unsigned short* raw = (unsigned short*)buf;
				while (ssize > 0) {
					tstrip_t size = width * wordSize;
					for (int xpos = 0; xpos < width; xpos++) {
						int argb = sentinelRGB(raw);
						raw += 4;
						plot32(xpos, ypos, argb);
					}
					ssize -= size;
					ypos++;
				}
				if (ssize) {
					std::cout << "TIF strip error ssize = " << ssize << EOL;
				}
			}
		}
		_TIFFfree(buf);
		TIFFClose(tif);

		return true;
	}
#endif

	static void pngErrorHandler(png_structp png_ptr, png_const_charp error_msg) {
		const char* path = (const char*)(png_get_error_ptr(png_ptr));
		std::cout << error_msg << " path:" << path << EOL;
	}

	bool loadPNG(const char* path) {
		FILE* fp = fopen(path, "rb");
		if (!fp) return false;
		png_byte header[8];
		fread(header, 1, 8, fp);
		bool result = false;
		if (png_sig_cmp(header, 0, 8) == 0) {
			png_structp png = png_create_read_struct(PNG_LIBPNG_VER_STRING, nullptr, nullptr, nullptr);

			png_set_error_fn(png, (void*)path, pngErrorHandler, NULL);

			png_infop info = png_create_info_struct(png);
			png_infop end_info = png_create_info_struct(png);

			png_init_io(png, fp);

			png_set_sig_bytes(png, 8);

			png_read_info(png, info);

			//			png_set_bgr(png);

			png_uint_32 pixel_width;
			png_uint_32 pixel_height;
			int bit_depth;
			int color_type;
			int interlace_method;
			int compression_method;
			int filter_method;

			png_get_IHDR(png, info, &pixel_width, &pixel_height, &bit_depth, &color_type, &interlace_method, &compression_method, &filter_method);

			int channels = 0;
			switch (color_type) {
			case PNG_COLOR_TYPE_RGB_ALPHA:
				channels = 4;
				break;
			case PNG_COLOR_TYPE_RGB:
				channels = 3;
				break;
			case PNG_COLOR_TYPE_GRAY_ALPHA:
				channels = 2;
				break;
			case PNG_COLOR_TYPE_GRAY:
				channels = 1;
				break;
			}
			setSize(pixel_width, pixel_height, bit_depth, channels);

			// simon come here

			int** lines = new int* [height];
			for (png_uint_32 i = 0; i < pixel_height; i++) {
				lines[i] = pixels + i * span;
			}
			png_read_image(png, (png_bytepp)lines);
			delete[] lines;

			png_read_end(png, end_info);

			png_destroy_read_struct(&png, &info, &end_info);

			if (color_type == PNG_COLOR_TYPE_RGB) {
				for (int y = 0; y < height; y++) {
					expandLine(y);
				}
			}

			result = true;
		}
		fclose(fp);
		return result;
	}

	bool loadJPG(const char* path) {

		jpeg_error_mgr errorHandler;
		jpeg_decompress_struct decompress;

		FILE* file = fopen(path, "rb");
		if (file == 0) return 0;

		jpeg_decompress_struct* jpg = &decompress;

		jpg->err = jpeg_std_error(&errorHandler);

		jpeg_create_decompress(jpg);
		jpeg_stdio_src(jpg, file);

		int res = jpeg_read_header(jpg, TRUE);
		if (res != 1) {
			jpeg_destroy_decompress(jpg);
			return 0;
		}

		jpeg_start_decompress(jpg);

		setSize(jpg->image_width, jpg->image_height, 8, 4);

		JSAMPROW rows[1];
		for (int y = 0; y < height; y++) {
			rows[0] = (JSAMPROW)(pixels + y * width);
			int dim = jpeg_read_scanlines(jpg, rows, 1);
			expandLine(y);
		}

		jpeg_finish_decompress(jpg);
		jpeg_destroy_decompress(jpg);

		fclose(file);

		return true;
	}

	void expandLine(int y) {
		uint8_t* rgb = (uint8_t*)(pixels + y * width) + 3 * (width - 1);
		int* argb = pixels + y * width + width - 1;
		for (int x = 0; x < width; x++) {
			int c = 0xff000000 | rgb[2] << 16 | rgb[1] << 8 | rgb[0];
			*argb = c;
			rgb -= 3;
			argb--;
		}
	}

};
