import { subjects, palettes, sourcePaletteId } from './catalog.js';
const SVG_NS = 'http://www.w3.org/2000/svg';
const assetCache = new Map();
const safeNumber = (v,label) => {const n=Number(v);if(!Number.isFinite(n))throw new Error('Некорректное значение: '+label);return n;};
const xml = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const escapeRegex = value => value.replace(/[.*+?^$()|[\]\\{}]/g,'\\$&');
export function getVariant(subject, detail='L', role='main') {
  const variant=subject?.variants?.[detail]?.[role] ?? subject?.variants?.[detail]?.main;
  if(!variant)throw new Error('Отсутствует исходный SVG-вариант: '+subject?.id);
  return variant;
}
export function displaySize(subject,detail='L',role='main') {
  const v=getVariant(subject,detail,role), unit=detail==='S'?2:1;
  return {width:v.width*unit,height:v.height*unit};
}
export function validatePalette(input) {
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Палитра должна быть JSON-объектом');
  const color=c=>typeof c==='string'&&/^#[0-9a-f]{6}$/i.test(c);
  for(const key of ['background','objects'])if(!Array.isArray(input[key])||input[key].length!==3||!input[key].every(color))throw new Error(key+': нужны три цвета #RRGGBB');
  if(!color(input.ink??'#181817')||!color(input.white??'#FFFFFF'))throw new Error('ink и white должны быть цветами #RRGGBB');
  return {id:typeof input.id==='string'?input.id:'custom-'+Date.now(),name:String(input.name??'Моя палитра').slice(0,80),background:input.background.map(c=>c.toUpperCase()),objects:input.objects.map(c=>c.toUpperCase()),ink:(input.ink??'#181817').toUpperCase(),white:(input.white??'#FFFFFF').toUpperCase()};
}
export function getPalette(scene) {
  if(scene.customPalette && scene.paletteId===scene.customPalette.id)return validatePalette(scene.customPalette);
  return palettes.find(p=>p.id===scene.paletteId)??palettes[0];
}
export function recolorSvg(svg, palette) {
  const source=palettes.find(p=>p.id===sourcePaletteId)??palettes[0];
  const mapping=new Map();
  source.background.forEach((color,i)=>mapping.set(color.toUpperCase(),palette.background[i]));
  source.objects.forEach((color,i)=>mapping.set(color.toUpperCase(),palette.objects[i]));
  mapping.set(source.ink.toUpperCase(),palette.ink);mapping.set(source.white.toUpperCase(),palette.white);
  const replacePaint=paint=>paint.replace(/\bwhite\b/gi,palette.white).replace(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi,c=>{
    const normalized=c.length===4?'#'+[...c.slice(1)].map(x=>x+x).join(''):c;
    return mapping.get(normalized.toUpperCase())??c;
  });
  return svg.replace(/\b(fill|stroke|stop-color|color)\s*=\s*(["'])(.*?)\2/gi,(m,key,q,value)=>key+'='+q+replacePaint(value)+q)
    .replace(/\bstyle\s*=\s*(["'])(.*?)\1/gi,(m,q,style)=>'style='+q+style.replace(/((?:fill|stroke|stop-color|color)\s*:\s*)([^;]+)/gi,(match,key,value)=>key+replacePaint(value))+q);
}
export function namespaceSvg(svg, prefix) {
  const ids=[...svg.matchAll(/\bid\s*=\s*(["'])(.*?)\1/g)].map(m=>m[2]);
  let result=svg;
  for(const id of [...new Set(ids)].sort((a,b)=>b.length-a.length)){
    const escaped=escapeRegex(id), next=prefix+'-'+id;
    result=result.replace(new RegExp('(\\bid\\s*=\\s*["\\x27])'+escaped+'(["\\x27])','g'),'$1'+next+'$2');
    result=result.replace(new RegExp('url\\(\\s*(["\\x27]?)#'+escaped+'\\1\\s*\\)','g'),'url(#'+next+')');
    result=result.replace(new RegExp('((?:xlink:)?href\\s*=\\s*["\\x27])#'+escaped+'(["\\x27])','g'),'$1#'+next+'$2');
  }
  return result;
}
export function assertVectorAsset(svg) {
  if(typeof svg!=='string'||!/<svg\b/i.test(svg))throw new Error('Файл не является SVG');
  if(/<(?:image|script|foreignObject|iframe)\b/i.test(svg))throw new Error('SVG содержит растровый или активный контент');
  if(/\son[a-z]+\s*=/i.test(svg)||/(?:href|src)\s*=\s*["'](?:https?:|data:|javascript:)/i.test(svg))throw new Error('SVG содержит внешние ссылки или активный контент');
  if(/data:image/i.test(svg))throw new Error('Векторный экспорт не допускает растровые вложения');
}
async function loadAssetDefault(path) {
  let promise=assetCache.get(path);
  if(!promise){
    promise=fetch(path).then(r=>{if(!r.ok)throw new Error('Не удалось загрузить '+path);return r.text();});
    assetCache.set(path,promise);promise.catch(()=>assetCache.delete(path));
  }
  return promise;
}
export async function buildSceneSvg(scene,{loadAsset=loadAssetDefault,interactive=false}={}) {
  const width=safeNumber(scene.width,'ширина'),height=safeNumber(scene.height,'высота'),scale=safeNumber(scene.scale,'масштаб');
  if(width<64||height<64||width>10000||height>10000||scale<=0||scale>20)throw new Error('Параметры холста вне допустимого диапазона');
  if(!['L','S'].includes(scene.detail))throw new Error('Неизвестная детализация');
  if(!Array.isArray(scene.objects)||scene.objects.length>100)throw new Error('Неверный список объектов');
  const palette=getPalette(scene),bg=palette.background[Math.max(0,Math.min(2,Math.floor(Number(scene.backgroundIndex)||0)))];
  const chunks=await Promise.all(scene.objects.map(async(object,index)=>{
    const subject=subjects.find(s=>s.id===object.assetId);
    if(!subject)throw new Error('Неизвестный объект: '+object.assetId);
    const role=object.role==='background'?'background':'main',variant=getVariant(subject,scene.detail,role);
    let source=await loadAsset(variant.path);assertVectorAsset(source);
    source=recolorSvg(source,palette);
    const unique='inst'+index+'-'+String(object.id).replace(/[^a-z0-9_-]/gi,'_');
    source=namespaceSvg(source,unique);
    const root=source.match(/<svg\b([^>]*)>([\s\S]*?)<\/svg\s*>/i);
    if(!root)throw new Error('Некорректный SVG '+subject.id);
    const viewBox=root[1].match(/\bviewBox\s*=\s*["']([^"']+)["']/i)?.[1]??'0 0 '+variant.width+' '+variant.height;
    const unit=scene.detail==='S'?2:1,w=variant.width*unit,h=variant.height*unit;
    const x=safeNumber(object.x,'x'),y=safeNumber(object.y,'y'),rotation=safeNumber(object.rotation??0,'поворот');
    const rootAttrs=root[1].replace(/\b(?:width|height|x|y|viewBox|xmlns(?::\w+)?)\s*=\s*(["']).*?\1/gi,'').trim();
    const title='<title>'+xml(subject.name)+'</title>';
    return '<g data-instance-id="'+xml(object.id)+'" data-asset-id="'+xml(subject.id)+'" data-role="'+role+'" transform="translate('+x+' '+y+') rotate('+rotation+') scale('+scale+')"'+(interactive?' tabindex="0" role="graphics-symbol" aria-label="'+xml(subject.name)+'"':'')+'>'+title+'<svg x="'+(-w/2)+'" y="'+(-h/2)+'" width="'+w+'" height="'+h+'" viewBox="'+xml(viewBox)+'" '+rootAttrs+'>'+root[2]+'</svg></g>';
  }));
  return '<svg xmlns="'+SVG_NS+'" xmlns:xlink="http://www.w3.org/1999/xlink" width="'+width+'" height="'+height+'" viewBox="0 0 '+width+' '+height+'" role="img" aria-label="Векторная композиция"><title>Векторная композиция</title><desc>Композиция из исходных векторных объектов; геометрия сохранена.</desc><rect data-scene-background="true" width="'+width+'" height="'+height+'" fill="'+bg+'"/>'+chunks.join('')+'</svg>';
}
export async function renderScene(scene,options={}) {
  const text=await buildSceneSvg(scene,options);
  const doc=new DOMParser().parseFromString(text,'image/svg+xml');
  if(doc.querySelector('parsererror'))throw new Error('Ошибка сборки векторной композиции');
  return document.importNode(doc.documentElement,true);
}
export const exportScene = scene => buildSceneSvg(scene);
export function downloadText(text,filename,type='image/svg+xml') {
  const url=URL.createObjectURL(new Blob([text],{type}));
  const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
