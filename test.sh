#!/bin/sh
flatpak run org.godotengine.Godot --path "gd/dot1" "res://control.tscn" &
sleep 3
deno run client
