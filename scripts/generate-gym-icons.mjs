// Small, transparent SVG interface illustrations. No raster payloads, filters or client dependencies.
import { mkdirSync, writeFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
const blue = "#38bdf8", orange = "#fb923c", neutral = "#94a3b8";
const path = (d, color = blue, width = 3.5) => `<path d="${d}" stroke="${color}" stroke-width="${width}"/>`;
const circle = (x, y, r, color = orange) => `<circle cx="${x}" cy="${y}" r="${r}" stroke="${color}" stroke-width="3.5"/>`;
const ellipse = (x, y, rx, ry, color = orange) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" stroke="${color}" stroke-width="3.5"/>`;
const pad = (x, y, w = 46, h = 15) => `<path d="M${x} ${y}l${w} -12 18 ${h}-${w} 12Z" fill="${orange}" fill-opacity=".16" stroke="${orange}" stroke-width="3.5"/>`;
const feet = path("M26 156l30 -9 18 9m39 -12 29 -9 20 10", neutral);
const rack = feet + path("M40 151V43l87 -23v125M62 149V52l86 -23v112M40 43l22 9m65 -32 21 9M40 95l22 9m65 -32 21 9") + path("M44 58l87 -23", neutral);
const stack = path("M114 77l23 -6v65l-23 7ZM116 91l20 -5m-20 18 20 -5m-20 18 20 -5m-20 18 20 -5", neutral);
const bench = pad(45, 104, 66, 15) + path("M49 121v31m62 -47v29m-63 10 28 -8m34 -10 23 -7", neutral);
const bikeWheels = ellipse(48, 137, 24, 28, blue) + ellipse(134, 115, 24, 28, blue);
const bikeFrame = path("M48 137l29 -58 25 51-54 7 35 -38 51 16-20 -63M71 80l19 -5m15 -17 20 -5m-42 46 6 32", orange) + circle(83, 99, 5, neutral);
const icons = {
  barbell: path("M26 120l115 -45", neutral, 6) + ellipse(43, 112, 12, 31) + ellipse(132, 79, 12, 31) + path("M21 122l15 -5m104 -40 13 -5", blue, 6),
  dumbbells: path("M33 75l62 -22m-35 91 62 -22", neutral, 7) + ellipse(38, 73, 10, 24) + ellipse(91, 55, 10, 24) + ellipse(64, 142, 10, 24, blue) + ellipse(116, 124, 10, 24, blue),
  "bench-press": bench + path("M30 131V62m105 33V35M25 62l20 -6m84 -19 20 -6M28 65l109 -33", blue) + ellipse(42, 60, 8, 20) + ellipse(128, 37, 8, 20),
  "chest-press": feet + path("M42 148V41l77 -21v122M63 143V60l54 -15m-74 -4 20 19M70 97l-25 -20V58m51 27 35 -19V45") + pad(54, 116, 37, 13) + path("M82 106V61l19 -5v44Z", orange) + stack,
  cable: rack + stack + path("M60 56v58l-16 22m103 -99v54l16 16", orange, 2.5) + circle(60, 54, 5, neutral) + circle(145, 36, 5, neutral) + path("M35 135l16 5m107 -37 12 8", orange),
  "lat-pulldown": feet + path("M45 147V35l83 -22v126M45 35l22 12 76 -21m-70 7v55m0 -8-29 8m29 -8 31 -8") + stack + pad(46, 117, 40, 13) + path("M58 130v22M43 103l35 -10", orange, 8) + circle(73, 39, 5, neutral),
  "seated-row": feet + path("M119 144V41l24 -7v104M120 42l23 8m-23 62-66 20m26 -5-13 -17m52 -15-51 13") + stack + pad(37, 128, 40, 13) + path("M42 144v18m25 -50 11 -5", orange, 7),
  "squat-rack": rack + path("M43 78l91 -25", neutral, 5) + ellipse(55, 75, 9, 23) + ellipse(126, 55, 9, 23) + path("M41 123l40 -10m46 -11 21 -6", orange),
  "leg-press": feet + path("M37 151l83 -97 20 10-76 91M43 138l80 -91m-11 21 22 11m-70 65 31 -8") + pad(38, 139, 32, 12) + path("M38 138l-11 -46 21 -6 17 43M117 55l-8 -22 31 -9 8 23Z", orange) + ellipse(101, 101, 12, 20) + ellipse(125, 87, 12, 20),
  "leg-extension": feet + path("M43 152V80l79 -21v85M47 112l58 -17m-25 13 12 30 32 -8") + pad(42, 100, 42, 14) + path("M84 97V54l22 -6v43Z", orange) + path("M89 139l38 -10", orange, 12) + stack,
  "leg-curl": feet + path("M39 147V95l95 -26v76M59 137l19 -5m15 -29 31 22-12 24") + pad(31, 92, 81, 15) + path("M108 145l29 -8", orange, 12) + stack,
  "shoulder-press": feet + path("M44 150V67l82 -22v96M61 98l-30 -18V45m67 45 42 -34V24") + pad(50, 118, 37, 13) + path("M78 105V61l23 -6v43Z", orange) + path("M22 46l21 -6m89 -16 22 -6", orange, 7) + stack,
  treadmill: path("M23 140l102 -29 38 21-104 30Z", blue) + path("M39 139l85 -24 22 13-86 24Z", neutral) + path("M103 117V54l35 -10v75M99 67l-36 11m74 -26 16 8", blue) + pad(90, 43, 38, 15) + path("M104 43l-3 -12 29 -8 8 19m-79 117v11m88 -32v12", orange),
  "stationary-bike": feet + path("M50 137l68 -20 26 10-67 20Z", blue) + ellipse(80, 119, 21, 23) + path("M80 119l-13 -51m11 2-26 7m29 42 33 -40V54m-8 4 25 -8", orange) + pad(45, 70, 28, 10) + path("M76 118l16 18m-4 2 12 -3", neutral),
  "outdoor-bike": bikeWheels + bikeFrame + path("M110 49l13 -5 6 12m-81 81 0 -17m86 -5-15 7", neutral),
  rowing: feet + path("M27 145l108 -31 25 12-107 31Z", blue) + ellipse(126, 108, 24, 29) + pad(46, 133, 28, 10) + path("M71 118l15 -18m-4 7 14 -5m30 -4-44 11", orange) + path("M133 78l16 8m-99 63v13", neutral),
  elliptical: feet + ellipse(111, 115, 25, 29) + path("M107 114l-36 -23m-7 -41 7 78m57 -95-4 96M69 88l-25 19m80 -35 21 -6", blue) + path("M45 112l-6 33 49 -14m36 -39 24 20-13 22", orange) + pad(33, 144, 38, 9) + pad(103, 126, 29, 9) + path("M58 49l17 -5m47 -11 13 -4", orange, 6),
  bodyweight: circle(88, 37, 12, orange) + path("M85 54l-14 45 27 13 21 39M75 94l-22 55m27 -75-39 21m41 -24 36 24m-76 0-12 -5m90 5 11 -7", blue, 6) + path("M42 152l18 -5m52 7 18 -5", neutral),
  core: path("M24 146l104 -28 29 15-104 29Z", blue) + circle(124, 89, 12, orange) + path("M108 97l-43 14-33 -14m32 14 27 13 36 -10m-20 -12 26 15m-32 5 5 12", orange, 6) + path("M31 99l-9 7m109 12 14 -4", neutral),
};
const directory = resolve("public/gym"); mkdirSync(directory, { recursive: true });
let total = 0;
for (const [key, body] of Object.entries(icons)) {
  const file = resolve(directory, `${key}.svg`);
  writeFileSync(file, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" fill="none" stroke-linecap="round" stroke-linejoin="round"><g transform="translate(9 6)">${body}</g></svg>`);
  const bytes = statSync(file).size; total += bytes; console.log(`${key}: ${bytes} bytes`);
}
console.log(`${Object.keys(icons).length} transparent SVG icons: ${total} bytes total`);
