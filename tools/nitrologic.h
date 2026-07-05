#pragma once 

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

#define _USE_MATH_DEFINES

#include <mutex>
#include <string>
#include <vector>
#include <map>
#include <cmath>
#include <iostream>
#include <algorithm>
#include <filesystem>

namespace fs = std::filesystem;
typedef fs::path Path;

typedef size_t I;	 //index is unsigned integral

#define EOL std::endl

inline int ifloor(double d) {
	return (int)floor(d);
}

inline double dlerp(double a, double b, double l) {
	return b * l + a * (1 - l);
}

typedef uint8_t Byte;
typedef std::vector<Byte> ByteBuffer;


typedef double P; // pixel plot coordinates
typedef double L; // distance between coordinates
typedef double O; // theta in radians
typedef std::string S; //utf8 encoded string

typedef std::map<S, S> Values;

typedef unsigned int u32;

typedef std::lock_guard<std::mutex> Lock;

static const S Q = "\"";

inline int lerpColor(u32 c0, u32 c1, double l) {
	if (c0 < 0x03000000) return c1;
	if (c1 < 0x03000000) return c0;

	int r0 = c0 & 255;
	int g0 = (c0 >> 8) & 255;
	int b0 = (c0 >> 16) & 255;

	int r1 = c1 & 255;
	int g1 = (c1 >> 8) & 255;
	int b1 = (c1 >> 16) & 255;

	int r = r1 * l + r0 * (1 - l);
	int g = g1 * l + g0 * (1 - l);
	int b = b1 * l + b0 * (1 - l);

	return 0xff000000 | r | (g << 8) | (b << 16);
}

inline int bigendian(uint32_t u32) {
	return (u32 >> 24) | ((u32 >> 8) & 0xff00) | ((u32 << 8) & 0xff0000) | (u32 << 24);
}

struct XY {
	double x;
	double y;
};

struct XYZ {
	double x, y, z;

	void normalize() {
		double d = sqrt(x * x + y * y + z * z);
		double q = 1.0 / d;
		x *= q;
		y *= q;
		z *= q;
	}
};

inline XYZ CalculateNormal(XYZ& a, XYZ& b, XYZ& c) {
	XYZ u{ b.x - a.x, b.y - a.y, b.z - a.z };
	XYZ v{ c.x - a.x, c.y - a.y, c.z - a.z };

	u.normalize();
	v.normalize();

	XYZ n{
		u.y * v.z - u.z * v.y,
		u.z * v.x - u.x * v.z,
		u.x * v.y - u.y * v.x };

	n.normalize();

	return n;
}

inline double Distance(XYZ& a, XYZ& b) {
	double x = b.x - a.x;
	double y = b.y - a.y;
	double z = b.z - a.z;
	return sqrt(x * x + y * y + z * z);
}

static S code(std::map<std::string, std::string> values, S name, S key) {
	S value = values[name];
	return (value == "99" || value == "*********") ? key : "";
}

// ifdef linux simon come here

#include <sys/stat.h>

inline bool file_exists(const std::string& name) {
	struct stat buffer;
	return (stat(name.c_str(), &buffer) == 0);
}
