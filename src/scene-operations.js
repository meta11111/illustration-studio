import {subjects} from './catalog.js';
import {displaySize} from './svg.js';

// Scene order is bottom to top. Keep the relative order of the other objects.
export function changeObjectRole(scene, id, role) {
  if (!['main', 'background'].includes(role)) throw new Error('Unknown object role');
  const object = scene.objects.find(item => item.id === id);
  if (!object) return scene;
  const changed = {...object, role};
  const remaining = scene.objects.filter(item => item.id !== id);
  const firstMain = remaining.findIndex(item => item.role !== 'background');
  const index = role === 'background' ? (firstMain < 0 ? remaining.length : firstMain) : remaining.length;
  remaining.splice(index, 0, changed);
  return {...scene, objects: remaining};
}

// Preserve proportional positions and the common scale when possible. If a
// narrower format cannot fit an object, shrink every object by the same factor.
export function resizeSceneToFormat(scene, width, height, catalog = subjects) {
  if (![width, height].every(value => Number.isFinite(value) && value > 0)) throw new Error('Invalid scene dimensions');
  const mapped = scene.objects.map(object => ({
    ...object,
    x: object.x * width / scene.width,
    y: object.y * height / scene.height,
  }));
  const sizes = mapped.map(object => {
    const subject = catalog.find(item => item.id === object.assetId);
    if (!subject) throw new Error('Unknown source object: ' + object.assetId);
    const size = displaySize(subject, scene.detail, object.role);
    const angle = (Number(object.rotation) || 0) * Math.PI / 180;
    return {
      width: Math.abs(size.width * Math.cos(angle)) + Math.abs(size.height * Math.sin(angle)),
      height: Math.abs(size.width * Math.sin(angle)) + Math.abs(size.height * Math.cos(angle)),
    };
  });
  const padding = Math.min(width, height) * .025;
  const maxScale = sizes.reduce((scale, size) => Math.min(scale,
    (width - 2 * padding) / size.width,
    (height - 2 * padding) / size.height), scene.scale);
  const scale = Math.max(.001, maxScale);
  const objects = mapped.map((object, index) => {
    const halfWidth = sizes[index].width * scale / 2;
    const halfHeight = sizes[index].height * scale / 2;
    return {...object,
      x: Math.max(halfWidth + padding, Math.min(width - halfWidth - padding, object.x)),
      y: Math.max(halfHeight + padding, Math.min(height - halfHeight - padding, object.y)),
    };
  });
  return {...scene, width, height, scale, objects};
}
