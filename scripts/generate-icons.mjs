import sharp from "sharp";
import {readFileSync} from "node:fs";
const source=readFileSync("public/icons/app-icon.svg");
for(const [size,path] of [[192,"public/icons/icon-192.png"],[512,"public/icons/icon-512.png"],[512,"public/icons/icon-maskable-512.png"],[180,"public/apple-touch-icon.png"]])await sharp(source).resize(size,size).png().toFile(path);
console.log("Generated 192px, 512px, maskable and Apple app icons.");
