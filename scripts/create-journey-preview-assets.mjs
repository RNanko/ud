import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";

const sourceDirectory = process.argv[2];
if (!sourceDirectory) throw new Error("Pass the directory containing the original journey PNGs.");
const output = resolve("public/journey-preview");
await mkdir(output, { recursive: true });
const variants = [
  { source: "01-desktop-journey-concept.png", output: "desktop-wide.webp", crop: { left: 0, top: 65, width: 1672, height: 607 } },
  { source: "02-mobile-journey-concept.png", output: "mobile.webp", crop: { left: 180, top: 410, width: 620, height: 896 } },
];
const manifest = [];
for (const variant of variants) {
  const original = await readFile(join(sourceDirectory, variant.source));
  const result = await sharp(original).extract(variant.crop).webp({ quality: 87 }).toFile(join(output, variant.output));
  manifest.push({ ...variant, sourceSha256: createHash("sha256").update(original).digest("hex"), bytes: result.size });
}
const cleaned = [
  { source: "desktop-transparent-source.png", output: "desktop-transparent.webp", width: 1672, height: 941 },
  { source: "mobile-transparent-source.png", output: "mobile-transparent.webp", width: 941, height: 1672, crop: { left: 180, top: 350, width: 620, height: 956 } },
  { source: "desktop-clean-source.png", output: "desktop-clean.webp", width: 1672, height: 941 },
  { source: "mobile-clean-source.png", output: "mobile-clean.webp", width: 941, height: 1672, crop: { left: 180, top: 350, width: 620, height: 956 } },
  { source: "mobile-clean-source.png", output: "mobile-sky.webp", width: 941, height: 1672, crop: { left: 0, top: 0, width: 941, height: 350 } },
];
for (const variant of cleaned) {
  const original = await readFile(join(output, variant.source));
  let pipeline = sharp(original).resize(variant.width, variant.height);
  if (variant.crop) pipeline = pipeline.extract(variant.crop);
  const result = await pipeline.webp({ quality: 90, alphaQuality: 100 }).toFile(join(output, variant.output));
  manifest.push({ ...variant, sourceSha256: createHash("sha256").update(original).digest("hex"), bytes: result.size });
}
await writeFile(join(output, "artwork.json"), JSON.stringify({ note: "Original crops retained for comparison. Active clean-source PNGs are AI-edited derivatives of the supplied desktop/mobile references: UI overlays removed and hidden scenery reconstructed. Mountain and sky are still one raster layer. Original reference files are untouched.", variants: manifest }, null, 2) + "\n");
console.log("Created original comparison crops, cleaned preview derivatives and source manifest.");
