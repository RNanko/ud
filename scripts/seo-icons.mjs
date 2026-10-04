// Re-render the existing local SVG brand mark; no new artwork or client dependency.
import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
const svg=await readFile('public/manforth/mark.svg');
const sizes=[16,32,48];
const images=await Promise.all(sizes.map(size=>sharp(svg).resize(size,size).png().toBuffer()));
const directory=Buffer.alloc(6+16*sizes.length);directory.writeUInt16LE(1,2);directory.writeUInt16LE(sizes.length,4);
let offset=directory.length;
images.forEach((bytes,i)=>{const n=6+i*16;directory[n]=sizes[i];directory[n+1]=sizes[i];directory.writeUInt16LE(1,n+4);directory.writeUInt16LE(32,n+6);directory.writeUInt32LE(bytes.length,n+8);directory.writeUInt32LE(offset,n+12);offset+=bytes.length;});
await writeFile('app/favicon.ico',Buffer.concat([directory,...images]));
const apple=await sharp(svg).resize(180,180).png().toBuffer();await writeFile('public/manforth/apple-touch-icon.png',apple);
console.log(JSON.stringify({faviconBytes:offset,appleBytes:apple.length}));
