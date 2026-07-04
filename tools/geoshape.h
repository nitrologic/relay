#pragma once

#include "nitrologic.h"
#include "tileaddress.h"
//#include "coverage.h"
#include "agglite/agg.h"

#include <set>
#include <deque>

const int octant[] = { 0,1,3,2, 5,0,4,0, 7,8,0,0, 6,0,0,0, };
short Atan16(double dy, double dx);

typedef std::vector<XY> Line;
typedef std::deque<Line> LineArt;
typedef Line Curve;	// count + 2 - first and last are handles only


static S escapeString(S s) {
	std::replace(s.begin(), s.end(), '\"', '\'');
	for (size_t i = 0; i < s.length(); i++) {
		int ch = (int)s[i];
		if ((ch > 0 && ch < 32)) {
		//if ((ch>0 && ch < 32) || ch==',') {
			std::cout << "replacing chr " << (ch) << " with space" << EOL;
			s[i] = 32;
		}
		if (ch > 127) {
			std::cout << "non ascii in string " << s << EOL;
			return s;
		}
	}
	return s;
}

static S encodeValue(S value) {
	size_t n = value.length();
	if (n) {
		if (value.find(',') < n) {
			if (value.find('\"') < n) {
				S md = value.replace(0, n, '\"', '\'');
				return "\"" + value + "\"";
			}
			return "\"" + value + "\"";
		}
	}
	return value;
}

// relative to metric plane

struct XYZDAB {
	double x;// west east
	double y;// south north
	double z;// altitude
	double distance; //distance from start
	short angle16; // incoming from previous
	short bits16;	//clipping plane bits - top bottom left and right
	//	XYDB() {};
	//	XYDB(const XYDB& a) :x(a.x), y(a.y), d(a.d), b(a.b) {}
};

typedef std::vector<XYZDAB> Outline; // clockwise order closed

#ifdef USE_AGG
namespace agg {

	class canvas {
		Image& image;
		agg::rendering_buffer buffer;
		//		agg::renderer<agg::span_argb32> renderer;
		agg::renderer<agg::span_rgba32> renderer;
		agg::rasterizer ras;

	public:

		canvas(Image& target, int* pixels) :
			image(target),
			buffer((uint8_t*)pixels, image.width, image.height, image.span * 4),
			renderer(buffer)
		{
			ras.gamma(1.3);
			ras.filling_rule(agg::fill_even_odd);
		}

		void clear(int argb) {
			unsigned int a = (argb >> 24) & 0xffu;
			unsigned int r = (argb >> 16) & 0xffu;
			unsigned int g = (argb >> 8) & 0xffu;
			unsigned int b = (argb) & 0xffu;
			renderer.clear(agg::rgba8(r, g, b, a));
		}

		void thickline(double x1, double y1, double x2, double y2, double width) {
			double dx = x2 - x1;
			double dy = y2 - y1;
			double d = sqrt(dx * dx + dy * dy);
			dx = width * (y2 - y1) / d;
			dy = width * (x2 - x1) / d;
			ras.move_to_d(x1 - dx, y1 + dy);
			ras.line_to_d(x2 - dx, y2 + dy);
			ras.line_to_d(x2 + dx, y2 - dy);
			ras.line_to_d(x1 + dx, y1 - dy);
		}

		void ellipse(double x, double y, double rx, double ry) {
			int i;
			ras.move_to_d(x + rx, y);
			for (i = 1; i < 360; i++) {
				double a = double(i) * M_PI / 180.0;
				ras.line_to_d(x + cos(a) * rx, y + sin(a) * ry);
			}
		}

#ifndef NO_CURVES

		static double interpolate(double y0, double y1, double y2, double y3, double mu) {
			double a0, a1, a2, a3, mu2;
			mu2 = mu * mu;
			a0 = y3 - y2 - y0 + y1;
			a1 = y0 - y1 - a0;
			a2 = y2 - y0;
			a3 = y1;
			return a0 * mu * mu2 + a1 * mu2 + a2 * mu + a3;
		}

		XY tangent(XY a, XY b) {
			double dx = a.x - b.x;
			double dy = a.y - b.y;
			double d = sqrt(dx * dx + dy * dy);
			return{ -dy / d, dx / d };
		}

		Outline outline(Curve line, double thick) {
			size_t n = line.size() - 2;
			Outline poly(n * 2);
			size_t nn = n * 2 - 1;
			XY p0, p1, p2, p3;
			p0 = line[0];
			p1 = line[1];
			for (size_t i = 0; i < n; i++) {
				p2 = line[i + 2];
				// add segment p1 p2 with tangents !p0p2 !p1p3
				XY t = tangent(p0, p2);
				poly[i] = { p1.x + thick * t.x, p1.y + thick * t.y,0,0 };
				poly[nn - i] = { p1.x - thick * t.x, p1.y - thick * t.y,0,0 };
				p0 = p1;
				p1 = p2;
			}
			return poly;
		}

		Curve smoothCurve(Curve line, int divisions) {
			size_t n = line.size() - 3;
			size_t count = 0;
			Curve div(n * divisions + 3);
			XY c0 = line[0];
			div[count++] = { c0.x,c0.y };
			for (size_t i = 0; i < n; i++) {
				XY p0 = line[i + 0];
				XY p1 = line[i + 1];
				XY p2 = line[i + 2];
				XY p3 = line[i + 3];
				int extra = (i == (n - 1)) ? 1 : 0;
				for (size_t j = 0; j < divisions + extra; j++) {
					double mu = (double)j / divisions;
					double x = interpolate(p0.x, p1.x, p2.x, p3.x, mu);
					double y = interpolate(p0.y, p1.y, p2.y, p3.y, mu);
					div[count++] = { x,y };
				}
			}
			XY c1 = line[n + 2];
			div[count++] = { c1.x,c1.y };
			return div;
		}

		void polygon(Outline outline) {
			Outline::iterator it = outline.begin();
			ras.move_to_d(it->x, it->y);
			while (++it != outline.end()) {
				ras.line_to_d(it->x, it->y);
			}
		}

#endif

		void render(int argb) {
			int a = (argb >> 24) & 0xff;
			int r = (argb >> 16) & 0xff;
			int g = (argb >> 8) & 0xff;
			int b = (argb >> 0) & 0xff;
			ras.render(renderer, agg::rgba8(r, g, b, a));
			ras.reset();
		}

		void finish() {
			image.unlock();
		}
	};

};
#endif

enum Medium { _POINT, _OUTLINE, _CLOSED };



struct InkStyle {
	unsigned int color;
	double thickness;
	Medium type;
};

enum InkKey {
	LAND,
	COAST,
	ISO,
	BATHY,
	LEY,
	RIVER,
	LAKE,
	SWAMP,
	POND,
	LAGOON,
	SAND,
	ROCK,
	NATIVE,
	EXOTIC,
	TARMAC,
	ROAD,
	ROOF,
	RESIDENCE,
	TRAILS,
	RAIL,
	BRIDGE,
	PARCEL,
	TRANSIT,
	ROAD1,
	POI,
	PYLON,
	POWERLINE,
	TUNNEL,
	AIRPORT,
	RUNWAY,
	RESERVE,
	SKI,
	GOLF,
	SPORT,
	MINE,
	HELIPAD,
	QUARRY,
	LANDFILL,
	CEMETERY,
	FUMAROLE,
	GRAVEL,
	MORAINE,
	MUD,
	SCREE,
	SHINGLE,
	SHOWGROUND,
	RACETRACK,
	RIFLERANGE,
	RIVERBED
};

extern S InkName(int index);

void scheduleShapeWriter(TileAddress address, class Shape* shape);

class Shape {

public:

	typedef unsigned char byte;
	typedef unsigned short word;
	int measure;
	int miny, maxy, minx, maxx;
	int refcount = 1;

	Shape() :measure(1) {
		flushPolygons();
	}

	void retain() {
		refcount++;
	}

	void release() {
		refcount--;
	}

	static std::string trim(std::string s) {
		s.erase(s.find_last_not_of('\0') + 1);
		return s;
	}

	class DataAttributes {
	public:
		struct Header {
			byte fileType;
			byte year;	//+1900
			byte month;
			byte day;
			int recordCount;
			word firstPosition;
			word recordLength;
			byte pad[16];
			byte tableflags;
			byte codepagemark;
			byte skip[2];
		};

		struct Attribute {
			std::string name;
			std::string value;
		};

		struct Descriptor {
			char name[11];
			byte type;
			int displacement;
			byte length;
			byte numdp;
			byte flags;
			int next;
			byte step;
			byte skip[8];
			std::string id;
		};

		Descriptor* readDescriptor(std::ifstream& in) {
			Descriptor* descriptor = new Descriptor();
			in.read((char*)&descriptor->name, 19);
			in.read((char*)&descriptor->next, 13);
			descriptor->id = trim(std::string(descriptor->name, 11));
			return descriptor;
		}

		std::string readValue(std::ifstream& in, char type, size_t n) {
			std::string value;
			std::vector<char> chars(n);
			in.read(chars.data(), n);
			switch (type) {
			case 'C':
				while (n > 0 && chars[n - 1] == ' ') n--;
				value = std::string(chars.data(), n);
				break;
			case 'N':
			{
				int p = 0;
				while (p < chars.size() && chars[p] == ' ') p++;
				value = std::string(chars.data() + p, n - p);
			}
			break;
			case 'F':
				value = std::string(chars.data(), n);
				break;
			case 'L':
				if (chars[0] != 0) value = "true"; else value = "false";
				break;
			case 'D':
				value = std::string(chars.data(), n);
				break;
			case 'T':
				value = std::string(chars.data(), n);
				break;
			default:
				value = "dbftype:" + type;
				break;
			}
			return value;
		}

		const std::vector<std::string> roadSurfaces = { "unmetalled","metalled","sealed" };
		const std::vector<std::string> SurfaceCode = { "D","M","S" };

		const std::vector<std::string> roofSurfaces = { "Unknown","Hospital","School","Supermarket" };
		const std::vector<std::string> RoofCode = { "","H","S","M" };

		const std::vector<std::string> ParcelCode = {
			"","U","T","A","G","I","R","E","D","H","F","B","C","L","S","W",
			"a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z",
			"a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z",
			"a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z",
		};
		const std::vector<S> roadClasses = {
			"unclassified","primary","secondary","tertiary",
			"footway","motorway","cycleway","bridleway",
			"track_grade1","track_grade2","track_grade3","track_grade4","track_grade5",
			"track","path","steps","motorway_link","residential","living_street","trunk","pedestrian","service",
			"trunk_link","primary_link","secondary_link","tertiary_link",
			"unknown",
		};

		const std::vector<S> roofClasses = {
			//			"building"
		};
		const std::vector<std::string> RoofClassCode = {
			"a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z",
		};

		const std::vector<S> transportClasses = {
			"airport","bus_station","bus_stop","ferry_terminal","helipad","railway_halt","railway_station","taxi","tram_stop",
			"airfield","apron",
			// traffic classes
				"parking","traffic_signals","motorway_junction","crossing","turning_circle","mini_roundabout","stop",
				"dam","fuel","lock_gate","marina","parking_bicycle","parking_multistorey","parking_underground",
				"pier","slipway","speed_camera","street_lamp","waterfall","weir","service"
		};
		const std::vector<std::string> TransportClassCode = {
			"a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z",
		};

		const std::vector<std::string> RoadClassCode = {
			"u","p","s","t",
			"f","m","c","b",
			"1","2","3","4","5",
			"A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z",
		};

		const std::vector<S> parcelSurfaces = {
			"Undefined",
			"UNKN",
			"Maori",
			"Customary Entitlement",
			"Restrictive Area",
			"License Permit",
			"License/Permit",
			"Road",
			"Easement",
			"Hydro",
			"Forestry Right",
			"DCDB",
			"Fee Simple Title",
			"Covenant Area",
			"Land Covenant",
			"Strata",
			"Railway",
			"Railway Strata",
			"Lease",
			"Residue Parcel",
			"Lease 20 years or More",
			"Esplanade Strip",
			"Marginal Strip - Movable",
			"Vesting on Deposit for Road",
			"Vesting on Deposit for Local Purpose Reserve",
			"Vesting on Deposit for Recreation Reserve(Territorial Authority)",
			"Vesting on Deposit for Recreation Reserve (Territorial Authority)",
			"Vesting on Deposit in the Crown(Sec 239(1)(c) RM Act)",
			"Marginal Strip - Movable",
			"Accretion",
			"Common Marine and Coastal Area (Sec 237A(1)(b) RM Act)",
			"Definition",
			"Lease Less than 20 years",
			"Licence/Permit",
			"Nohoanga (Campsite) Entitlements",
			"Riverbed",
			"Road Strata",
			"Statutory",
			"Streambed",
			"Vesting on Deposit for Accessway",
			"Vesting on Deposit for Government Purpose Reserve (Crown)",
			"Vesting on Deposit for Historic Reserve (Crown)",
			"Vesting on Deposit for Historic Reserve (Territorial Authority)",
			"Vesting on Deposit for Nature Reserve (Crown)",
			"Vesting on Deposit for Recreation Reserve (Crown)",
			"Vesting on Deposit for Scenic Reserve (Crown)",
			"Vesting on Deposit for Scenic Reserve (Territorial Authority)",
			"Vesting on Deposit for Scientific Reserve (Crown)",
			"Vesting on Deposit for State Highway",
			"Vesting on Deposit in Lieu of a Reserve (Crown)",
			"Vesting on Deposit in Lieu of a Reserve (Territorial Authority)",
			"Vesting on Deposit in the Crown (Sec 237A(1)(b) RM Act)",
			"Vesting on Deposit in the Crown (Sec 239(1)(c) RM Act)",
			"Vesting on Deposit in the Territorial Authority (Sec 237A(1)(a) RM Act)",
			"Future Development Unit",
			"Graphical",
			"Principal Unit",
			"Reclamation Area",
			"Vesting on Deposit for Service Lane (Territorial Authority)",
			"Cross Lease Building",
			"Graphical",
			"Reclamation Area",
			"Vesting on Deposit for Service Lane (Territorial Authority)",
			"Accessory Unit",
			"Common Property",
			"Cross lease Subsidary Building",
			"Future Development Unit",
			"Railway Leased",
			"Right of Use Area",
			"Temporary",
			"Legalisation" };

		DataAttributes(Path path, Path csv, std::vector<S>& records) {
			std::ifstream in;
			in.open(path, std::ios::binary);
			if (!in.is_open()) return;

			std::ofstream out;
			if (!csv.empty()) {
				out.open(csv);
			}

			Header header;
			in.read((char*)&header, sizeof(header));

			int len = header.recordLength;

			std::vector<Descriptor*> descriptors;
			std::map<std::string, Descriptor*> descriptorMap;

			std::map<S, std::vector<size_t>> roadIndex;
			std::map<int, std::string> roadcenterNames;

			std::set<S> surfaces;
			std::set<S> parcels;
			std::set<S> types;

			std::map<std::string, std::set<S>> valueSet;

			int maxLanes = 0;
			int anonCount = 0;
			int zeroLanes = 0;

			while (len > 1) {
				Descriptor* descriptor = readDescriptor(in);
				descriptors.push_back(descriptor);
				descriptorMap[descriptor->id] = descriptor;
				len -= descriptor->length;
				out << descriptor->id << ",";
				std::cout << descriptor->id << ",";
			}
			out << EOL;
			std::cout << EOL;

			char terminator;
			in.read(&terminator, 1);
			std::cout << "reading " << header.recordCount << " records" << EOL;

			size_t overlaps = 0;
			size_t count = 0;
			while (count < header.recordCount) {
				byte deleted;
				in.read((char*)&deleted, 1);
				if (!in) {
					std::cout << "not in" << EOL;
					break;
				}
				std::map<std::string, std::string> values;
				for (Descriptor* descriptor : descriptors) {
					std::string value = readValue(in, descriptor->type, descriptor->length);
					values[descriptor->id] = value;
					out << encodeValue(value) << ",";
				}
				out << EOL;

				std::stringstream ss;

				//id,appellatio,affected_s,parcel_int,topology_t,statutory_,land_distr,titles,survey_are,calc_area,
				//t50_fid,constr_typ,status,use_1,use_2,name_ascii,macronated,name,
				//building_i,name,use,suburb_loc,town_city,territoria,capture_me,capture_so,capture__1,capture__2,capture__3,capture__4,last_modif,
				//t50_fid,name_ascii,macronated,name,status,track_type,rway_use,veh_type,
				//osm_id,code,fclass,name,ref,oneway,maxspeed,layer,bridge,tunnel,

				if (values.count("appellatio")) {  // nz topo
					S parcelid = values["id"];
					S parcelint = values["parcel_int"];
					S appellatio = values["appellatio"];
					S titles = values["titles"];
					S topo = values["topology_t"];

					int parcelSurface = 0;
					auto it = std::find(parcelSurfaces.begin(), parcelSurfaces.end(), parcelint);
					if (it == parcelSurfaces.end()) {
						parcels.insert(parcelint);
					}
					else
					{
						parcelSurface = std::distance(parcelSurfaces.begin(), it);
					}
					ss << parcelid << "," << appellatio << "," << titles << "," << topo << "," << ParcelCode[parcelSurface];
				}
				//fidn,valdco,verdat,inform,ninfom,ntxtds,scamin,txtdsc,sordat,sorind,hypcat,
				else if (values.count("fidn")) {	// depth
					int h = 0;
					if (values.count("valdco")) {
						h = std::stoi(values["valdco"]);
					}
					S dat = values["sordat"];
					ss << h << "," << dat;
				}
				else if (values.count("elevation")) {  // nz topo
					S form = values["nat_form"];
					S designated = values["designated"];
					S definition = values["definition"];
					S desc = form + designated + definition;
#ifdef VERBOSE
					if (desc.length() && desc != "depression" && desc != "supplementary") {
						std::cout << desc << EOL;
					}
#endif
					int h = std::stoi(values["elevation"]);
					ss << h << "," << (form == "depression" ? "D" : "") << (designated == "supplementary" ? "S" : "");
				}
				else if (values.count("building_i")) {
					S roofid = values["building_i"];
					S roofname = values["name"];
					S surface = values["use"];
					auto it = std::find(roofSurfaces.begin(), roofSurfaces.end(), surface);
					if (it == roofSurfaces.end()) {
						std::cout << surface << EOL;
					}
					int roofSurface = std::distance(roofSurfaces.begin(), it);
					ss << roofid << "," << roofname << "," << RoofCode[roofSurface];
				}
				else if (values.count("grp_ascii")) {
					S groupname = values["grp_ascii"];
					S islandname = values["name_ascii"];
					ss << islandname << "," << groupname;
				}
				else if (values.count("track_type")) {
					S trackname = values["name"];
					S type = values["track_type"];
					S use = values["rway_use"];
					S veh = values["veh_type"];
					ss << trackname << "," << type << "," << use << "," << veh;

				}
				else if (values.count("main_trail")) {
					S trailname = values["name"];
					S weblink = values["weblink"];
					S image = values["image_link"];
					S desc = values["descriptio"];
					S auth = values["local_auth"];
					S key = code(values, "bike", "B") + code(values, "walk", "W") + code(values, "horse", "H") + code(values, "off_road_v", "O");
					ss << trailname << "," << key << "," << desc << "," << auth << "," << image << "," << weblink;
				}
				else if (values.count("osm_id"))// nz osm roads
				{
					S osm_id = values["osm_id"];
					S code = values["code"];
					S fclass = values["fclass"];
					S osm_name = values["name"];

					if (values.count("type") == 0) {
						S ftype = values["type"];
						int roofClass = 0;
						auto it = std::find(roofClasses.begin(), roofClasses.end(), ftype);
						if (it == roofClasses.end()) {
							types.insert(ftype);
						}
						else {
							roofClass = std::distance(roofClasses.begin(), it);
						}
						ss << osm_name << "," << osm_id << "," << code << "," << fclass << "," << RoofClassCode[roofClass];
					}
					else if (values.count("ref") == 0) {
						int roadClass = 0;
						auto it = std::find(transportClasses.begin(), transportClasses.end(), fclass);
						if (it == transportClasses.end()) {
							types.insert(fclass);
						}
						else {
							roadClass = std::distance(transportClasses.begin(), it);
						}
						ss << osm_name << "," << osm_id << "," << code << "," << fclass << "," << TransportClassCode[roadClass];
					}
					else {

						S ref = values["ref"];
						S maxspeed = values["maxspeed"];
						S layer = values["layer"];
						S oneway = values["oneway"];
						S bridge = values["bridge"];
						S tunnel = values["tunnel"];

						int roadClass = 0;

						if (oneway != "F" && oneway != "T" && oneway != "B") std::cout << "W" << oneway << std::endl;
						if (bridge != "F" && bridge != "T") std::cout << "B" << bridge << std::endl;
						if (tunnel != "F" && tunnel != "T") std::cout << "T" << bridge << std::endl;

						auto it = std::find(roadClasses.begin(), roadClasses.end(), fclass);
						if (it == roadClasses.end()) {
							std::cout << fclass << std::endl;
						}
						else {
							roadClass = std::distance(roadClasses.begin(), it);
						}

						ss << osm_name << "," << ref << ",1," << osm_id << "," << maxspeed << "," << RoadClassCode[roadClass] << (oneway == "T" ? "W" : "") << (bridge == "T" ? "B" : "") << (tunnel == "T" ? "T" : "");
					}
				}
				else if (values.count("rna_sufi")) // nz linz roads
				{
					S sufi = values["rna_sufi"];
					S roadname = values["name"];
					S hiway = values["hway_num"];
					S lanes = values["lane_count"];
					S ways = values["way_count"];
					S status = values["status"];
					S surface = values["surface"];

					bool oneWay = (ways == "one way");
					bool underConstruction = (status == "under construction");

					auto it = std::find(roadSurfaces.begin(), roadSurfaces.end(), surface);
					if (it == roadSurfaces.end()) {
						std::cout << surface << EOL;
					}
					int surfaceType = std::distance(roadSurfaces.begin(), it);
					surfaces.insert(surface);

					if (status.length()) std::cout << status << "," << lanes << EOL;
					//					std::cout << lanes << "," << ways << "," << status << EOL;

					int id = std::stoi(sufi);
					int laneCount = std::stoi(lanes);

					maxLanes = (laneCount > maxLanes) ? laneCount : maxLanes;
					if (laneCount < 1) zeroLanes++;

					if (roadname.length()) {
						if (roadcenterNames.count(id) == 0) {
							roadcenterNames[id] = roadname;
						}
						if (roadcenterNames[id] != roadname) {
							size_t pos = roadcenterNames[id].find(roadname);
							if (pos == std::string::npos) {
								roadcenterNames[id] = roadcenterNames[id] + '/' + roadname;
								//								std::cout << name << "=>" << roadNames[id] << EOL;
								overlaps++;
							}
						}
						if (roadIndex.count(roadname) == 0) {
							roadIndex[roadname] = { count };
						}
						else {
							roadIndex[roadname].push_back(count);
						}
					}
					else {
						anonCount++;
					}

					ss << roadname << "," << hiway << "," << lanes << "," << (oneWay ? "W" : "") << (underConstruction ? "U" : "") << SurfaceCode[surfaceType];
					//					std::cout << sufi << "," << name << "," << hiway << "," << lanes << "," << ways << "," << status << "," <<surface << EOL;
				}
				else if (values.count("roadID"))	// RAMM file from NZTA
				{
					S name = values["endName"];
					S startname = values["startName"];
					S id = values["roadID"];
					S rdclass = values["roadClass"];
					S paving = values["pavementTy"]; //Us	// Thin Surfaced Flexible,Bridge,Structural Asphaltic Concrete,Concrete,Unsealed,
					S code = values["roadName"];

//					std::cout << code << std::endl;
/*
					auto added=surfaces.insert(paving);
					if (added.second) {
						std::cout << paving << ",";
					}
*/
					S hiway;
					S surface;
					int lanes = std::stoi(values["lanes"]);
					size_t isbridge = startname.find("BR");
					if (isbridge < startname.length()) {
						surface = "B";
					}
//					ss << startname << "," << name << "," << lanes << "," << surface;	//<< (oneWay ? "W" : "") << (underConstruction ? "U" : "")
//					ss << startname << "," << lanes << "," << surface;
					ss << "SH1,,4,";

					for (auto v : values) {
						valueSet[v.first].insert(v.second);
					}

				}
				else if (values.count("constr_typ")) {	//linz bridge
					S fid = values["t50_fid"];
					S title = values["name"];
					S bridgetype = values["constr_typ"];
					S status = values["status"];
					S use1 = values["use_1"];
					S use2 = values["use_2"];
					if (title.length()) {
						std::cout << title << EOL;
					}
					ss << fid << title << "," << bridgetype << "," << use1 << "|" << use2 << "," << status;
				//					std::cout << ss.str() << EOL;
				}
				else if (values.count("support_ty")) {	// linz pylon
					S name = values["t50_fid"];
					S supp = (values["support_ty"]=="pylon")?"P0":"P1";
					ss << name << "," << supp;
				}
				else if (values.count("use2")) {	// linz tunnel
					S name = values["t50_fid"];
					S title = values["name"];
					S use1 = values["use1"];
					S use2 = values["use2"];
					if (title.length()) {
						std::cout << title << EOL;
					}
					ss << name << "," << title << "," << use1 << "|" << use2;
				}
				else if (values.count("t50_fid")) {
					S fid = values["t50_fid"];
					S title = values["name"];
					if (title.length()) {
						std::cout << title << EOL;
					}
					ss << fid << "," << title;
				}

				S s = ss.str();
//				std::replace(s.begin(), s.end(), '\"', '\'');
				s = escapeString(s);
				records.push_back(s);
				count++;

			}
			for (S parcel : parcels) {
				std::cout << "\"" << parcel << "\"," << EOL;
			}

			for (S type : types) {
				std::cout << type << std::endl;
			}

			for (auto set : valueSet) {
				std::cout << set.first << ":" << "[" << std::endl;
				for (auto val : set.second) {
					std::cout << val << ",";
				}
				std::cout << "]" << std::endl;
			}

			if (out.is_open()) {
				out.close();
			}
			char eof;
			in.read(&eof, 1);
#ifdef VERBOSE
			std::cout << "max lanes:" << maxLanes << EOL;
			std::cout << "zero lanes:" << zeroLanes << EOL;
			std::cout << "anon count:" << anonCount << EOL;
			std::cout << "overlap errors:" << overlaps << EOL;
			std::cout << "records size:" << records.size() << EOL;
#endif
		}
	};

/*

// RAMM stuff

carrWayNo,roadName,roadID,carrwaySta,carrwayEnd,startName,endName,cwayArea,cwaySubAre,pavementTy,pavementUs,roadClass,urbanRural,cwayHierar,
lanes,laneWidth,lengthM,cwayWidth,irrWidth,resWidth,miscArea,busBays,islands,intersecti,ownerType,controlled,roadGroup,loadingPcH,loadingEsa,
trafficADT,trafficA_1,traffManag,NAASRAMin,NAASRAMax,NAASRAAvg,cwayUseCat,legalMotor,seasonalZo,leftLanes,rightLanes,travelDire,GPSEasting,
GPSNorthin,GPSEasti_1,GPSNorth_1,shRampType,roadClassi,loadingHea,dateExtrac,ONRC,roadCorrid,

*/


	static int readInt(std::ifstream& in) {
		uint32_t t;
		in.read((char*)&t, sizeof(int));
		return t;
	}

	static int readBigInt(std::ifstream& in) {
		uint32_t t;
		in.read((char*)&t, sizeof(int));
		return bigendian(t);
	}

	static void swapInt(int& i32) {
		i32 = bigendian(i32);
	}

	struct Header {
		int code;
		int pad[5];
		int length;
		int version;
		int type;
	};

	struct Bounds {
		double minx;
		double miny;
		double maxx;
		double maxy;
		double minz;
		double maxz;
		double minm;
		double maxm;
	};

	struct XYXY {
		double x0;
		double y0;
		double x1;
		double y1;
	};

	struct Geometry {
		typedef std::vector<int> Edges;
		typedef std::map<int, Edges> Coverage;
	};

	struct Polygon : Geometry {

		XYXY ab;
		int nparts;
		int npoints;
		int words;
		int* parts;
		int index;
		//		int elevation;
		bool polyline;
		bool polyclosed;
		S value;
		int ink;

		static XY pointBefore(XY a, XY b) {
			return{ a.x + a.x - b.x, a.y + a.y - b.y };
		}

		void drawCurve(int i0, int i1) {

		}

		// special case point polygon

		Polygon(std::ifstream& in, std::vector<XY>& points, S value, int c, int wordCount, bool hasz, Projection projection)
			: polyline(false), polyclosed(false), value(value), ink(c) {
			if (wordCount != 8) {
				std::cout << "wordcount " << wordCount << std::endl;
			}
			nparts = 0;
			npoints = 0;
			parts = NULL;
			index = -1;
			XY a;
			in.read((char*)&a, sizeof(XY));
			ab.x0 = a.x;
			ab.y0 = a.y;
			ab.x1 = a.x;
			ab.y1 = a.y;
			this->words = wordCount;
		}

		// points and ngon based parts

		Polygon(std::ifstream& in, std::vector<XY>& points, S value, int c, int wordCount, bool line, bool closed, bool hasz, Projection projection)
			: polyline(line), polyclosed(closed), value(value), ink(c) {

			in.read((char*)&ab, sizeof(XYXY));
			if (!in) {
				std::cout << "io error" << EOL;
			}
			nparts = readInt(in);
			npoints = readInt(in);
			words = 20 + 2 * nparts + 8 * npoints;
			parts = new int[nparts + 1];
			for (int i = 0; i < nparts; i++) {
				parts[i] = readInt(in);
			}
			parts[nparts] = npoints;
#ifdef LOG_PARTS
			if (nparts != 1) {
				std::cout << "nparts:" << nparts;
				for (int i = 0; i < nparts; i++) {
					std::cout << " " << std::to_string(parts[i]);
				}
				std::cout << EOL;
			}
#endif
			index = points.size();
			points.resize(index + npoints);

			std::streamsize count = npoints * sizeof(XY);
			in.read((char*)(&points[index]), count);
			if (!in) {
				std::cout << "io error" << EOL;
			}
			switch (projection) {
			case WGS:
				for (size_t i = 0; i < npoints; i++) {
					double n, e;
					double lat = points[index + i].y;
					double lon = points[index + i].x;
					degrees_nztm_geod(lat, lon, &n, &e);
					points[index + i] = { e, n };
				}
				break;

				//	# WGS 84 / Mercator 41
				//	<3752> +proj = merc + lon_0 = 100 + k = 1 + x_0 = 0 + y_0 = 0 + ellps = WGS84 + datum = WGS84 + units = m + no_defs  <>

			case MERC41:
				double n = 0;
				double e = 0;
				degrees_nztm_geod(-41, 100, &n, &e);
				for (size_t i = 0; i < npoints; i++) {
					points[index + i].x += e;
					points[index + i].y += n;
				}
				break;
			}

			if (hasz) {

				double zrange[2];
				int zindex;
				double mrange[2];
				int mindex;
				std::vector<double> heights;
				std::vector<double> mvalues;

				in.read((char*)zrange, sizeof(double) * 2);
				zindex = heights.size();
				heights.resize(zindex + npoints);
				std::streamsize count = npoints * sizeof(double);
				in.read((char*)(&heights[zindex]), count);
				if (!in) {
					std::cout << "io error" << EOL;
				}
				for (int i = 0; i < npoints; i++) {
					//					if (heights[i] != height) {
											//						std::cout << "polygon z does not match altitude" << EOL;
											//						exit(-12);
						//					break;
						//				}
				}
				heights.push_back(heights[zindex]);
				words += 8 + 4 * npoints;

				// optional measures
				if (wordCount > words) {
					in.read((char*)zrange, sizeof(double) * 2);
					mindex = heights.size();
					heights.resize(mindex + npoints);
					in.read((char*)(&heights[mindex]), count);
					if (!in) {
						std::cout << "io error" << EOL;
					}
					heights.push_back(heights[mindex]);
					words += 8 + 4 * npoints;
				}
			}

		}

		~Polygon() {
			delete[]parts;
		}

	};

	std::vector<XY> polyxy;
	std::vector<Polygon*> polypoints;
	std::vector<Polygon*> polyshapes;
	std::vector<Polygon*> polylines;

	typedef std::set<int> Shapes;
	typedef std::map<int, Shapes> Coverage;
	std::map<int, std::map<int, Coverage>> polyMap;
	std::map<int, std::map<int, Coverage>> edgeMap;
	std::map<int, std::map<int, Coverage>> pointMap;

	void bakePolygons(int scale) {
		measure = scale;
		int index = 0;
		for (Polygon* p : polypoints) {
			touchPointRegion(p, index);
			index++;
		}
		index = 0;
		for (Polygon* p : polyshapes) {
			touchPolygonRegion(p, index);
			index++;
		}
		index = 0;
		for (Polygon* p : polylines) {
			touchPolygonEdge(p, index);
			index++;
		}
	}

	void clearPolygons() {
		polyxy.clear();
		polylines.clear();
		polyshapes.clear();
		polypoints.clear();
	}

	void flushPolygons() {
		int m32 = 0x7fffffff;
		miny = m32;
		minx = m32;
		maxy = -m32;
		maxx = -m32;
		pointMap.clear();
		edgeMap.clear();
		polyMap.clear();
	}

	void touchRegion(int x0, int y0, int x1, int y1) {
		minx = std::min(minx, x0);
		miny = std::min(miny, y0);
		maxx = std::max(maxx, x1);
		maxy = std::max(maxy, y1);
	}

	Coverage getPointCover(int tx, int ty) {
		return pointMap[ty][tx];
	}

	Coverage getEdgeCover(int tx, int ty) {
		return edgeMap[ty][tx];
	}

	Coverage getPolyCover(int tx, int ty) {
		return polyMap[ty][tx];
	}

	bool hasPointCover(int tx, int ty) {
		return (pointMap.count(ty)>0 && pointMap[ty].count(tx)>0);
	}

	bool hasEdgeCover(int tx, int ty) {
		return (edgeMap.count(ty) > 0 && edgeMap[ty].count(tx) > 0);
	}

	bool hasPolyCover(int tx, int ty) {
		return (polyMap.count(ty) > 0 && polyMap[ty].count(tx) > 0);
	}


	XY pixel(const TileAddress& address, int w, int h, int point) {
		double px = polyxy[point].x;
		double py = polyxy[point].y;
		P x0 = w * (px - address.lon) / measure;
		P y0 = h * (address.lat2 - py) / measure;
		return{ x0,y0 };
	}

	XY pixel(const TileAddress& address, int w, int h, XY p) {
		P x0 = w * (p.x - address.lon) / measure;
		P y0 = h * (address.lat2 - p.y) / measure;
		return{ x0,y0 };
	}

	std::vector<Curve> overlayLines;
	InkStyle overlayStyle;

	void bakeOverlay(agg::canvas* canvas, int w, int h, const TileAddress& address) {
		if (address.zoom <= 3) return; // TODO: canvas cull and clip
		InkStyle ink = overlayStyle;
		for (Curve curve : overlayLines) {
			size_t n = curve.size();
			for (size_t i = 0; i < n - 3; i++) {
				XY p0 = pixel(address, w, h, curve[i]);
				XY p1 = pixel(address, w, h, curve[i + 1]);
				XY p2 = pixel(address, w, h, curve[i + 2]);
				XY p3 = pixel(address, w, h, curve[i + 3]);
				Curve isoline = canvas->smoothCurve({ p0,p1,p2,p3 }, 16);
				Outline poly = canvas->outline(isoline, ink.thickness);
				canvas->polygon(poly);
			}
			canvas->render(overlayStyle.color);
		}
	}

	void scheduleNitroDrawing2(const char* root, Shape* shape, int zoom, int res, S lidar) {
		WorkingCoverage pipeline(20);
		for (int y = miny; y <= maxy; y++) {
			for (int x = minx; x <= maxx; x++) {
				// skip if no geometry at this tile address 
				Coverage edges = getEdgeCover(x, y);
				Coverage polys = getPolyCover(x, y);
				if (edges.size() == 0 && polys.size() == 0) {
					continue;
				}

				// skip if a lidar tile is not present at this address
				Path base = lidar;
				Path path = base / std::to_string(zoom) / std::to_string(x) / (std::to_string(y) + ".raw");
				if (!fs::exists(path)) {
					continue;
				}

				// schedule a drawing
				TileAddress address(x, y, zoom, root, TileAddress::Nitro);
				pipeline.updateBounds(address);
				scheduleShapeWriter(address, shape);
			}
		}
		pipeline.flushWorkers();
	}

	void scheduleNitroDrawing3(const char* root, Shape* shape, int zoom, int res) {
		WorkingCoverage pipeline(20);
		for (int y = miny; y <= maxy; y++) {
			for (int x = minx; x <= maxx; x++) {
				Coverage points = getPointCover(x, y);
				Coverage edges = getEdgeCover(x, y);
				Coverage polys = getPolyCover(x, y);
				if (points.size() == 0 && edges.size() == 0 && polys.size() == 0) {
					continue;
				}
				TileAddress address(x, y, zoom, root, TileAddress::Nitro);
				pipeline.updateBounds(address);
				scheduleShapeWriter(address, shape);
			}
		}
		pipeline.flushWorkers();
	}

	void scheduleNitroDrawing(const char* root, Shape* shape, int zoom, int res) {
		WorkingCoverage pipeline(20);
		for (int y = miny; y <= maxy; y++) {
			for (int x = minx; x <= maxx; x++) {
				bool points = hasPointCover(x, y);
				bool edges = hasEdgeCover(x, y);
				bool polys = hasPolyCover(x, y);
				if (!points && !edges && !polys) {
					continue;
				}
				TileAddress address(x, y, zoom, root, TileAddress::Nitro);
				pipeline.updateBounds(address);
				scheduleShapeWriter(address, shape);
			}
		}
		pipeline.flushWorkers();
	}

	void clipPolyPoint(Polygon* poly, const TileAddress& address, int resolution, std::vector<Outline>& result) {
		P x0 = poly->ab.x0;
		P y0 = poly->ab.y0;
		P px = resolution * (x0 - address.lon) / measure;
		P py = resolution * (address.lat2 - y0) / measure;
		if (px < 0 || px >= resolution || py < 0 || py >= resolution) {
			return;
		}
		Outline outline;
		outline.push_back({ px, py, 0, 0, 0, 0 });
		result.push_back(outline);
	}

	// generates paths of x,y,d inside resolution
	// todo test inside for tiles with no edge result

	void clipPolyOutline(Polygon* poly, const TileAddress& address, int resolution, std::vector<Outline>& result, bool closed) {
		P bottom = resolution;
		P right = resolution;
		P px;
		P py;
		L distance = 0;
		L plength = 0;
		Outline outline;
		int index = poly->index;
		short pin = 0;
		//		int n = poly->npoints;
		for (int part = 0; part < poly->nparts; part++) {
			int begin = poly->parts[part];
			int n = poly->parts[part + 1] - begin;
			short pbits = -1;
			bool skip = false;
			bool first = true;
			for (int i = (closed ? -1 : 0); i < n + (closed ? 1 : 0); i++) {
				int pointIndex = index + begin + ((i + n) % n);
				XY p = polyxy[pointIndex];
				P x = resolution * (p.x - address.lon) / measure;
				P y = resolution * (address.lat2 - p.y) / measure;

				short in = 0;
				short bits = 0;

				if (y < 0) bits |= 1;
				if (x >= right) bits |= 2;
				if (y >= bottom) bits |= 4;
				if (x < 0) bits |= 8;

				if (i < 0)
				{
					skip = !!bits;
				}
				else
				{
					short in;
					if (first) {
						px = x;
						py = y;
					}

					P dx = px - x;
					P dy = py - y;
					plength = sqrt(dx * dx + dy * dy);
					in = Atan16(dy, dx);

//					if (pbits && bits)	// both points outside
					if (pbits & bits)	// both points outside same plane
					{

						if (outline.size() == 1) {
							std::cout << "1";
						}

						if (outline.size() > 1) {
							result.push_back(outline);
						}
						outline.clear();
						skip = true;
					}
					else
					{
						if (skip)
						{
							outline.push_back({ px, py, 0, distance, pin,pbits });
							skip = false;
						}
						outline.push_back({ x, y, 0, distance + plength, in,bits });
					}

					distance += plength;
				}
				px = x;
				py = y;
				pin = in;
				pbits = bits;
				first = false;
			}

			if (outline.size() == 1) {
				std::cout << "1";
			}


			if (outline.size() > 1) {
				result.push_back(outline);
			}

			begin += n;
		}
	}

	void clipPolyFilled(Polygon* poly, const TileAddress& address, int resolution, std::vector<Outline>& result) {

		P bottom = resolution;
		P right = resolution;

		int index = poly->index;
		int nPoints = poly->npoints;

		for (int part = 0; part < poly->nparts; part++) {
			Outline outline;
			P px;
			P py;
			int begin = poly->parts[part];
			int n = poly->parts[part + 1] - begin;
			int pbits = -1;
			bool skip = false;
			int skipbits = 0;
			int octzero = 0;

			for (int i = -1; i < n + 1; i++) {
			}

			if (outline.size() > 1) {
				result.push_back(outline);
			}

			begin += n;
		}
	}

	// corner poles needed for reentry purposes ? currently up to client to fill the gaps
	/*
	void clipPolyFilled2(Polygon* poly, const TileAddress& address, int resolution, std::vector<Outline>& result) {
		bool closed = true;
		P bottom = resolution;
		P right = resolution;
		int index = poly->index;
		int nPoints = poly->npoints;
		for (int part = 0; part < poly->nparts; part++) {
			Outline outline;
			P px;
			P py;
			int begin = poly->parts[part];
			int n = poly->parts[part + 1] - begin;
			int pbits = -1;
			bool skip = false;
			int skipbits = 0;
			int octzero = 0;
			for (int i = (closed ? -1 : 0); i < n + (closed ? 1 : 0); i++) {
				int pointIndex = index + begin + ((i + n) % n);
				XY p = polyxy[pointIndex];
				P x = resolution * (p.x - address.lon) / measure;
				P y = resolution * (address.lat2 - p.y) / measure;
				int bits = 0;
				if (y < 0) bits |= 1;
				if (x > right) bits |= 2;
				if (y > bottom) bits |= 4;
				if (x < 0) bits |= 8;
				if (i < 0) {
					skip = bits;
					octzero = octant[bits];
				}
				else {
					if (pbits & bits)	// & for both points must share a clipplane  && for one point must be inside rect to not skip
					{
						if (!skip) {
							skip = true;
							skipbits = bits;
						}
					}
					else
					{
						if (skip) {
							if (pbits) {
								if (skipbits & pbits)
								{
									// rentering from a shared clip plane
								}
								else
								{
									if (skipbits) {
										int q0 = octant[skipbits];
										int q1 = octant[pbits];
										if (q0 == 0 || q1 == 0) {
											std::cout << "bad octant from clip bits" << EOL;
										}
										else {
											while (true) {
												switch (q0) {
												case 2:
													outline.push_back({ right,0,0,0 });
													break;
												case 4:
													outline.push_back({ right, bottom,0,0 });
													break;
												case 6:
													outline.push_back({ 0, bottom,0,0 });
													break;
												case 8:
													outline.push_back({ 0, 0,0,0 });
													break;
												}
												if (q0 == q1) break;
												q0++; if (q0 == 9) q0 = 1;
											}
										}
									}
									else {
										if (octzero) {
											//											std::cout << "octzero already set" << EOL;
										}
										if (octzero == 0) {
											octzero = octant[pbits];
										}
									}
								}
							}
							outline.push_back({ px, py,0,0 });
							skip = false;
						}
						outline.push_back({ x, y, 0, 0 });
					}
				}
				px = x;
				py = y;
				pbits = bits;
			}

			if (octzero && pbits) {
				int octp = octant[pbits];
				//				std::cout << "octzero is " << octzero << " octp is " << octp << EOL;
				while (true) {
					switch (octp) {
					case 2:
						outline.push_back({ right,0,0,0 });
						break;
					case 4:
						outline.push_back({ right, bottom,0,0 });
						break;
					case 6:
						outline.push_back({ 0, bottom,0,0 });
						break;
					case 8:
						outline.push_back({ 0, 0,0,0 });
						break;
					}
					if (octp == octzero) break;
					octp++; if (octp == 9) octp = 1;
				}
			}

			if (outline.size() > 1) {
				result.push_back(outline);
			}

			begin += n;
		}


	}
	*/
	void clipPolyFill(Polygon* poly, const TileAddress& address, int resolution, std::vector<Outline>& result) {
		for (int part = 0; part < poly->nparts; part++) {
			Outline outline;
			int v0 = poly->parts[part];
			int v1 = poly->parts[part + 1];
			P px;
			P py;
			L pdist;
			O pdir;
			bool first = true;
			bool skip = false;
			for (int v = v0; v < v1; v++) {
				XY p = polyxy[poly->index + v];
				P x = resolution * (p.x - address.lon) / measure;
				P y = resolution * (address.lat2 - p.y) / measure;
				if (first) {
					px = x;
					py = y;
					pdir = 0;
				}
				P dx = x - px;
				P dy = y - py;
				L dist = sqrt(dx * dx + dy * dy);
				O dir = (dist > 0) ? atan2(dy, dx) : 0;
				// TODO: back up on the ins and outs
				if (x<resolution * 2 && x>-resolution && y<resolution * 2 && y>-resolution) {
					if (skip) {
						outline.push_back({ px, py });
						skip = false;
					}
					//							if (v == v0 || (!((x < 0 && px < 0) || (y < 0 && py < 0) || (x > w && px > w) || (y > h && py > h)))) {
					if (x != px || y != py) {
						outline.push_back({ x, y });
					}
				}
				px = x;
				py = y;
				pdir = dir;
				first = false;
			}

			if (outline.size() > 2) {
				result.push_back(outline);
			}
		}
	}

	// output polys and edges
	// include distance from start of shape for each segment

	// diagram is outlines[] , segments[]

	struct Segment {
		I drawop;
		I index;
		I count;
		S value;
		Segment(I op, I i, I n, S v) :drawop(op), index(i), count(n), value(v) {}
	};

	void bakeDiagram(const TileAddress& address, int resolution, InkStyle* palette) {
		std::vector<Segment> points;
		std::vector<Segment> segments;
		std::vector<Outline> outlines;

		int scale = 64 << (3 * address.zoom);

		int bg = 0;
		int x = address.x;
		int y = address.y;
		int w = resolution;
		int h = resolution;

		Coverage pointCover = getPointCover(x, y);
		Coverage edgeCover = getEdgeCover(x, y);
		Coverage polyCover = getPolyCover(x, y);

		if (pointCover.size() == 0 && edgeCover.size() == 0 && polyCover.size() == 0) {
			return;
		}

		// to do polycover needs to surround entire tiles

		if (polyCover.size()) {
			for (auto cover : polyCover) {	// pair{ink,edges}			
				int polygonInk = cover.first;
				InkStyle ink = palette[polygonInk];
				Shapes polyShapes = cover.second;
				for (int shape : polyShapes) {
					Polygon* poly = polyshapes[shape];
					S value = poly->value;
					if (ink.type == _CLOSED) {
						I begin = outlines.size();
						clipPolyOutline(poly, address, resolution, outlines, true);
						I count = outlines.size() - begin;
						if (count > 0) {
							segments.push_back(Segment(2, begin, count, value));
						}
					}
					if (ink.thickness > 0.0) {
						I begin = outlines.size();
						clipPolyOutline(poly, address, resolution, outlines, true);
						I count = outlines.size() - begin;
						if (count > 0) {
							segments.push_back(Segment(1, begin, count, value));
						}
					}
				}
			}
		}

		if (edgeCover.size()) {
			for (auto cover : edgeCover) {
				int polygonInk = cover.first;
				InkStyle ink = palette[polygonInk];
				Shapes polyShapes = cover.second;
				for (int shape : polyShapes) {
					Polygon* poly = polylines[shape];
					S value = poly->value;
					if (ink.type == _CLOSED) {
						I begin = outlines.size();
						clipPolyOutline(poly, address, resolution, outlines, false);
						I count = outlines.size() - begin;
						if (count > 0) {
							segments.push_back(Segment(2, begin, count, value));
						}
					}
					if (ink.thickness > 0.0) {
						I begin = outlines.size();
						clipPolyOutline(poly, address, resolution, outlines, false);
						I count = outlines.size() - begin;
						if (count > 0) {
							segments.push_back(Segment(1, begin, count, value));
						}
					}
				}
			}
		}

		if (pointCover.size()) {
			for (auto cover : pointCover) {
				int polygonInk = cover.first;
				InkStyle ink = palette[polygonInk];
				Shapes polyShapes = cover.second;
				for (int shape : polyShapes) {
					Polygon* point = polypoints[shape];
					S value = point->value;
					I begin = outlines.size();
					clipPolyPoint(point, address, resolution, outlines);
					I count = outlines.size() - begin;
					if(count>0){
						points.push_back(Segment(1, begin,count, value));
					}
				}
			}
		}




		if (outlines.size() == 0 && segments.size() == 0) {
			return;
		}

		std::stringstream ss;
		ss << "{\"outlines\":[";
		bool first = true;
		for (auto outline : outlines) {
			if (!first) ss << ",";
			ss << "[";
			for (I i = 0; i < outline.size(); i++) {
				if (i > 0) ss << ",";
				ss << "[";
				ss << outline[i].x << "," << outline[i].y << "," << outline[i].z;
				// simon come here and extend fencing
				ss << "," << outline[i].distance << "," << outline[i].angle16 << "," << outline[i].bits16;
				ss << "]";
			}
			ss << "]";
			first = false;
		}
		ss << "],\"points\":[";
		for (I i = 0; i < points.size(); i++) {
			S value = (points[i].value.length()) ? "\"" + points[i].value + "\"" : "";
			if (i > 0) ss << ",";
			ss << "[";
			ss << value << "," << points[i].drawop << "," << points[i].index << "," << points[i].count;
			ss << "]";
		}
		ss << "],\"segments\":[";
		for (I i = 0; i < segments.size(); i++) {
			S value = (segments[i].value.length()) ? "\"" + segments[i].value + "\"" : "";
			if (i > 0) ss << ",";
			ss << "[";
			ss << value << "," << segments[i].drawop << "," << segments[i].index << "," << segments[i].count;
			ss << "]";
		}
		ss << "]}";
		//		std::cout << ss.str() << EOL;


		fs::path path = address.path;
		path.replace_extension(".json.gz");
		std::error_code error;
		bool success = fs::create_directories(path.parent_path(), error);

		gzFile gz = gzopen(path.string().c_str(), "wb");;
		if (gz != 0) {
			S s = ss.str();
			size_t n = s.length();
			gzwrite(gz, s.data(), n);
			gzclose(gz);
		}

		/*
				if (true) {
					S s = ss.str();
					size_t n = s.length();
					uLongf size = n + 32;
					Bytef* buffer = (Bytef*)malloc(size);
					int ok = compress((Bytef*)buffer, &size, (const Bytef*)s.data(), n);
					if (ok == Z_OK) {
						std::ofstream raw;
						raw.open(path, std::ofstream::out | std::ofstream::binary);
						raw.write((const char*)buffer, size);
						raw.close();
						free(buffer);
					}
				}
				else {
					std::ofstream o;
					o.open(path);
					o << ss.str();
					o.close();
				}
		*/
	}

	void touchPointRegion(Polygon* poly, int pointIndex) {
		int x0 = poly->ab.x0;
		int y0 = poly->ab.y0;
		int x1 = poly->ab.x1;
		int y1 = poly->ab.y1;
		int y = ifloor(y0 / measure);
		int x = ifloor(x0 / measure);
		touchRegion(x,y,x,y);
		pointMap[y][x][poly->ink].insert(pointIndex);
	}

	void touchPolygonRegion(Polygon* poly, int polyIndex) {
		int M = 0x7fffffff;
		for (int part = 0; part < poly->nparts; part++) {
			int v0 = poly->parts[part];
			int v1 = poly->parts[part + 1];
			int x0 = M, x1 = -M;
			int y0 = M, y1 = -M;
			for (int i = v0; i < v1; i++) {
				XY p = polyxy[poly->index + i];
				int y = ifloor(p.y / measure);
				int x = ifloor(p.x / measure);
				y0 = std::min(y0, y);
				x0 = std::min(x0, x);
				y1 = std::max(y1, y);
				x1 = std::max(x1, x);
			}
			for (int y = y0; y <= y1; y++) {
				for (int x = x0; x <= x1; x++) {
					polyMap[y][x][poly->ink].insert(polyIndex);
				}
			}
			touchRegion(x0, y0, x1, y1);
		}
	}

	void touchPolygonEdge(Polygon* poly, int edgeIndex) {
		int x1, y1;
		for (int part = 0; part < poly->nparts; part++) {
			int v0 = poly->parts[part];
			int v1 = poly->parts[part + 1];
			for (int i = v0; i < v1; i++) {
				XY p = polyxy[poly->index + i];
				int y0 = ifloor(p.y / measure);
				int x0 = ifloor(p.x / measure);
				if (i > v0) {
					int dy = 1 - 2 * (y1 < y0);
					int dx = 1 - 2 * (x1 < x0);
					for (int y = y0-dy; y != y1 + dy + dy; y += dy) {
						if (y < miny) miny = y;
						if (y > maxy) maxy = y;
						for (int x = x0-dx; x != x1 + dx + dx; x += dx) {
							edgeMap[y][x][poly->ink].insert(edgeIndex);
							if (x < minx) minx = x;
							if (x > maxx) maxx = x;
						}
					}
					touchRegion(x0-dx, y0-dy, x1, y1);
				}
				x1 = x0;
				y1 = y0;
			}
		}
	}

	void readPolyzlines(std::ifstream& in, S value, int words, bool closed) {
		Polygon* polygon = new Polygon(in, polyxy, value, ink, words, true, closed, true, proj);
		polylines.push_back(polygon);
		if (words != polygon->words) {
			std::cout << "readPolyzlines read error" << EOL;
			exit(-12);
		}
	}

	void readPolypoints(std::ifstream& in, S value, int words) {
		Polygon* polygon = new Polygon(in, polyxy, value, ink, words, false, proj);
		polypoints.push_back(polygon);
		if (words != polygon->words) {
			std::cout << "readPolypoints read error" << EOL;
			exit(-13);
		}
		//		polypoints.push_back(x, y);
	}

	void readPolylines(std::ifstream& in, S value, int words) {
		Polygon* polygon = new Polygon(in, polyxy, value, ink, words, true, false, false, proj);
		polylines.push_back(polygon);
		if (words != polygon->words) {
			std::cout << "readPolylines read error" << EOL;
			exit(-13);
		}
	}

	void readPolygons(std::ifstream& in, S value, int words) {
		Polygon* poly = new Polygon(in, polyxy, value, ink, words, false, true, false, proj);
		polyshapes.push_back(poly);
		if (words != poly->words) {
			std::cout << "readPolygons read error" << EOL;
			exit(-14);
		}
	}

	bool readShapeDatabaseFile(S path, Path csv, std::vector<std::string>& values) {
		Path dbf(path);
		dbf.replace_extension(".dbf");
		DataAttributes attributes(dbf, csv, values);
		return true;
	}

	int ink;
	Projection proj;

	void setOverlay(InkStyle& style) {
		overlayStyle = style;
	}

	void leyLines(int lon0, int lat0, int lon1, int lat1, int step, InkKey ley) {
		for (int lon = lon0; lon <= lon1; lon += step) {
			Curve curve;
			for (int lat = lat0 - 1; lat <= lat1 + 1; lat++) {
				double n, e;
				degrees_nztm_geod(lat, lon, &n, &e);
				curve.push_back({ e,n });
			}
			overlayLines.push_back(curve);
		}
		for (int lat = lat0; lat <= lat1; lat += step) {
			Curve curve;
			for (int lon = lon0 - 1; lon <= lon1 + 1; lon++) {
				double n, e;
				degrees_nztm_geod(lat, lon, &n, &e);
				curve.push_back({ e,n });
			}
			overlayLines.push_back(curve);
		}
	}

	void writeShape(const char* destPath, bool binary);

	bool parseShape(S path, Path meta, int color, Projection projection) {
		ink = color;

		std::vector<std::string> values;

		proj = projection;

		readShapeDatabaseFile(path, meta, values);

		std::ifstream in;
		in.open(path, std::ios::binary);
		if (!in) {
			return false;
		}

		Header header;
		Bounds bounds;

		in.read((char*)&header, sizeof(header));
		swapInt(header.code);
		swapInt(header.length);

		in.read((char*)&bounds, sizeof(bounds));
		//		std::cout << "shape header " << header.code << EOL;

		int recordCount = 0;
		int flength = header.length - 50;
		while (flength) {

			if (!in.good()) {
				std::cout << "parseShape file error" << EOL;
				return false;
			}

#ifdef LimitRecords
			if (recordCount > 100000) {
				break;
			}
#endif
			int recordId = readBigInt(in);
			int length = readBigInt(in);
			//			int height = recordCount < elevations.size() ? elevations[recordCount] : 0;
			S value = recordCount < values.size() ? values[recordCount] : "";
			value = InkName(color) + ":" + value;
			flength -= 4;
			flength -= length;
			int type = readInt(in);
			length -= 2;
			recordCount++;
			switch (type) {
			case 0:
				if (length) {
					std::cout << "readShape record type 0 with non zero length" << EOL;
				}
				break;
			case 1:
				readPolypoints(in, value, length);
				break;
			case 3:
				readPolylines(in, value, length);
				break;
			case 5:
				readPolygons(in, value, length);
				break;
			case 13:
				readPolyzlines(in, value, length, true);
				break;
			default:
				std::cout << "shape type " << type << " skipped" << EOL;
				in.seekg(length * 2, std::ios_base::cur);
			}
		}
		//		std::cout << "read complete recordCount:" << recordCount << " elevations.size:" << elevations.size() << EOL;

		return true;
	}

	bool readShape(const char* path, int color, Projection projection) {
		return readShape(path, "", color, projection);
	}

	bool readShape(const char* path, Path csv, int color, Projection projection) {

		ink = color;

		std::vector<std::string> values;

		proj = projection;

		readShapeDatabaseFile(path, csv, values);

		std::ifstream in;
		in.open(path, std::ios::binary);
		if (!in) {
			return false;
		}

		Header header;
		Bounds bounds;

		in.read((char*)&header, sizeof(header));
		swapInt(header.code);
		swapInt(header.length);

		in.read((char*)&bounds, sizeof(bounds));
		//		std::cout << "shape header " << header.code << EOL;

		int recordCount = 0;
		int flength = header.length - 50;
		while (flength) {

			if (!in.good()) {
				std::cout << "readShape file error" << EOL;
				return false;
			}

#ifdef LimitRecords
			if (recordCount > 100000) {
				break;
			}
#endif
			int recordId = readBigInt(in);
			int length = readBigInt(in);
			//			int height = recordCount < elevations.size() ? elevations[recordCount] : 0;
			S value = recordCount < values.size() ? values[recordCount] : "";
			value = InkName(color) + ":" + value;
			flength -= 4;
			flength -= length;
			int type = readInt(in);
			length -= 2;
			recordCount++;
			switch (type) {
			case 0:
				if (length) {
					std::cout << "readShape record type 0 with non zero length" << EOL;
				}
				break;
			case 1:
				readPolypoints(in, value, length);
				break;
			case 3:
				readPolylines(in, value, length);
				break;
			case 5:
				readPolygons(in, value, length);
				break;
			case 13:
				readPolyzlines(in, value, length, true);
				break;
			default:
				std::cout << "shape type " << type << " skipped" << EOL;
				in.seekg(length * 2, std::ios_base::cur);
			}
		}
		//		std::cout << "read complete recordCount:" << recordCount << " elevations.size:" << elevations.size() << EOL;

		return true;
	}
};



struct Shape8 {
	int code;
	char vectors[60];
};

typedef std::map<int, Shape8> ShapeTable;

#define MaxChar 1024

class Font {

	static ShapeTable vectorfont;

public:

	Font() {
		for (auto& shape : vectorfont) {
			int c = shape.first;
		}
	}

	LineArt textToLineArt(std::string text, double size) {
		LineArt result;
		double cx = 0;
		double cy = 0;
		for (size_t i = 0; i < text.size(); i++) {
			int charcode = text[i];
			auto it = vectorfont.find(charcode);
			if (it != vectorfont.end()) {
				char* v = it->second.vectors;
				int i = 0;
				while (i < 60) {
					int n = v[i++];
					while (n) {
						n--;
					}
				}

			}
		}
		return result;
	}
};

void scheduleShapeWriter(TileAddress address, Shape* shape);
