// Import supplied thumbnails and factual catalogue metadata, never illustration prompts as coaching advice.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
const source = resolve(process.argv[2] || '../catalogue');
const catalogue = readFileSync(process.argv[3] || 'C:/Users/romas/Downloads/gym_exercises_machines_icon_catalogue.md', 'utf8');
const records = JSON.parse(readFileSync(resolve(source, 'manifest.json'), 'utf8'));
const sections = catalogue.split(/(?=<a id="(?:ex|eq)-)/);
const meta = new Map();
for (const section of sections) {
  const identity = section.match(/\*\*ID:\*\* `(exercise|equipment):([^`]+)`/);
  if (!identity) continue;
  meta.set(`${identity[1]}:${identity[2]}`, {
    tracking: section.match(/\*\*Logging:\*\* `([^`]+)`/)?.[1] || null,
    equipmentIds: [...section.matchAll(/\]\(#eq-([^\)]+)\)/g)].map(m => `equipment:${m[1]}`),
    flags: section.match(/\*\*Flags:\*\* (.+)/)?.[1].trim() || '',
  });
}
const out = [];
for (const record of records) {
  if (!['exercise', 'equipment'].includes(record.type) || !/^[a-z0-9_]+$/.test(record.id)) throw Error('Invalid catalogue identity');
  const key = `${record.type}:${record.id}`, entry = meta.get(key);
  if (!entry) throw Error(`Missing catalogue record: ${key}`);
  const path = `/gym/catalogue/${record.type}/${record.id}.webp`;
  const destination = resolve(`public${path}`);
  mkdirSync(resolve(`public/gym/catalogue/${record.type}`), { recursive: true });
  copyFileSync(resolve(source, record.type, `${record.id}-128.webp`), destination);
  out.push({ id: key, name: record.name, type: record.type, ...entry, icon: path, bytes: statSync(destination).size, reviewStatus: 'draft' });
}
writeFileSync('lib/gym/catalogue-assets.json', JSON.stringify(out));
const report = { exercises: out.filter(r => r.type === 'exercise').length, equipment: out.filter(r => r.type === 'equipment').length, count: out.length, format: '128px transparent WebP', totalBytes: out.reduce((n, r) => n + r.bytes, 0), minBytes: Math.min(...out.map(r => r.bytes)), maxBytes: Math.max(...out.map(r => r.bytes)) };
writeFileSync('public/gym/catalogue/manifest.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
