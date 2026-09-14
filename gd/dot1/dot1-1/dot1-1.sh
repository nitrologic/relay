#!/bin/sh
printf '\033c\033]0;%s\a' dot1
base_path="$(dirname "$(realpath "$0")")"
"$base_path/dot1-1" "$@"
