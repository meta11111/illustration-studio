import { subjects, palettes } from './catalog.js';
export const uuid = () => globalThis.crypto?.randomUUID?.() ?? 'object-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
export function createScene(overrides = {}) {
  return { width:1200, height:630, detail:'L', paletteId:palettes[0]?.id, backgroundIndex:0, scale:0.45, objects:[], ...overrides };
}
export function addObject(scene, assetId, role='main') {
  if (!subjects.some(s=>s.id===assetId)) throw new Error('Неизвестный объект');
  return {...scene, objects:[...scene.objects,{id:uuid(),assetId,x:scene.width/2,y:scene.height/2,rotation:0,role}]};
}
export function fitScene(scene) {
  if (!scene.objects.length) return scene;
  let maxW=1,maxH=1;
  for (const object of scene.objects) {
    const s=subjects.find(s=>s.id===object.assetId);
    const v=s?.variants?.[scene.detail]?.[object.role] ?? s?.variants?.[scene.detail]?.main;
    if (!v) continue;
    const unit=scene.detail==='S'?2:1;
    maxW=Math.max(maxW,v.width*unit); maxH=Math.max(maxH,v.height*unit);
  }
  return {...scene, scale:Math.min(scene.width*0.7/maxW,scene.height*0.7/maxH)};
}
