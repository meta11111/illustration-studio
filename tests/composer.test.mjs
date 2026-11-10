import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzePrompt, composeScene } from '../src/composer.js';

const names = {
  book: ['Книга', 1446, 977], phone: ['Телефон', 797, 462],
  puzzle: ['Пазлы', 544, 314], coin: ['Монета', 287, 189],
  headphones: ['Наушники', 888, 692], lamp: ['Лампа', 946, 1129],
  flowers: ['Цветы', 591, 747], wallet: ['Кошелёк', 630, 396],
  folder: ['Папка', 1241, 659], pen: ['Ручка', 508, 285],
};
const subjects = Object.entries(names).map(([id, [name, width, height]]) => ({
  id, name, aliases: [], tags: [], variants: {
    L: { main: { width, height }, background: { width, height } },
    S: { main: { width: width / 2, height: height / 2 }, background: { width: width / 2, height: height / 2 } },
  },
}));

test('explicit names support inflections, ё, plurals and synonyms', () => {
  const result = analyzePrompt({ prompt: 'Книгу, смартфон, паззлы и кошелек', mode: 'names', subjects });
  assert.deepEqual(result.matchedIds, ['book', 'phone', 'puzzle', 'wallet']);
  assert.equal(result.confidence, 'high');
});
test('named unknown objects produce a warning and never invented IDs', () => {
  const result = analyzePrompt({ prompt: 'книга, чемодан', mode: 'names', subjects });
  assert.deepEqual(result.matchedIds, ['book']);
  assert.match(result.warnings.join(' '), /чемодан/u);
});
test('без, кроме and не exclude direct and semantic subjects', () => {
  for (const prompt of ['Книга без телефона и ручки', 'Книга, кроме телефона', 'не телефон, а книга']) {
    const result = analyzePrompt({ prompt, mode: 'names', subjects });
    assert.deepEqual(result.matchedIds, ['book']);
    assert.ok(result.excludedIds.includes('phone'));
  }
  const semantic = analyzePrompt({ prompt: 'Общение без телефона', mode: 'metaphor', subjects });
  assert.ok(!semantic.matchedIds.includes('phone'));
});
test('не только does not exclude an explicitly named object', () => {
  assert.ok(analyzePrompt({ prompt: 'не только книга, но и телефон', mode: 'names', subjects }).matchedIds.includes('book'));
});
test('punctuation resets negation scope', () => {
  assert.deepEqual(analyzePrompt({ prompt: 'без телефона, книга', mode: 'names', subjects }).matchedIds, ['book']);
});
test('unknown and empty metaphors do not produce a random scene', () => {
  for (const prompt of ['', 'абракадабра жираф гиперпространство', 'космический корабль у Сатурна']) {
    const result = composeScene({ prompt, subjects });
    assert.equal(result.status, 'no-match');
    assert.deepEqual(result.objects, []);
    assert.ok(result.warnings.length);
  }
});
test('knowledge metaphor retrieves book and puzzle and explains the limited engine', () => {
  const result = analyzePrompt({ prompt: 'Собрать знания воедино', subjects });
  assert.ok(result.matchedIds.includes('book'));
  assert.ok(result.matchedIds.includes('puzzle'));
  assert.match(result.warnings.join(' '), /Локальный смысловой словарь/u);
  assert.match(result.explanation, /обучение и знания/u);
});
test('savings and teamwork choose different explainable subjects', () => {
  const finance = analyzePrompt({ prompt: 'Как накопить сбережения', subjects });
  const team = analyzePrompt({ prompt: 'Совместная работа в команде', subjects });
  assert.ok(finance.matchedIds.includes('wallet') && finance.matchedIds.includes('coin'));
  assert.ok(team.matchedIds.includes('puzzle') && team.matchedIds.includes('phone'));
});
test('composition is deterministic and variants change layout', () => {
  const request = { prompt: 'книга, телефон, пазлы', mode: 'names', subjects, width: 1200, height: 630, seed: 4 };
  assert.deepEqual(composeScene(request), composeScene(request));
  assert.notDeepEqual(composeScene(request).objects, composeScene({ ...request, seed: 5 }).objects);
});
test('layout has only source IDs, unique instance IDs and one global scale', () => {
  const result = composeScene({ prompt: 'книга, телефон, пазлы, лампа, ручка', mode: 'names', subjects });
  assert.equal(result.objects.length, 5);
  assert.equal(new Set(result.objects.map(object => object.id)).size, 5);
  assert.ok(result.scale > 0 && Number.isFinite(result.scale));
  for (const object of result.objects) {
    assert.ok(subjects.some(subject => subject.id === object.assetId));
    assert.ok(!('scale' in object) && !('scaleX' in object) && !('scaleY' in object));
  }
});
test('source proportions remain identical between L and equivalent S variants', () => {
  const request = { prompt: 'книга, телефон, пазлы', mode: 'names', subjects, seed: 2 };
  assert.equal(composeScene({ ...request, detail: 'L' }).scale, composeScene({ ...request, detail: 'S' }).scale);
  assert.deepEqual(composeScene({ ...request, detail: 'L' }).objects, composeScene({ ...request, detail: 'S' }).objects);
});
test('objects fit wide, square and portrait scenes after rotation', () => {
  for (const [width, height] of [[1200, 630], [1000, 1000], [900, 1200]]) {
    for (let seed = 0; seed < 6; seed++) {
      const result = composeScene({ prompt: 'книга, телефон, пазлы, лампа, ручка', mode: 'names', subjects, width, height, seed });
      for (const object of result.objects) {
        const source = subjects.find(subject => subject.id === object.assetId).variants.L.main;
        const radians = object.rotation * Math.PI / 180;
        const halfW = (Math.abs(source.width * Math.cos(radians)) + Math.abs(source.height * Math.sin(radians))) * result.scale / 2;
        const halfH = (Math.abs(source.width * Math.sin(radians)) + Math.abs(source.height * Math.cos(radians))) * result.scale / 2;
        assert.ok(object.x - halfW >= 0 && object.x + halfW <= width);
        assert.ok(object.y - halfH >= 0 && object.y + halfH <= height);
      }
    }
  }
});
test('background option can be switched off and background objects are behind main ones', () => {
  const request = { prompt: 'книга, телефон, пазлы, ручка', mode: 'names', subjects };
  assert.ok(composeScene({ ...request, includeBackground: false }).objects.every(object => object.role === 'main'));
  const objects = composeScene({ ...request, includeBackground: true }).objects;
  assert.equal(objects[0].role, 'background');
  assert.equal(objects.at(-1).role, 'main');
});
test('partial catalogs cannot invent unavailable subjects', () => {
  const result = composeScene({ prompt: 'сбережения', subjects: subjects.filter(subject => subject.id === 'coin') });
  assert.deepEqual(result.matchedIds, ['coin']);
});

test('mixed known and unknown names are reported even without commas', () => {
  for (const prompt of ['книга дракон', 'книга и дракон', 'book dragon']) {
    const result = analyzePrompt({ prompt, mode: 'names', subjects });
    assert.deepEqual(result.matchedIds, ['book']);
    assert.ok(result.warnings.some(warning => /дракон|dragon/u.test(warning)));
  }
});
test('exclusion list preserves negation across and', () => {
  assert.deepEqual(analyzePrompt({ prompt: 'без телефона и книги', mode: 'names', subjects }).matchedIds, []);
});
