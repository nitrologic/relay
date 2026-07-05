echo off

mkdir bin
pushd bin
cmake -G Ninja ..
ninja -k 1
popd

if %errorlevel% neq 0 (
    echo cmake ninja failure errorlevel:%errorlevel%
    exit /b %errorlevel%
)

bin\snapshot.exe

