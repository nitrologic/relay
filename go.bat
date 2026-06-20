set "cd=%CD%"
pushd C:\nitrologic\relay\
deno task relay "%cd%" %*
popd
