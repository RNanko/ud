import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { loadModule } from "./helpers.mjs";
import { library, types } from "./gym-fixture.mjs";

test("every built-in exercise and body part resolves to a compact transparent local illustration", () => {
  const registry = loadModule("lib/gym/icons.ts", { "./types": types, "./library": { exerciseLibrary: library } });
  const manifest = JSON.parse(readFileSync("public/gym/artwork/manifest.json", "utf8"));
  assert.equal(Object.keys(registry.exerciseArtwork).length, library.length);
  assert.equal(Object.keys(registry.categoryIcons).length, types.categories.length);
  assert.equal(registry.exerciseArtwork["custom-unknown-id"], undefined);
  for (const key of types.iconKeys) assert.ok(statSync(`public${registry.exerciseIcons[key]}`).size > 0);
  let bytes = 0;
  for (const src of [...Object.values(registry.exerciseArtwork), ...Object.values(registry.categoryIcons)]) {
    const svg = readFileSync(`public${src}`, "utf8");
    const size = statSync(`public${src}`).size;
    assert.match(svg, /viewBox="0 0 256 256"/);
    assert.equal(/<image|base64|<filter|<rect|<text|<script|foreignObject/.test(svg), false, src);
    assert.ok(size < 15000, src);
    // Only the app's two brand tones; no opaque root/background surface.
    for (const color of svg.match(/#[\da-f]{6}/gi) || []) assert.ok(["#38bdf8", "#fb923c"].includes(color), src);
    assert.match(svg, /fill="none"/);
    bytes += size;
  }
  assert.equal(bytes, manifest.totalBytes);
  assert.equal(manifest.assets.length, library.length + types.categories.length);
  assert.ok(bytes < 50000);
});
