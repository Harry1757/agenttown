// Package the approved artwork using Electron's existing image runtime.
const { app, nativeImage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
try {
  const source = nativeImage.createFromPath(path.join(root, 'design/icon-source.png'));
  if (source.isEmpty()) throw new Error('Icon artwork could not be loaded');
  const sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
  const directory = path.join(root, 'assets/icon-src');
  fs.mkdirSync(directory, { recursive: true });
  const images = sizes.map(size => {
    const png = source.resize({ width: size, height: size, quality: 'best' }).toPNG();
    fs.writeFileSync(path.join(directory, `claudetown-${size}.png`), png);
    if (size === 256) fs.writeFileSync(path.join(root, 'assets/claudetown.png'), png);
    if (size === 1024) fs.writeFileSync(path.join(root, 'assets/icon.png'), png);
    return { size, png };
  }).filter(image => image.size <= 256);
  // Windows ICO entries contain the same PNG images, without another conversion.
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, png }, index) => {
    const entry = 6 + index * 16;
    header[entry] = header[entry + 1] = size === 256 ? 0 : size;
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  fs.writeFileSync(path.join(root, 'assets/claudetown.ico'), Buffer.concat([header, ...images.map(image => image.png)]));
  console.log('Generated PNG icons (16–1024px) and Windows ICO.');
  app.exit(0);
} catch (error) {
  console.error(error);
  app.exit(1);
}
