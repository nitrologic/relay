cmake_minimum_required(VERSION 3.25)

add_definitions( -DNO_PLATFORM )
add_definitions( -DZLIB_CONST )
add_definitions( -DFT2_BUILD_LIBRARY  )
add_definitions( -DAGG2D_USE_FREETYPE )

add_definitions( -DPNG_SEQUENTIAL_READ_SUPPORTED )

if(UNIX AND NOT APPLE)
		set(LINUX TRUE)
endif()

project(snapshot)

include_directories(${CMAKE_SOURCE_DIR}/zlib)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(freetype_src
  freetype/src/autofit/autofit.c
# freetype/src/base/ftapi.c
  freetype/src/base/ftbase.c
  freetype/src/base/ftinit.c
  freetype/src/base/ftmm.c
  freetype/src/base/ftsystem.c
  freetype/src/base/ftbitmap.c
  freetype/src/truetype/truetype.c
  freetype/src/sfnt/sfnt.c
  freetype/src/gzip/ftgzip.c
)

set(freetype_h
  freetype/include/ft2build.h
  freetype/include/freetype.h
  freetype/include/ftadvanc.h
  freetype/include/ftautoh.h
  freetype/include/ftbbox.h
  freetype/include/ftbdf.h
  freetype/include/ftbitmap.h
  freetype/include/ftbzip2.h
  freetype/include/ftcache.h
  freetype/include/ftchapters.h
  freetype/include/ftcid.h
  freetype/include/fterrdef.h
  freetype/include/fterrors.h
  freetype/include/ftgasp.h
  freetype/include/ftglyph.h
  freetype/include/ftgxval.h
  freetype/include/ftgzip.h
  freetype/include/ftimage.h
  freetype/include/ftincrem.h
  freetype/include/ftlcdfil.h
  freetype/include/ftlist.h
  freetype/include/ftlzw.h
  freetype/include/ftmac.h
  freetype/include/ftmm.h
  freetype/include/ftmodapi.h
  freetype/include/ftmoderr.h
  freetype/include/ftotval.h
  freetype/include/ftoutln.h
  freetype/include/ftpfr.h
  freetype/include/ftrender.h
  freetype/include/ftsizes.h
  freetype/include/ftsnames.h
  freetype/include/ftstroke.h
  freetype/include/ftsynth.h
  freetype/include/ftsystem.h
  freetype/include/fttrigon.h
  freetype/include/fttypes.h
  freetype/include/ftwinfnt.h
  freetype/include/ftxf86.h
  freetype/include/t1tables.h
  freetype/include/ttnameid.h
  freetype/include/tttables.h
  freetype/include/tttags.h
  freetype/include/ttunpat.h
  freetype/include/config/ftconfig.h
  freetype/include/config/ftheader.h
  freetype/include/config/ftmodule.h
  freetype/include/config/ftoption.h
  freetype/include/config/ftstdlib.h
)

set(jpeg_src
  jpeg/jaricom.c
  jpeg/jcapimin.c
  jpeg/jcapistd.c
  jpeg/jcarith.c
  jpeg/jccoefct.c
  jpeg/jccolor.c
  jpeg/jcdctmgr.c
  jpeg/jchuff.c
  jpeg/jcinit.c
  jpeg/jcmainct.c
  jpeg/jcmarker.c
  jpeg/jcmaster.c
  jpeg/jcomapi.c
  jpeg/jcparam.c
  jpeg/jcprepct.c
  jpeg/jcsample.c
  jpeg/jctrans.c
  jpeg/jdapimin.c
  jpeg/jdapistd.c
  jpeg/jdarith.c
  jpeg/jdatadst.c
  jpeg/jdatasrc.c
  jpeg/jdcoefct.c
  jpeg/jdcolor.c
  jpeg/jddctmgr.c
  jpeg/jdhuff.c
  jpeg/jdinput.c
  jpeg/jdmainct.c
  jpeg/jdmarker.c
  jpeg/jdmaster.c
  jpeg/jdmerge.c
  jpeg/jdpostct.c
  jpeg/jdsample.c
  jpeg/jdtrans.c
  jpeg/jerror.c
  jpeg/jfdctflt.c
  jpeg/jfdctfst.c
  jpeg/jfdctint.c
  jpeg/jidctflt.c
  jpeg/jidctfst.c
  jpeg/jidctint.c
  jpeg/jmemansi.c
  jpeg/jmemmgr.c
#  jpeg/jmemname.c
#  jpeg/jmemnobs.c
#  jpeg/jpegtran.c
  jpeg/jquant1.c
  jpeg/jquant2.c
  jpeg/jutils.c
)

set(zlib_src
  zlib/adler32.c
  zlib/compress.c
  zlib/crc32.c
  zlib/crc32.h
  zlib/deflate.c
  zlib/deflate.h
  zlib/infback.c
  zlib/inffast.c
  zlib/inffast.h
  zlib/inffixed.h
  zlib/inflate.c
  zlib/inflate.h
  zlib/inftrees.c
  zlib/inftrees.h
  zlib/trees.c
  zlib/trees.h
  zlib/uncompr.c
  zlib/zconf.h
  zlib/zlib.h
  zlib/zutil.c
  zlib/zutil.h
)

set(png_src
	libpng/png.c
	libpng/pngerror.c
	libpng/pngget.c
	libpng/pngmem.c
	libpng/pngpread.c
	libpng/pngread.c
	libpng/pngrio.c
	libpng/pngrtran.c
	libpng/pngrutil.c
	libpng/pngset.c
#  libpng/pngtest.c
	libpng/pngtrans.c
	libpng/pngwio.c
	libpng/pngwrite.c
	libpng/pngwtran.c
	libpng/pngwutil.c
)

if(APPLE)
add_executable(snapshot
  ${freetype_src}
  ${jpeg_src}
	${zlib_src}
  ${png_src}
  agglite/agg.cpp
#	win32writebmp.cpp
#	win32snapshot.cpp
  writepng.cpp
  writejpg.cpp
  freetype.cpp
	macossnapshot.cpp
)

target_include_directories(snapshot PRIVATE . 
  libpng 
  zlib 
  jpeg 
  freetype/include 
  freetype/include/freetype
  agg/include
  agg/font_freetype
)

endif()


if(WIN32)

add_definitions( -D_WIN32_WINNT=0x0600)
add_definitions( -D_UNICODE )

add_executable(snapshot
  ${freetype_src}
  ${jpeg_src}
	${zlib_src}
  ${png_src}
  agglite/agg.cpp
	win32writebmp.cpp
	win32snapshot.cpp
  writepng.cpp
  writejpg.cpp
  freetype.cpp
  intpixels.cpp
)
target_compile_definitions(snapshot PRIVATE UNICODE _UNICODE PNG_STATIC)

target_include_directories(snapshot PRIVATE . 
  libpng 
  zlib 
  jpeg 
  freetype/include 
  freetype/include/freetype
  agg/include
  agg/font_freetype
)

target_link_libraries(snapshot PRIVATE crypt32 setupapi ole32)

endif()
