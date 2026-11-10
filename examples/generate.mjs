import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { subjects, palettes } from '../src/catalog.js';
import { composeScene } from '../src/composer.js';
import { createScene } from '../src/scene.js';
import { buildSceneSvg, getVariant, assertVectorAsset } from '../src/svg.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'examples');
const cases = [
  { file: '01-knowledge-landscape', title: 'Собрать знания воедино', prompt: 'Собрать знания воедино', width: 1200, height: 630, detail: 'L', paletteId: 'violet', seed: 7, includeBackground: true },
  { file: '02-savings-square', title: 'Как сохранить сбережения', prompt: 'Как сохранить сбережения', width: 1000, height: 1000, detail: 'S', paletteId: 'peach', seed: 2, includeBackground: false },
  { file: '03-inspiration-portrait', title: 'Идеи и вдохновение', prompt: 'Идеи и вдохновение', width: 900, height: 1200, detail: 'L', paletteId: 'turquoise', seed: 5, includeBackground: true },
];
const loadAsset = assetPath => readFile(path.join(root, assetPath.replace(/^[/\\]+/, '')), 'utf8');
const pathData = text => [...text.matchAll(/<path\b[^>]*?\bd\s*=\s*(["'])(.*?)\1/gs)].map(match => match[2]);
const sha256 = text => createHash('sha256').update(text).digest('hex');
await mkdir(output, { recursive: true });
const manifest = [];
for (const entry of cases) {
  const composed = composeScene({ ...entry, mode: 'metaphor', subjects });
  if (composed.status !== 'ok' || !composed.objects.length) throw new Error('No composition: ' + entry.file);
  const scene = createScene({ width: entry.width, height: entry.height, detail: entry.detail, paletteId: entry.paletteId, objects: composed.objects, scale: composed.scale });
  const svg = await buildSceneSvg(scene, { loadAsset });
  assertVectorAsset(svg);
  const exportedPaths = pathData(svg);
  const sourcePaths = [];
  const sourceAssets = [];
  for (const instance of scene.objects) {
    const subject = subjects.find(subject => subject.id === instance.assetId);
    const variant = getVariant(subject, scene.detail, instance.role);
    const source = await loadAsset(variant.path);
    sourcePaths.push(...pathData(source));
    sourceAssets.push({ assetId: subject.id, name: subject.name, role: instance.role, path: variant.path, sha256: sha256(source) });
  }
  if (JSON.stringify(exportedPaths) !== JSON.stringify(sourcePaths)) throw new Error('Path geometry differs: ' + entry.file);
  const ids = [...svg.matchAll(/\bid\s*=\s*(["'])(.*?)\1/g)].map(match => match[2]);
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate SVG IDs: ' + entry.file);
  if (/<(?:image|script|foreignObject)\b|data:image|https?:\/\/www\.figma/i.test(svg)) throw new Error('Invalid SVG content: ' + entry.file);
  await writeFile(path.join(output, entry.file + '.svg'), svg);
  await writeFile(path.join(output, entry.file + '.scene.json'), JSON.stringify(scene, null, 2) + '\n');
  manifest.push({
    file: entry.file + '.svg', scene: entry.file + '.scene.json', title: entry.title,
    prompt: entry.prompt, mode: 'metaphor', engine: composed.engine,
    width: scene.width, height: scene.height, detail: scene.detail, paletteId: scene.paletteId,
    paletteName: palettes.find(palette => palette.id === scene.paletteId)?.name,
    objects: scene.objects.length, sourcePathsVerified: sourcePaths.length,
    svgSha256: sha256(svg), sourceAssets, explanation: composed.explanation, warnings: composed.warnings,
  });
}
await writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest.map(({ file, width, height, detail, paletteId, objects, sourcePathsVerified }) => ({ file, width, height, detail, paletteId, objects, sourcePathsVerified })), null, 2));

