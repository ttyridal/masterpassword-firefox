#!/bin/sh
for sizes in 16 32 64; do 
    convert -background transparent icon.svg -resize ${sizes}x${sizes} icon${sizes}.png
done
