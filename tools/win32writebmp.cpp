// writebmp.cpp

#include <windows.h>
#include <stdio.h>

extern "C" bool writeBMP(const char* filename, const void* pPixels, int width, int height);

/**
 * Saves a raw 32-bit DIB pixel buffer as a standard Windows BMP file.
 * 
 * @param filename  The destination path (e.g., "desktop.bmp")
 * @param pPixels   Direct pointer to the DIB section's pixel array (BGRA)
 * @param width     The width of the image in pixels
 * @param height    The absolute height of the image in pixels
 * @return          true if successful, false otherwise
 */
 bool writeBMP(const char* filename, const void* pPixels, int width, int height) {
	if (!filename || !pPixels || width <= 0 || height <= 0) {
		return false;
	}

	DWORD imageSize = (DWORD)(width * height * 4);

	BITMAPFILEHEADER bfh = {0};
	bfh.bfType = 0x4D42; // "BM" signature in hex
	bfh.bfOffBits = sizeof(BITMAPFILEHEADER) + sizeof(BITMAPINFOHEADER); // Offset to start of pixels (54 bytes)
	bfh.bfSize = bfh.bfOffBits + imageSize; // Total file size

	BITMAPINFOHEADER bih = {0};
	bih.biSize = sizeof(BITMAPINFOHEADER);
	bih.biWidth = width;
	bih.biHeight = -height; 
	bih.biPlanes = 1;
	bih.biBitCount = 32; // BGRA
	bih.biCompression = BI_RGB; // Uncompressed
	bih.biSizeImage = imageSize;

	FILE* f = fopen(filename, "wb");
	if (!f) return false;

	if (fwrite(&bfh, sizeof(BITMAPFILEHEADER), 1, f) != 1) {fclose(f);return false;}
	if (fwrite(&bih, sizeof(BITMAPINFOHEADER), 1, f) != 1) {fclose(f);return false;}
	if (fwrite(pPixels, 1, imageSize, f) != imageSize) {fclose(f);return false;}

	fclose(f);
	return true;
}
