import test from 'node:test';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const catalog = await import('../src/catalog.js');
const { subjects, palettes } = catalog;
const expectedSubjects = ['book', 'phone', 'puzzle', 'coin', 'headphones', 'lamp', 'flowers', 'wallet', 'folder', 'pen'];

function localAssetPath(assetPath) {
  assert.equal(typeof assetPath, 'string');
  assert.ok(assetPath.startsWith('/assets/'), `Nonlocal asset path: ${assetPath}`);
  const resolved = path.resolve(projectRoot, '.' + assetPath);
  assert.ok(resolved.startsWith(path.join(projectRoot, 'assets') + path.sep), 'Asset leaves its directory');
  return resolved;
}

function idsIn(svg) {
  return [...svg.matchAll(/(?:^|[\s<])id\s*=\s*["']([^"']+)["']/g)].map(match => match[1]);
}

function internalReferences(svg) {
  const urlRefs = [...svg.matchAll(/url\(\s*["']?#([^\s)"']+)["']?\s*\)/g)].map(match => match[1]);
  const hrefRefs = [...svg.matchAll(/(?:xlink:)?href\s*=\s*["']#([^"']+)["']/g)].map(match => match[1]);
  return [...urlRefs, ...hrefRefs];
}

function assertVectorSvg(svg, label) {
  assert.match(svg, /<svg\b/i, `${label}: missing SVG root`);
  assert.match(svg, /\bviewBox\s*=/, `${label}: missing viewBox`);
  assert.match(svg, /<(?:path|polygon|polyline|rect|circle|ellipse|line|use)\b/i, `${label}: no vector geometry`);
  assert.doesNotMatch(svg, /<(?:image|foreignObject|script)\b/i, `${label}: raster/HTML/script payload`);
  assert.doesNotMatch(svg, /data:image|figma\.com\/api\/mcp\/asset|https?:\/\/[^"'\s]+\.(?:png|jpg|jpeg|webp)/i, `${label}: external or raster dependency`);
  const ids = idsIn(svg);
  assert.equal(new Set(ids).size, ids.length, `${label}: duplicate SVG IDs`);
  const known = new Set(ids);
  for (const ref of internalReferences(svg)) assert.ok(known.has(ref), `${label}: unresolved #${ref}`);
}

test('catalog covers the ten supplied subject families and all four source variants', async () => {
  assert.deepEqual([...subjects.map(s => s.id)].sort(), [...expectedSubjects].sort());
  for (const subject of subjects) {
    assert.ok(subject.name.trim(), `${subject.id}: no display name`);
    for (const detail of ['S', 'L']) for (const role of ['main', 'background']) {
      const variant = subject.variants?.[detail]?.[role];
      assert.ok(variant, `${subject.id}/${detail}/${role}: absent source variant`);
      assert.ok(Number.isFinite(variant.width) && variant.width > 0, `${subject.id}: invalid width`);
      assert.ok(Number.isFinite(variant.height) && variant.height > 0, `${subject.id}: invalid height`);
      const svg = await readFile(localAssetPath(variant.path), 'utf8');
      assertVectorSvg(svg, `${subject.id}/${detail}/${role}`);
    }
  }
});

test('S/L source selection is not just the same referenced L file', () => {
  for (const subject of subjects) {
    for (const role of ['main', 'background']) {
      assert.notEqual(subject.variants.S[role].path, subject.variants.L[role].path, `${subject.id}/${role}: shared file instead of S/L variants`);
    }
  }
});

test('three complete source palettes use valid explicit colors', () => {
  assert.equal(palettes.length, 3);
  assert.equal(new Set(palettes.map(p => p.id)).size, palettes.length);
  for (const palette of palettes) {
    assert.equal(palette.background.length, 3, `${palette.id}: background shades`);
    assert.equal(palette.objects.length, 3, `${palette.id}: object accents`);
    for (const color of [...palette.background, ...palette.objects, palette.ink, palette.white]) {
      assert.match(color, /^#[0-9a-f]{6}$/i, `${palette.id}: invalid explicit hex color ${color}`);
    }
    assert.notEqual(palette.ink.toLowerCase(), palette.white.toLowerCase());
  }
});

test('original palette can be resolved from catalog metadata', () => {
  assert.ok(palettes.some(p => p.id === catalog.sourcePaletteId));
});

export { assertVectorSvg, idsIn, internalReferences };

const { analyzePrompt, composeScene } = await import('../src/composer.js');

test('mixed known and unknown requested names are not silently accepted', () => {
  const result = analyzePrompt({ prompt: 'book dragon', mode: 'names', subjects });
  assert.ok(result.matchedIds.includes('book'));
  assert.ok(result.warnings.length > 0, 'Unknown requested object must be visible');
});

test('unsupported semantic input has no fabricated or arbitrary scene', () => {
  const result = composeScene({ prompt: 'qzxv fjkz 991828', mode: 'metaphor', subjects, width: 1200, height: 630, detail: 'L', seed: 2 });
  assert.deepEqual(result.objects, []);
  assert.ok(result.warnings.length > 0);
  assert.equal(result.engine, 'local');
});

test('same semantic request is reproducible and only uses catalog IDs in every format', () => {
  for (const [width, height] of [[1000,1000], [1200,630], [900,1200]]) {
    for (const detail of ['S', 'L']) {
      const request = { prompt: 'book phone puzzle coin', mode: 'names', subjects, width, height, detail, seed: 42 };
      const first = composeScene(request);
      const repeated = composeScene(request);
      assert.deepEqual(first.objects, repeated.objects);
      assert.equal(first.scale, repeated.scale);
      assert.equal(first.objects.length, 4);
      assert.ok(Number.isFinite(first.scale) && first.scale > 0);
      assert.equal(new Set(first.objects.map(item => item.id)).size, first.objects.length);
      for (const object of first.objects) {
        assert.ok(subjects.some(subject => subject.id === object.assetId));
        assert.ok(Number.isFinite(object.x) && object.x >= 0 && object.x <= width);
        assert.ok(Number.isFinite(object.y) && object.y >= 0 && object.y <= height);
        assert.ok(Number.isFinite(object.rotation));
        assert.ok(['main', 'background'].includes(object.role));
        assert.ok(!('scale' in object) && !('scaleX' in object) && !('scaleY' in object), 'Per-object scaling would change source relative proportions');
      }
    }
  }
});

const { buildSceneSvg, namespaceSvg, recolorSvg, assertVectorAsset, displaySize } = await import('../src/svg.js');

function testScene(overrides = {}) {
  return {
    width: 1200, height: 630, detail: 'L', paletteId: palettes[0].id,
    backgroundIndex: 0, scale: 0.3,
    objects: [
      {id:'copy-a',assetId:'book',x:350,y:315,rotation:0,role:'main'},
      {id:'copy-b',assetId:'book',x:750,y:315,rotation:15,role:'main'},
    ], ...overrides,
  };
}
const fixtureGeometry = 'M0 0H100V80H0Z';
function complexFixture() {
  const source = palettes.find(p => p.id === catalog.sourcePaletteId);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="80" viewBox="0 0 100 80"><defs><clipPath id="clip.0"><path id="shape:0" d="${fixtureGeometry}"/></clipPath><linearGradient id="paint.0"><stop stop-color="${source.objects[0]}"/></linearGradient></defs><path d="${fixtureGeometry}" clip-path="url(#clip.0)" fill="url(#paint.0)"/><use href="#shape:0"/></svg>`;
}

test('real composition export namespaces duplicated gradients, masks and href references', async () => {
  const output = await buildSceneSvg(testScene(), {loadAsset:async () => complexFixture()});
  assertVectorSvg(output, 'duplicated-export');
  assert.equal((output.match(/data-instance-id=/g) ?? []).length, 2);
  assert.equal((output.match(/data-asset-id="book"/g) ?? []).length, 2);
  assert.equal((output.match(/d="M0 0H100V80H0Z"/g) ?? []).length, 4, 'Source vector path data changed');
  assert.equal((output.match(/scale\(0\.3\)/g) ?? []).length, 2, 'Instances do not share exact scene scale');
});

test('real composition recoloring changes paints while preserving source path data', async () => {
  const source = palettes.find(p => p.id === catalog.sourcePaletteId);
  const target = palettes.find(p => p.objects[0].toLowerCase() !== source.objects[0].toLowerCase());
  const output = await buildSceneSvg(testScene({paletteId:target.id}), {loadAsset:async () => complexFixture()});
  assert.ok(output.toLowerCase().includes(`stop-color="${target.objects[0].toLowerCase()}"`));
  assert.equal((output.match(/d="M0 0H100V80H0Z"/g) ?? []).length, 4);
  assert.notEqual(source.objects[0].toLowerCase(), target.objects[0].toLowerCase());
});

test('source role and S/L dimensions retain canonical relative source sizes', () => {
  const book = subjects.find(s=>s.id==='book');
  const coin = subjects.find(s=>s.id==='coin');
  for (const detail of ['S', 'L']) {
    const bookSize = displaySize(book, detail, 'main');
    const coinSize = displaySize(coin, detail, 'main');
    assert.equal(bookSize.width/coinSize.width, book.variants[detail].main.width/coin.variants[detail].main.width);
    assert.equal(bookSize.height/coinSize.height, book.variants[detail].main.height/coin.variants[detail].main.height);
  }
});

test('raster/active source objects cannot silently enter exported SVG', () => {
  for (const invalid of [
    '<svg><image href="data:image/png;base64,AA=="/></svg>',
    '<svg><script>alert(1)</script></svg>',
    '<svg><foreignObject><div>HTML</div></foreignObject></svg>',
    '<svg><path onclick="alert(1)" d="M0 0L1 1"/></svg>',
    '<svg><use href="https://example.com/asset.svg#x"/></svg>',
  ]) assert.throws(()=>assertVectorAsset(invalid));
});

test('malformed scene size, scale and unknown subjects are rejected before export', async () => {
  const loadAsset=async()=>complexFixture();
  await assert.rejects(()=>buildSceneSvg(testScene({width:NaN}),{loadAsset}));
  await assert.rejects(()=>buildSceneSvg(testScene({scale:0}),{loadAsset}));
  await assert.rejects(()=>buildSceneSvg(testScene({detail:'XL'}),{loadAsset}));
  await assert.rejects(()=>buildSceneSvg(testScene({objects:[{id:'x',assetId:'dragon',x:1,y:1,role:'main'}]}),{loadAsset}));
});

test('fractional imported background selection cannot produce undefined SVG paint', async () => {
  try {
    const output=await buildSceneSvg(testScene({backgroundIndex:1.5}),{loadAsset:async()=>complexFixture()});
    assert.doesNotMatch(output,/fill="(?:undefined|NaN)"/);
  } catch (error) {
    assert.match(error.message,/background|index|shade|color|\u0444\u043e\u043d|\u0446\u0432\u0435\u0442|\u0438\u043d\u0434\u0435\u043a\u0441/i);
  }
});


test('custom neutral palette color applies to named white paints from actual Figma exports', () => {
  const target={...palettes[0],white:'#F0F1F2'};
  const output=recolorSvg('<svg><path d="M0 0H1V1Z" fill="white"/></svg>',target);
  assert.match(output,/fill="#F0F1F2"/i);
});

// Independent geometry audit: exact cubic Bezier extrema, not sampled bounds.
function parseXmlAttributes(text) {
  return Object.fromEntries([...text.matchAll(/([^\s=]+)\s*=\s*(["'])([\s\S]*?)\2/g)].map(m=>[m[1],m[3]]));
}
function svgPathAttributes(svg) {
  return [...svg.matchAll(/<path\b([^>]*?)(?:\/?>)/g)].map(m=>parseXmlAttributes(m[1]));
}
function pathSignature(attributes) {
  return JSON.stringify(Object.entries(attributes).sort(([a],[b])=>a.localeCompare(b)));
}
function multiset(values) {
  const counts=new Map();
  for (const value of values) counts.set(value,(counts.get(value)??0)+1);
  return [...counts].sort(([a],[b])=>a.localeCompare(b));
}
function cubicValue(p0,p1,p2,p3,t) {
  const u=1-t;return u*u*u*p0+3*u*u*t*p1+3*u*t*t*p2+t*t*t*p3;
}
function cubicExtrema(p0,p1,p2,p3) {
  const a=-p0+3*p1-3*p2+p3,b=2*(p0-2*p1+p2),c=p1-p0;
  if(Math.abs(a)<1e-12)return Math.abs(b)<1e-12?[]:[-c/b].filter(t=>t>0&&t<1);
  const discriminant=b*b-4*a*c;
  if(discriminant<0)return [];
  return [(-b+Math.sqrt(discriminant))/(2*a),(-b-Math.sqrt(discriminant))/(2*a)].filter(t=>t>0&&t<1);
}
function exactPathBounds(d) {
  const tokens=d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g)??[];
  let i=0,command='',x=0,y=0,startX=0,startY=0,minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  const point=(px,py)=>{minX=Math.min(minX,px);maxX=Math.max(maxX,px);minY=Math.min(minY,py);maxY=Math.max(maxY,py);};
  const number=()=>{assert.ok(i<tokens.length&&!/^[a-z]$/i.test(tokens[i]),'Malformed path operands');const n=Number(tokens[i++]);assert.ok(Number.isFinite(n));return n;};
  while(i<tokens.length){
    if(/^[a-z]$/i.test(tokens[i]))command=tokens[i++];
    assert.ok(command,'Path has no command');
    const relative=command===command.toLowerCase(),kind=command.toUpperCase();
    if(kind==='Z'){point(x,y);point(startX,startY);x=startX;y=startY;command='';continue;}
    assert.ok(['M','L','H','V','C'].includes(kind),`Unsupported source command ${command}: audit must be extended`);
    if(kind==='M'||kind==='L'){
      let nx=number(),ny=number();if(relative){nx+=x;ny+=y;}point(nx,ny);x=nx;y=ny;
      if(kind==='M'){startX=x;startY=y;command=relative?'l':'L';}
    }else if(kind==='H'){let nx=number();if(relative)nx+=x;point(nx,y);x=nx;
    }else if(kind==='V'){let ny=number();if(relative)ny+=y;point(x,ny);y=ny;
    }else if(kind==='C'){
      let x1=number(),y1=number(),x2=number(),y2=number(),nx=number(),ny=number();
      if(relative){x1+=x;y1+=y;x2+=x;y2+=y;nx+=x;ny+=y;}
      point(x,y);point(nx,ny);
      for(const t of new Set([...cubicExtrema(x,x1,x2,nx),...cubicExtrema(y,y1,y2,ny)]))point(cubicValue(x,x1,x2,nx,t),cubicValue(y,y1,y2,ny,t));
      x=nx;y=ny;
    }
  }
  assert.ok(Number.isFinite(minX),'No finite source geometry');
  return {minX,minY,maxX,maxY};
}

function mergedBounds(paths) {
  return paths.map(p=>exactPathBounds(p.d)).reduce((a,b)=>({minX:Math.min(a.minX,b.minX),minY:Math.min(a.minY,b.minY),maxX:Math.max(a.maxX,b.maxX),maxY:Math.max(a.maxY,b.maxY)}),{minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity});
}

test('independent exact cubic bounds include curve extrema rather than control-point box',()=>{
  const b=exactPathBounds('M0 0C0 100 100 100 100 0Z');
  assert.equal(b.minX,0);assert.equal(b.maxX,100);assert.equal(b.minY,0);assert.equal(b.maxY,75);
});

test('four raw sheets are losslessly partitioned into ten original subject assets each',async()=>{
  for(const detail of ['S','L'])for(const role of ['main','background']){
    const raw=await readFile(path.join(projectRoot,'raw-svg',`${detail}-${role}.svg`),'utf8');
    const original=svgPathAttributes(raw);
    assert.ok(original.length>600,`${detail}/${role}: source sheet unexpectedly incomplete`);
    const splitPaths=[];
    for(const subject of subjects){
      const file=await readFile(localAssetPath(subject.variants[detail][role].path),'utf8');
      const primitives=svgPathAttributes(file);
      assert.ok(primitives.length>5,`${subject.id}/${detail}/${role}: empty or tiny split`);
      splitPaths.push(...primitives);
    }
    assert.equal(splitPaths.length,original.length,`${detail}/${role}: lost or duplicated path elements`);
    const digest=items=>createHash('sha256').update(JSON.stringify(multiset(items.map(pathSignature)))).digest('hex');
    assert.equal(digest(splitPaths),digest(original),`${detail}/${role}: vector path attributes were modified, omitted or duplicated`);
  }
});

test('every sliced subject viewBox contains its complete exact vector geometry',async()=>{
  for(const subject of subjects)for(const detail of ['S','L'])for(const role of ['main','background']){
    const variant=subject.variants[detail][role];
    const file=await readFile(localAssetPath(variant.path),'utf8');
    assert.doesNotMatch(file,/<(?:image|clipPath)\b/i,`${subject.id}/${detail}/${role}: crop must not conceal the whole source sheet`);
    const root=file.match(/<svg\b([^>]*)>/i);
    const attributes=parseXmlAttributes(root[1]);
    const box=attributes.viewBox.split(/[\s,]+/).map(Number);
    assert.equal(box.length,4);assert.ok(box.every(Number.isFinite));
    const [x,y,w,h]=box;
    assert.ok(w>0&&h>0);
    // Source paths remain in sheet coordinates; slicing changes only the viewBox.
    assert.doesNotMatch(file,/<g\b[^>]*\btransform=/i,`${subject.id}/${detail}/${role}: unexpected geometry transform needs explicit audit`);
    const b=mergedBounds(svgPathAttributes(file));
    const tolerance=1.25;
    assert.ok(b.minX>=x-tolerance&&b.minY>=y-tolerance&&b.maxX<=x+w+tolerance&&b.maxY<=y+h+tolerance,`${subject.id}/${detail}/${role}: bounds ${JSON.stringify(b)} outside viewBox ${box.join(' ')}`);
    const widthRatio=(b.maxX-b.minX)/w,heightRatio=(b.maxY-b.minY)/h;
    assert.ok(widthRatio>.85&&heightRatio>.85,`${subject.id}/${detail}/${role}: excessive empty space or wrong slice`);
    assert.ok(Math.abs(Number(attributes.width)/Number(attributes.height)-w/h)<.005,`${subject.id}/${detail}/${role}: SVG root stretches source aspect ratio`);
    assert.ok(Math.abs(variant.width/variant.height-w/h)<.005,`${subject.id}/${detail}/${role}: catalog metadata stretches source aspect ratio`);
  }
});


const { paletteOptions } = await import('../src/palette-options.js');

test('imported palette remains selectable across custom and built-in selection transitions',()=>{
  const custom={id:'custom-test',name:'Imported palette',background:['#111111','#222222','#333333'],objects:['#444444','#555555','#666666'],ink:'#000000',white:'#FFFFFF'};
  const scene={paletteId:custom.id,customPalette:custom};
  const builtInIds=palettes.map(p=>p.id);
  for(const nextId of [custom.id,...builtInIds,custom.id]){
    scene.paletteId=nextId;
    const options=paletteOptions(scene,palettes);
    assert.deepEqual(options.map(p=>p.id),[...builtInIds,custom.id]);
    assert.equal(options.find(p=>p.id===custom.id),custom);
  }
  assert.deepEqual(palettes.map(p=>p.id),builtInIds,'Selection helper must not mutate catalog palettes');
  assert.deepEqual(paletteOptions({},palettes),palettes);
  assert.notEqual(paletteOptions({},palettes),palettes,'Option list should not expose mutable catalog array');
});

const { identifyImportedPalette } = await import('../src/palette-options.js');
const { getPalette } = await import('../src/svg.js');

test('file-provided built-in palette IDs cannot shadow original schemes',()=>{
  const original={...palettes[0],objects:['#010101','#020202','#030303']};
  let counter=0;
  const makeId=()=>String(++counter);
  const first=identifyImportedPalette(original,makeId);
  const second=identifyImportedPalette(original,makeId);
  assert.notEqual(first.id,original.id);
  assert.notEqual(first.id,second.id);
  assert.ok(first.id.startsWith('custom-'));
  assert.equal(original.id,palettes[0].id,'Import must not mutate the supplied palette object');
  const scene={customPalette:first,paletteId:first.id};
  assert.equal(paletteOptions(scene,palettes).length,palettes.length+1);
  assert.equal(new Set(paletteOptions(scene,palettes).map(p=>p.id)).size,palettes.length+1);
  assert.deepEqual(getPalette(scene).objects,first.objects);
  scene.paletteId=palettes[0].id;
  assert.equal(getPalette(scene),palettes[0],'Built-in scheme must remain recoverable after custom import');
  assert.ok(paletteOptions(scene,palettes).some(p=>p.id===first.id),'Custom scheme must remain recoverable after switching to built-in');
});

test('all forty real assets export in both roles and sizes under every original palette',async()=>{
  const loadAsset=assetPath=>readFile(localAssetPath(assetPath),'utf8');
  for(const detail of ['S','L'])for(const role of ['main','background'])for(const palette of palettes){
    const objects=subjects.map((s,index)=>({id:`real-${index}`,assetId:s.id,x:100+index*100,y:315,rotation:index-5,role}));
    const scene={width:1200,height:630,detail,paletteId:palette.id,backgroundIndex:2,scale:.15,objects};
    const output=await buildSceneSvg(scene,{loadAsset});
    assertVectorSvg(output,`real-${detail}-${role}-${palette.id}`);
    assert.equal((output.match(/data-instance-id=/g)??[]).length,subjects.length);
    const sourceFiles=await Promise.all(subjects.map(s=>loadAsset(s.variants[detail][role].path)));
    assert.equal(svgPathAttributes(output).length,sourceFiles.reduce((sum,file)=>sum+svgPathAttributes(file).length,0),'Real export lost vector paths');
    const allowed=new Set([...palette.background,...palette.objects,palette.ink,palette.white].map(c=>c.toUpperCase()));
    for(const [,paint] of output.matchAll(/\b(?:fill|stroke|stop-color)="(#[0-9a-f]{6})"/gi))assert.ok(allowed.has(paint.toUpperCase()),`Unmapped source paint ${paint} for ${palette.id}`);
  }
});

test('all extracted files match recorded source provenance and SHA-256',async()=>{
  const provenance=JSON.parse((await readFile(path.join(projectRoot,'docs','asset-provenance.json'),'utf8')).replace(/^\uFEFF/,''));
  assert.equal(provenance.sourceFileKey,'Vc5WqbTfcR32TaVNrmEAZm');
  assert.equal(provenance.assets.length,40);
  const variants=new Set();
  for(const entry of provenance.assets){
    const key=`${entry.subjectId}/${entry.detailLevel}/${entry.role}`;
    assert.ok(!variants.has(key),`Duplicate provenance for ${key}`);variants.add(key);
    assert.match(entry.nodeId,/^\d+:\d+$/);
    const bytes=await readFile(path.join(projectRoot,entry.file));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256,`${key}: provenance checksum mismatch`);
    assert.equal(svgPathAttributes(bytes.toString('utf8')).length,entry.sourcePrimitiveCount,`${key}: primitive count mismatch`);
  }
});
