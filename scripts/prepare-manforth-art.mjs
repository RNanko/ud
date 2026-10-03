// Delivery-only resizing/encoding of user-supplied artwork; source PNGs stay untouched.
import sharp from 'sharp';
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
const sourceRoot = process.argv[2];
if (!sourceRoot) throw Error('Pass the directory containing s-r.png, investment.png, todo.png, events.png and gym.png');
const originals = {
 finance:'s-r.png',
 investments:'investment.png',
 todo:'todo.png',
 events:'events.png',
 gym:'gym.png',
};
const out='public/manforth';await mkdir(out,{recursive:true});
const manifest=[];
for(const [id,source] of Object.entries(originals)) {
 const original=join(sourceRoot,source),meta=await sharp(original).metadata(),files=[];
 for(const width of [1100,1672]) {
  const name=`${id}-${width}.webp`,path=join(out,name);
  await sharp(original).resize({width,withoutEnlargement:true}).webp({quality:84,effort:6}).toFile(path);
  const size=await stat(path),info=await sharp(path).metadata();
  files.push({src:`/manforth/${name}`,width:info.width,height:info.height,bytes:size.size});
 }
 const cropWidth=Math.floor(meta.height*4/5),left=Math.min(meta.width-cropWidth,Math.max(0,Math.round(meta.width*.54-cropWidth/2)));
 const mobilePath=join(out,`${id}-mobile.webp`);
 await sharp(original).extract({left,top:0,width:cropWidth,height:meta.height}).resize(700,875).webp({quality:82,effort:6}).toFile(mobilePath);
 const mobileInfo=await sharp(mobilePath).metadata();
 files.push({src:`/manforth/${id}-mobile.webp`,width:mobileInfo.width,height:mobileInfo.height,bytes:(await stat(mobilePath)).size,mobile:true});
 manifest.push({id,sourceMaster:source,sourceDimensions:[meta.width,meta.height],focalPosition:'54% 50%',alt:'Decorative; adjacent HTML supplies the scene meaning',status:'User-selected replacement artwork',provenance:'Supplied by the user as a local PNG attachment. Only resized, cropped for mobile and encoded for web delivery.',files});
}
await writeFile('public/manforth/asset-manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(manifest.map(({id,files})=>({id,files})),null,2));
