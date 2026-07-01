cmake_minimum_required(VERSION 3.25)

add_definitions( -DNO_PLATFORM )
add_definitions( -DZLIB_CONST )
add_definitions( -DZ_SOLO )
add_definitions( -DFT2_BUILD_LIBRARY  )

if(UNIX AND NOT APPLE)
		set(LINUX TRUE)
endif()

project(snapshot)

include_directories(${CMAKE_SOURCE_DIR}/zlib)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

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

if(WIN32)

add_definitions( -D_WIN32_WINNT=0x0500)
add_definitions( -D_UNICODE )

add_executable(snapshot
	${zlib_src}
# ${png_src}
	win32writebmp.cpp
	win32snapshot.cpp
)
target_compile_definitions(snapshot PRIVATE UNICODE _UNICODE PNG_STATIC PNG_LINKAGE_API=int PNG_EXPORTA=)
target_include_directories(snapshot PRIVATE .)
target_link_libraries(snapshot PRIVATE crypt32 setupapi ole32)

endif()
