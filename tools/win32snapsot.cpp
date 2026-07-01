// win32snapshot.cpp

#include <windows.h>
#include <stdio.h>

const char *dest = "desktop.bmp";

extern "C" bool writeBMP(const char* filename, const void* pPixels, int width, int height);

int main() {
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

	writeBMP(dest,pPixels,width,height);

	SelectObject(hdcMem, hOldBitmap);
	DeleteObject(hBitmap);
	DeleteDC(hdcMem);
	ReleaseDC(NULL, hdcScreen);

	return 0;
}
