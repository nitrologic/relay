@echo off
for /f %%a in ('powershell -c "Get-Date -UFormat %%s"') do set folder=relay\snapshot-%%a
echo backup to snapshot  %folder%
mkdir %folder% 2>nul
rem xcopy * "%folder%" /E /I /Y
copy * %folder%