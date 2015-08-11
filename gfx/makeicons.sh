#!/bin/sh
for sizes in 16 32 64; do 
    convert -background transparent icon.svg -resize ${sizes}x${sizes} ../ext/data/icon${sizes}.png
done

sizes=32
for files in "exit" "wrench" "delete" "gear"; do
    convert -background transparent ${files}.svg -resize ${sizes}x${sizes} ../ext/data/${files}.png
done
