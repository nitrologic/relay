#!/bin/bash
RELAYCD="$PWD"
pushd /home/skid/nitrologic/relay
deno task relay $RELAYCD "$@"
popd
