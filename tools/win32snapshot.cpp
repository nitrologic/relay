// win32snapshot.cpp

// SetICMMode(hdcScreen, ICM_OFF);

#include <windows.h>
#include <stdio.h>
#include <iostream>


#include "base64.h"

extern "C" bool initFreetype(const char *filepath,int size);
extern "C" bool writeJPG(const char* filename, const void* pPixels, int width, int height, int quality);
extern "C" bool writePNG(const char* filename, const void* pPixels, int width, int height, unsigned char *buffer);
extern "C" bool writeBMP(const char* filename, const void* pPixels, int width, int height);

const char* bmp_dest = "desktop.bmp";
const char* jpg_dest = "desktop.jpg";

unsigned char lineBuffer[16384];

bool writeImageFile(const char *png_dest,void *pixels,int width,int height){
	// write bmp file
	writeBMP(bmp_dest,pixels,width,height);
	std::cout << "snapshot saved bmp " << bmp_dest << ": [" << width << "," << height << "]" <<  std::endl;
	// write jpg file
	bool ok1=writeJPG(jpg_dest,pixels,width,height,72);
	if(ok1){
		std::cout << "snapshot saved jpg " << jpg_dest << ": [" << width << "," << height << "]" <<  std::endl;
	}else{
		std::cout << "snapshot failed to save jpg " << jpg_dest << ": [" << width << "," << height << "]" <<  std::endl;
	}
	// write png file
	bool ok=writePNG(png_dest,pixels,width,height,lineBuffer);
	if(ok){
		std::cout << "snapshot saved bmp file to " << png_dest << ": [" << width << "," << height << "]" <<  std::endl;
	}else{
		std::cout << "writePNG failed save to " << png_dest << ": [" << width << "," << height << "]" <<  std::endl;
	}
// dump base 64 in stdout
//	std::string base64=encodeBase64((uint8_t*)pPixels,width*height*4);
//	std::cout << base64 << std::endl;
	return true;
}

bool writeImage(HDC hdcMem, HDC hdcSrc, const char *dest,int sx,int sy,int width,int height){
	BITMAPINFO bmi = {0};
	bmi.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
	bmi.bmiHeader.biWidth = width;
	bmi.bmiHeader.biHeight = -height; 	// Negative height creates a top-down DIB (row 0 is at the top of the image)
	bmi.bmiHeader.biPlanes = 1;
	bmi.bmiHeader.biBitCount = 32; 
	bmi.bmiHeader.biCompression = BI_RGB;
	void *pPixels = NULL;
	HBITMAP hBitmap = CreateDIBSection(hdcMem, &bmi, DIB_RGB_COLORS, &pPixels, NULL, 0);
	if (!hBitmap || !pPixels) return false;
	HGDIOBJ hOldBitmap = SelectObject(hdcMem, hBitmap);
	BitBlt(hdcMem, 0, 0, width, height, hdcSrc, sx, sy, SRCCOPY);
	bool ok=writeImageFile(dest,pPixels,width,height);
	SelectObject(hdcMem, hOldBitmap);
	DeleteObject(hBitmap);
	return ok;
}

int main(int argc, char* argv[]) {
	bool ok=initFreetype("verdanab.ttf",72);
	std::cout << "initFreetype " << (ok?"OK":"FAIL") << std::endl;
	SetProcessDPIAware();
	bool desktop = (argc > 2) && (strcmp(argv[2],"--desktop")==0);
	const char* dest = (argc > 1) ? argv[1] : "desktop.png";
	HWND hwnd = GetForegroundWindow();
	if(!desktop && hwnd){
		RECT rc;
		GetWindowRect(hwnd, &rc);
		int width = rc.right - rc.left;
		int height = rc.bottom - rc.top;
		HDC hdcScreen = GetDC(NULL);
		HDC hdcMem = CreateCompatibleDC(hdcScreen);
		bool ok = writeImage(hdcMem, hdcScreen, dest, rc.left, rc.top, width, height);
		ReleaseDC(NULL, hdcScreen);
		DeleteDC(hdcMem);		
	}else{
		int width = GetSystemMetrics(SM_CXSCREEN);
		int height = GetSystemMetrics(SM_CYSCREEN);
		HDC hdcScreen = GetDC(NULL); 
		if (!hdcScreen) return 1;
		HDC hdcMem = CreateCompatibleDC(hdcScreen);
		if (!hdcMem) {ReleaseDC(NULL, hdcScreen);return 1;}
		bool ok=writeImage(hdcMem,hdcScreen,dest,0,0,width,height);
		DeleteDC(hdcMem);
		ReleaseDC(NULL, hdcScreen);
		if(!ok) {
			std::cout << "writeImage failure" << std::endl;
			return 1;
		}
	}

	return 0;
}
