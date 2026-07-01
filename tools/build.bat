rem set error

rem copy ..\..\entheogen\vidbit\bin\vidbot2.elf .

mkdir bin
pushd bin
cmake -G Ninja ..
ninja 
popd

if %errorlevel% neq 0 (
    echo cmake ninja failure errorlevel:%errorlevel%
    exit /b %errorlevel%
)

bin\snapshot
