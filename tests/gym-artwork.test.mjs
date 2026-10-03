import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { loadModule, hookHarness, jsxRuntime, findNode } from "./helpers.mjs";
import { library, types } from "./gym-fixture.mjs";

const assets = JSON.parse(readFileSync("lib/gym/catalogue-assets.json", "utf8"));
const registry = loadModule("lib/gym/icons.ts", {"./catalogue-assets.json": assets});
test("legacy exercises, categories and custom icon choices use one WebP style or explicitly omit artwork", () => {
  assert.equal(Object.keys(registry.exerciseArtwork).length, library.length);
  assert.equal(Object.keys(registry.categoryIcons).length, types.categories.length);
  assert.equal(registry.exerciseArtwork["custom-unknown-id"], undefined);
  for (const key of types.iconKeys) assert.ok(Object.hasOwn(registry.exerciseIcons, key));
  assert.equal(registry.exerciseArtwork["outdoor-cycling"], null);
  assert.equal(registry.exerciseIcons["outdoor-bike"], null);
  for (const src of [...Object.values(registry.exerciseArtwork), ...Object.values(registry.categoryIcons), ...Object.values(registry.exerciseIcons)].filter(Boolean)) {
    assert.match(src, /^\/gym\/catalogue\/(exercise|equipment)\/\w+\.webp$/);
    const asset = assets.find(item => item.icon === src);
    assert.ok(asset, src);
    assert.equal(statSync(`public${src}`).size, asset.bytes);
    const header = readFileSync(`public${src}`);
    assert.equal(header.toString("ascii", 0, 4), "RIFF");
    assert.equal(header.toString("ascii", 8, 12), "WEBP");
  }
  for (const exercise of library) assert.equal(registry.resolveExerciseIconId(exercise.id, exercise.icon), registry.exerciseArtworkIds[exercise.id]);
});

test("missing or failed illustration removes artwork without reverting to the old silhouette", () => {
  const hooks = hookHarness();
  const Icon = loadModule("app/(main)/account/gym/CatalogueIcon.tsx", {
    react: hooks.react, "react/jsx-runtime": jsxRuntime,
    "next/image": {__esModule: true, default: "gym-image"},
    "@/lib/gym/catalogue": {catalogueById: new Map(assets.map(asset => [asset.id, asset]))},
  }).default;
  const render = id => hooks.render(() => Icon({id, decorative: false, label: "Test exercise"}));
  assert.equal(render("exercise:missing-artwork"), null);
  const image = findNode(render("exercise:crunch"), node => node.type === "gym-image");
  assert.equal(image.props.alt, "Test exercise");
  image.props.onError();
  assert.equal(render("exercise:crunch"), null);
  assert.ok(findNode(render("equipment:barbell"), node => node.type === "gym-image"));
});
