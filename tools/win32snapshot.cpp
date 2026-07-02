// win32snapshot.cpp

#include <windows.h>
#include <stdio.h>
#include <iostream>

#include "base64.h"

extern "C" bool writePNG(const char* filename, const void* pPixels, int width, int height);

extern "C" bool writeBMP(const char* filename, const void* pPixels, int width, int height);

int main(int argc, char* argv[]) {
	SetProcessDPIAware();

	const char* dest = (argc > 1) ? argv[1] : "desktop.png";
	const char* bmp_dest = "desktop.bmp";

	int width = GetSystemMetrics(SM_CXSCREEN);
	int height = GetSystemMetrics(SM_CYSCREEN);

	HDC hdcScreen = GetDC(NULL); 
	if (!hdcScreen) return 1;
	HDC hdcMem = CreateCompatibleDC(hdcScreen);
	if (!hdcMem) {ReleaseDC(NULL, hdcScreen);return 1;}

	BITMAPINFO bmi = {0};
	bmi.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
	bmi.bmiHeader.biWidth = width;
	bmi.bmiHeader.biHeight = -height; 	// Negative height creates a top-down DIB (row 0 is at the top of the image)
	bmi.bmiHeader.biPlanes = 1;
	bmi.bmiHeader.biBitCount = 32; 
	bmi.bmiHeader.biCompression = BI_RGB;
	void *pPixels = NULL;
	HBITMAP hBitmap = CreateDIBSection(hdcMem, &bmi, DIB_RGB_COLORS, &pPixels, NULL, 0);
	if (!hBitmap || !pPixels) {
		DeleteDC(hdcMem);
		ReleaseDC(NULL, hdcScreen);
		return 1;
	}
	HGDIOBJ hOldBitmap = SelectObject(hdcMem, hBitmap);
	BitBlt(hdcMem, 0, 0, width, height, hdcScreen, 0, 0, SRCCOPY);

// write bmp file
	writeBMP(bmp_dest,pPixels,width,height);
	std::cout << "snapshot saved bmp file to " << bmp_dest << ": [" << width << "," << height << "]" <<  std::endl;
// write png file
	bool ok=writePNG(dest,pPixels,width,height);
	if(ok){
		std::cout << "snapshot saved bmp file to " << dest << ": [" << width << "," << height << "]" <<  std::endl;
	}else{
		std::cout << "writePNG failed save to " << dest << ": [" << width << "," << height << "]" <<  std::endl;
	}

// dump base 64 in stdout
//	std::string base64=encodeBase64((uint8_t*)pPixels,width*height*4);
//	std::cout << base64 << std::endl;

	SelectObject(hdcMem, hOldBitmap);
	DeleteObject(hBitmap);
	DeleteDC(hdcMem);
	ReleaseDC(NULL, hdcScreen);

	return 0;
}
