cmake_minimum_required(VERSION 3.25)

if(UNIX AND NOT APPLE)
    set(LINUX TRUE)
endif()

project(snapshot)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

if(WIN32)

add_executable(snapshot
    win32writebmp.cpp
	win32snapshot.cpp
)
target_compile_definitions(snapshot PRIVATE UNICODE _UNICODE)
target_include_directories(snapshot PRIVATE .)
target_link_libraries(snapshot PRIVATE setupapi ole32)

endif()
