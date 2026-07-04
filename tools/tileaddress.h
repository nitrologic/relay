#pragma once

#define _USE_MATH_DEFINES
#include <math.h>

#include <filesystem>
#include <string>
//#define _USE_MATH_DEFINES
//#include <cmath>

namespace fs = std::filesystem;
typedef fs::path Path;

const double ArcTanSinhPi = 85.051128779806604;

static int long2tilex(double lon, int z) {
	return (int)(floor((lon + 180.0) / 360.0 * pow(2.0, z)));
}

static int lat2tiley(double lat, int z) {
	if (lat < -ArcTanSinhPi) lat = -ArcTanSinhPi;
	if (lat > ArcTanSinhPi) lat = ArcTanSinhPi;
	return (int)(floor((1.0 - log(tan(lat * M_PI / 180.0) + 1.0 / cos(lat * M_PI / 180.0)) / M_PI) / 2.0 * pow(2.0, z)));
}

static double tilex2long(int x, int z) {
	return 360.0 * x / pow(2.0, z) - 180;
}

static double tiley2lat(int y, int z) {
	double n = M_PI - 2.0 * M_PI * y / pow(2.0, z);
	return 180.0 / M_PI * atan(0.5 * (exp(n) - exp(-n)));
}


static int tms_lon2x(double lon, int z) {
	return (int)(floor((lon + 180.0) / 180.0 * pow(2.0, z)));
}

static int tms_lat2y(double lat, int z) {
	return (int)(floor((90 + lat) / 180.0 * pow(2.0, z)));
}


static double tms_x2lon(int x, int z) {
	return x / pow(2.0, z) * 180.0 - 180;
}

static double tms_y2lat(int y, int z) {
	return y / pow(2.0, z) * 180.0 - 90;
}

//  TileAddressType::Nitro , 64 << (3 * zoom)

class TileAddress {

public:
	enum TileAddressType { Slippy, TMS, Nitro };

	TileAddressType type;
	int zoom;
	int x;
	int y;
	// geo
	double lon;
	double lat;
	double lon2;
	double lat2;

	Path base;
	Path path;
	const char* license;

	bool isBelow(double top) {
		return lat < top&& lat2 < top;
	}

	TileAddress() {
	}

	TileAddress(const TileAddress& other) {
		type = other.type;
		zoom = other.zoom;
		x = other.x;
		y = other.y;
		lon = other.lon;
		lat = other.lat;
		lon2 = other.lon2;
		lat2 = other.lat2;
		base = other.base;
		path = other.path;
		license = other.license;
	}

	TileAddress(int tilex, int tiley, int tilezoom, Path root, TileAddressType addressType, const char* filelicense = NULL) {
		type = addressType;
		zoom = tilezoom;
		x = tilex;
		y = tiley;
		base = root;
		path = base / std::to_string(zoom) / std::to_string(x) / (std::to_string(y));
		license = filelicense;
		switch (type) {
		case Slippy:
			lon = tilex2long(x, zoom);
			lat = tiley2lat(y, zoom);
			lon2 = tilex2long(x + 1, zoom);
			lat2 = tiley2lat(y + 1, zoom);
			break;
		case TMS:
			lon = tms_x2lon(x, zoom);
			lat = tms_y2lat(y, zoom);
			lon2 = tms_x2lon(x + 1, zoom);
			lat2 = tms_y2lat(y + 1, zoom);
			break;
		case Nitro:
			int n = 64 << (3 * zoom);
			lon = tilex * n;
			lat = tiley * n;
			lon2 = lon + n;
			lat2 = lat + n;
			break;
		}
	}

	// divide version

	TileAddress(const TileAddress& a, int qx, int qy) {
		zoom = a.zoom + 1;
		x = a.x * 2 + qx;
		y = a.y * 2 + qy;
		double hlat = (a.lat2 - a.lat) / 2;
		double hlon = (a.lon2 - a.lon) / 2;
		lon = a.lon + qx * hlon;
		lat = a.lat + qy * hlat;
		lon2 = lon + hlon;
		lat2 = lat + hlat;
		base = a.base;
		path = base / std::to_string(zoom) / std::to_string(x) / (std::to_string(y));
		license = a.license;
	}

	int pixelX(int width, double tileLon) {
		return (int)(width * (tileLon - lon) / (lon2 - lon));
	}

	int pixelY(int height, double tileLat) {
		return (int)(height * (tileLat - lat) / (lat2 - lat));
	}

	double linearLat(double dy) const {
		return lat + dy * (lat2 - lat);
	}

	double linearLon(double dx) const {
		return lon + dx * (lon2 - lon);
	}
};

bool operator < (const TileAddress& l, const TileAddress& r);
