#!/bin/sh
for sizes in 16 19 32 48 64; do
    convert -background transparent icon.svg -resize ${sizes}x${sizes} ../ext/webextension/icons/icon${sizes}.png
done

sizes=32
for files in "exit" "wrench" "delete" "gear" "burger" "copy"; do
    convert -background transparent ${files}.svg -resize ${sizes}x${sizes} ../ext/webextension/icons/${files}.png
done
