// Vector interface illustrations, based on the supplied catalogue's silhouette brief.
// Single representative poses identify exercises; they are not technique demonstrations.
import { readFileSync, mkdirSync, writeFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
const tokens = readFileSync("app/globals.css", "utf8");
const blue = tokens.match(/--primary-plus:\s*(#[\da-f]+)/i)[1];
const orange = tokens.match(/--primary-minus:\s*(#[\da-f]+)/i)[1];
const path = (d, color = blue, width = 6, opacity = 1) => `<path d="${d}" stroke="${color}" stroke-width="${width}" opacity="${opacity}"/>`;
const frame = d => path(d, blue, 5, .55);
const body = d => path(d, blue, 14);
const accent = d => path(d, orange, 9);
const head = (x, y, r = 13) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${blue}" fill-opacity=".16" stroke="${blue}" stroke-width="5"/>`;
const disc = (x, y, r = 20) => `<ellipse cx="${x}" cy="${y}" rx="${r * .42}" ry="${r}" fill="${orange}" fill-opacity=".13" stroke="${orange}" stroke-width="5"/>`;
const dumbbell = (x, y) => path(`M${x - 13} ${y}h26`, orange, 6) + path(`M${x - 15} ${y - 9}v18m30 -18v18`, orange, 9);
const seat = (x, y, width = 65) => path(`M${x} ${y}h${width}`, blue, 12) + frame(`M${x + 8} ${y + 7}v32m${width - 16} -32v32`);
const stack = (x, y) => frame(`M${x} ${y}h27v99h-27Zm0 18h27m-27 19h27m-27 19h27m-27 19h27`);
const bar = (x, y, width = 122) => path(`M${x} ${y}h${width}`, orange, 7) + disc(x + 9, y) + disc(x + width - 9, y);
const bench = seat(40, 162, 107) + frame("M30 202h133M46 178V66m143 120V51M38 94h15m127 0h16");
const seated = head(109, 59) + body("M109 84v61l32 21 3 45m-35 -66-25 31 7 35") + body("M91 211h22m31 0h21");
const upright = head(128, 46) + body("M128 71v70m0 -55-34 26m34 -26 34 26M128 140l-22 62m22 -62 22 62m-44 0H87m63 0h19");
const pressFrame = frame("M75 196V84m82 114V76M64 210h112M157 79l35 -18v137") + seat(84, 153, 54) + stack(186, 91);
const cycle = frame("M52 212h136M72 202l56 -79 32 79H72m56 -79 33 -14m-55 23-18 -34m-17 0h32m56 10 16 -34h14") + `<circle cx="125" cy="177" r="20" stroke="${orange}" stroke-width="6"/>`;
const exercise = {
  "bench-press": bench + head(56, 140) + body("M79 149h57l23 27-2 33m-25 -60 43 19 21 35M157 209h21m18 -6h17M83 147l-6 -24 22 -27m-2 50 27 -25 3 -25") + bar(53, 96, 132) + accent("M83 147l-6 -24"),
  "incline-dumbbell-press": frame("M51 204h143M60 117l60 60m-31 -41-10 63m40 -22v25") + path("M62 115l57 58", blue, 13) + head(70, 94) + body("M86 115l38 44 34 14-2 36m-32 -50 57 5 20 39M156 209h19m26 -6h16M93 123l-24 3-15 -41m53 52 35 -22 5 -42") + dumbbell(52, 80) + dumbbell(147, 69) + accent("M93 123l-24 3"),
  "chest-press": pressFrame + seated + body("M108 92l-30 24-25 -16m67 -8 32 20 23 -18") + accent("M78 116l-25 -16m99 12 23 -18") + path("M47 94l7 14m115 -20 12 15", orange, 6),
  "cable-fly": frame("M35 214V40h186v174M26 214h38m148 0h18") + stack(38, 109) + stack(190, 109) + frame("M40 70l37 53m139 -53-39 53") + head(128, 64) + body("M128 88v61m0 -49-35 6-16 19m51 -25 35 6 16 19M128 149l-26 60m26 -60 27 60m-53 0H86m69 0h16") + accent("M93 106l-16 19m86 -19 16 19"),
  "lat-pulldown": frame("M51 214V34h134v180m-146 0h165M119 35v54") + stack(181, 89) + seat(80, 157, 72) + head(116, 105) + body("M116 130v31l39 10 4 38m-43 -48-28 24 10 24M98 209h15m46 0h15M112 136l-28 -17-6 -21m44 36 28 -14 7 -22") + path("M69 96l49 -9 46 9", orange, 7) + accent("M84 119l-6 -21m72 22 7 -22"),
  "seated-row": frame("M34 218h190M197 205V46h27m-10 4v139") + stack(194, 82) + seat(48, 174, 52) + head(78, 105) + body("M83 131l15 42 54 9 33 29m-87 -38 43 26 36 12M86 139l30 9 27 -13m-45 18 24 9 24 -17") + path("M149 137l47 -30", orange, 3) + path("M142 130l7 17", orange, 7) + accent("M116 148l27 -13"),
  "dumbbell-row": seat(68, 159, 112) + head(152, 89) + body("M137 107l-56 21-12 76m10 -74 51 51 20 29M69 204H51m99 6h18M129 111l34 44m-48 -41-20 38 15 25") + dumbbell(110, 179) + accent("M95 152l15 25"),
  squat: frame("M36 214V46h181v168m-191 0h44m135 0h22M37 113h22m141 0h15") + head(124, 70) + body("M124 96l-10 50 44 23-25 43m-19 -66-31 28 8 38M133 212h19m-61 0H73M119 109l-30 -9-11 -17m45 22 29 -5 11 -17") + bar(54, 84, 144) + accent("M114 146l44 23m-44 -23-31 28"),
  "leg-press": frame("M36 217h190M82 214l118 -150m-89 99 70 -90M168 67l-14 -37 40 -8 15 34Z") + path("M48 174l-15 -43m16 43h44", blue, 14) + head(49, 114) + body("M56 139l28 35 34 -24 45 -76m-73 95 45 -6 35 -79") + accent("M118 150l45 -76") + disc(175, 130, 20),
  "leg-extension": pressFrame + head(105, 66) + body("M105 91v55l43 5 43 -5m-86 0 34 14 44 4M191 146l14 -7m-22 25 19 -4M100 103l-18 43m33 -43 23 40") + path("M175 158l25 -9", orange, 15) + accent("M148 151l43 -5"),
  "leg-curl": frame("M32 211h176M58 163v45m100 -45v45") + path("M42 160h127", blue, 15) + stack(190, 89) + head(44, 130) + body("M67 144h68l31 -24-11 -41m-23 69 49 -1 17 -36M73 145l-22 27 4 22m28 -49-2 35-20 16") + path("M149 76h19", orange, 14) + accent("M166 120l-11 -41"),
  "calf-raise": frame("M55 218V47h141v171M47 218h25m116 0h22") + upright + path("M78 216h99m-87 -107h76", orange, 8) + accent("M113 170l-7 32m36 -31 8 31"),
  "shoulder-press": pressFrame + seated + body("M105 91l-35 -4-7 -36m52 40 38 -4 10 -36") + path("M55 50h19m81 0h18", orange, 8) + accent("M70 87l-7 -36m90 36 10 -36"),
  "lateral-raise": head(128, 52) + body("M128 78v68m0 -51-40 12-38 -8m78 -4 40 12 38 -8M128 146l-20 61m20 -61 19 61M108 207H90m57 0h18") + dumbbell(46, 97) + dumbbell(210, 97) + accent("M128 95l-40 12m40 -12 40 12"),
  "biceps-curl": head(124, 48) + body("M124 74v76m-3 -63-26 43 10 -42m27 -1 28 39 5 -37M124 150l-21 59m21 -59 21 59M103 209H85m60 0h18") + dumbbell(104, 82) + dumbbell(166, 83) + accent("M95 130l10 -42m55 38 5 -37"),
  "triceps-pushdown": frame("M182 214V31h32v183m-13 -181v62l-64 50") + stack(180, 105) + head(100, 60) + body("M101 87l7 60-17 60m17 -60 26 60M91 207H73m61 0h17M108 103l17 20 9 39m-15 -62 24 14 8 43") + path("M128 163l28 -7", orange, 7) + accent("M125 123l9 39"),
  "push-up": head(191, 135) + body("M168 143l-61 -9-57 35m119 -22 7 28-13 24m-1 -55-11 28 5 27M50 169l-10 11m123 19h19m-26 0h-14") + accent("M153 142l-28 -6M176 175l-13 24"),
  "pull-up": frame("M43 215V36h170v179m-180 0h34m135 0h19") + head(130, 101) + body("M130 127v45l-15 35m15 -35 13 37M115 207H99m44 2h17M127 135l-34 -45-6 -51m51 94 29 -44 3 -50") + path("M67 39h120", orange, 7) + accent("M93 90l-6 -51m80 50 3 -50"),
  "assisted-pull-up": frame("M43 215V30h167v185m-176 0h35m132 0h20") + stack(189, 102) + head(124, 98) + body("M124 124v39l26 27-12 16m-14 -43-24 23 11 20M123 132l-34 -44-6 -48m47 92 29 -44 5 -48") + path("M69 40h113M98 213h58", orange, 10) + accent("M89 88l-6 -48m76 48 5 -48"),
  plank: head(194, 134) + body("M170 145l-74 8-51 24m126 -30 3 32-34 16m17 -47-2 29-37 18M45 177l-9 10m104 8h23m-45 0H99") + accent("M154 147l-41 5"),
  crunch: head(152, 130) + body("M132 143l-38 36-42 -1m42 1 26 -35 35 13 26 41m-69 -47 17 -18 27 15m-38 8 33 -3") + body("M181 198h23M52 178H34") + accent("M126 150l-22 21"),
  treadmill: frame("M34 214h186l11 -24H52ZM183 193V73l39 -8m-49 25h39") + path("M184 74l-8 -17 46 -4 7 18Z", orange, 5) + head(131, 61) + body("M128 88l-14 53 33 17-12 35m-21 -52-34 24-12 29M125 103l-32 8-14 -16m47 9 33 16 18 -14M68 194H50m85 -1h22") + accent("M147 158l-12 35"),
  "stationary-cycling": cycle + head(137, 47) + body("M133 73l-26 48 47 24-26 31m-17 -49 21 40-34 15M130 82l31 18 17 -4m-68 25H94") + accent("M154 145l-26 31") + path("M99 98h20m5 77 19 9", orange, 5),
  "outdoor-cycling": `<circle cx="58" cy="179" r="31" stroke="${blue}" stroke-width="5"/><circle cx="195" cy="179" r="31" stroke="${blue}" stroke-width="5"/>` + frame("M58 179l46 -70 36 70H58l60 -42 77 42-27 -77m-14 1h29m-86 7h28") + head(150, 62) + body("M139 83l-32 30 48 23-15 43m-30 -64 14 49-28 11M141 89l26 11 13 20") + accent("M155 136l-15 43") + path("M133 184h18m-64 -6h19", orange, 5),
  rowing: frame("M31 212h193M48 183h115m-101 5v22m94 -22v22") + `<circle cx="199" cy="169" r="27" stroke="${orange}" stroke-width="6"/>` + head(70, 105) + body("M75 131l20 47 53 -3 25 22m-78 -19 35 18 45 1M81 143l32 8 24 -14m-47 17 28 8 24 -17") + path("M142 141l31 14m-41 -20 15 17", orange, 5) + accent("M113 151l24 -14") + path("M86 189h25", blue, 12),
  elliptical: frame("M45 215h164M172 187l-4 -103m-87 0-8 104") + `<circle cx="176" cy="177" r="26" stroke="${blue}" stroke-width="5"/>` + head(128, 47) + body("M125 73l-5 60") + body("M120 133l-32 36 4 30m28 -66 38 23 8 34M124 90l-39 9-5 -34m46 28 40 8 8 -33") + accent("M88 169l4 30m66 -43 8 34") + path("M78 200h32m45 -9h31M73 65h13m83 3h12", orange, 7),
};
const torso = head(128, 45, 14) + frame("M101 77l-13 43-9 29m76 -72 13 43 9 29M101 77l27 -9 27 9-10 72h-34ZM111 149l-7 61m41 -61 7 61M104 210H89m63 0h15");
const region = d => `<path d="${d}" fill="${orange}" fill-opacity=".65" stroke="${orange}" stroke-width="3"/>`;
const categories = {
  Legs: torso + region("M113 150h12l-8 41-10 -2Zm18 0h12l6 39-10 2Z"),
  Chest: torso + region("M104 82l20 -7v27l-22 -3Zm28 -7 20 7 2 17-22 3Z"),
  Back: torso + region("M105 83l23 13 23 -13-7 37-16 13-16 -13Z"),
  Shoulders: torso + region("M100 78l13 2-7 21-13 -5Zm43 2 13 -2 7 18-13 5Z"),
  Arms: torso + accent("M94 105l-6 16-7 25m81 -41 6 16 7 25"),
  Core: torso + region("M115 108h26l-2 30h-22Z"),
  Cardio: path("M128 207l-75 -65C-4 89 82 17 128 82 174 17 260 89 203 142Z", blue, 7) + path("M53 129h38l16 -31 22 63 17 -32h55", orange, 9),
};
let total = 0;
const inventory = [];
function write(group, key, content) {
  const directory = resolve("public/gym/artwork", group); mkdirSync(directory, { recursive: true });
  const file = resolve(directory, `${key}.svg`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="none" stroke-linecap="round" stroke-linejoin="round">${content}</svg>`;
  writeFileSync(file, svg); const bytes = statSync(file).size; total += bytes; inventory.push({ key, group, bytes });
}
for (const [id, content] of Object.entries(exercise)) write("exercises", id, content);
for (const [category, content] of Object.entries(categories)) write("categories", category.toLowerCase(), content);
writeFileSync("public/gym/artwork/manifest.json", JSON.stringify({ format: "SVG", dimensions: 256, totalBytes: total, assets: inventory }, null, 2) + "\n");
console.log(`${inventory.length} transparent SVG illustrations · ${total} bytes total · largest ${Math.max(...inventory.map(item => item.bytes))} bytes`);
