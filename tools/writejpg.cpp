// writejpg.cpp

#include <jpeglib.h>
#include <vector>

extern "C" bool writeJPG(const char* filename, const void* pPixels, int width, int height, int quality);

bool writeJPG(const char* filename, const void* pPixels, int width, int height, int quality){
	struct jpeg_compress_struct cinfo;
	struct jpeg_error_mgr jerr;
	FILE* outfile;
	cinfo.err = jpeg_std_error(&jerr);
	jpeg_create_compress(&cinfo);
	if ((outfile = fopen(filename, "wb")) == NULL) return false;
	jpeg_stdio_dest(&cinfo, outfile);
	cinfo.image_width = width;
	cinfo.image_height = height;
	cinfo.input_components = 3;       // JPEG uses RGB
	cinfo.in_color_space = JCS_RGB;
	jpeg_set_defaults(&cinfo);
	jpeg_set_quality(&cinfo, quality, TRUE);
	jpeg_start_compress(&cinfo, TRUE);
	// Buffer for one row of RGB (no Alpha)
	std::vector<unsigned char> row_buffer(width * 3);
	const unsigned char* src = (const unsigned char*)pPixels;
	while (cinfo.next_scanline < cinfo.image_height) {
		const unsigned char* src_row = src + (cinfo.next_scanline * width * 4);
		for (int i = 0; i < width; i++) {
			// BGRA to RGB (skip Alpha)
			row_buffer[i * 3 + 0] = src_row[i * 4 + 2]; // R
			row_buffer[i * 3 + 1] = src_row[i * 4 + 1]; // G
			row_buffer[i * 3 + 2] = src_row[i * 4 + 0]; // B
		}
		JSAMPROW row_pointer[1] = { row_buffer.data() };
		jpeg_write_scanlines(&cinfo, row_pointer, 1);
	}
	jpeg_finish_compress(&cinfo);
	fclose(outfile);
	jpeg_destroy_compress(&cinfo);
	return true;
}
