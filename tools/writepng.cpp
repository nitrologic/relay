// writepng.cpp

#include <png.h>
#include <cstdio>

extern "C" bool writePNG(const char* filename, const void* pPixels, int width, int height);

// Custom error handler that does nothing (or you can log here)
void my_error_fn(png_structp png_ptr, png_const_charp error_msg) {
    // You could print error_msg to stderr if desired
}

void my_warning_fn(png_structp png_ptr, png_const_charp warning_msg) {
    // Ignore warnings
}

bool writePNG(const char* filename, const void* pPixels, int width, int height) {
    FILE* fp = fopen(filename, "wb");
    if (!fp) return false;

    // Pass custom error functions instead of NULL
    png_structp png_ptr = png_create_write_struct(PNG_LIBPNG_VER_STRING, NULL, my_error_fn, my_warning_fn);
    if (!png_ptr) {
        fclose(fp);
        return false;
    }

    png_infop info_ptr = png_create_info_struct(png_ptr);
    if (!info_ptr) {
        png_destroy_write_struct(&png_ptr, NULL);
        fclose(fp);
        return false;
    }

    png_init_io(png_ptr, fp);

    png_set_IHDR(png_ptr, info_ptr, width, height, 8,
                 PNG_COLOR_TYPE_RGB_ALPHA, PNG_INTERLACE_NONE,
                 PNG_COMPRESSION_TYPE_DEFAULT, PNG_FILTER_TYPE_DEFAULT);

    png_set_bgr(png_ptr);
    png_write_info(png_ptr, info_ptr);

    for (int y = 0; y < height; y++) {
        png_write_row(png_ptr, (png_const_bytep)((const unsigned char*)pPixels + (y * width * 4)));
    }

    png_write_end(png_ptr, info_ptr);
    png_destroy_write_struct(&png_ptr, &info_ptr);
    fclose(fp);

    return true;
}
