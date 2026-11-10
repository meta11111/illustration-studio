/**
 * Finite offline semantic retrieval and deterministic layout.
 * All geometry comes from catalog variants; every instance shares one scale.
 */
const SUBJECT_TERMS = {
  book: [/^книг/u, /^учебник/u, /^book(?:s)?$/u],
  phone: [/^телефон/u, /^смартфон/u, /^мобильник/u, /^phone(?:s)?$/u, /^smartphone(?:s)?$/u],
  puzzle: [/^паз[з]?л/u, /^мозаик/u, /^puzzle(?:s)?$/u],
  coin: [/^монет/u, /^копейк/u, /^coin(?:s)?$/u],
  headphones: [/^наушник/u, /^гарнитур/u, /^headphones?$/u],
  lamp: [/^ламп/u, /^светильник/u, /^lamp(?:s)?$/u],
  flowers: [/^цвет(?:ок|к|ы|ов|ам|оч)/u, /^букет/u, /^тюльпан/u, /^flower(?:s)?$/u],
  wallet: [/^кошел/u, /^портмон/u, /^wallet(?:s)?$/u],
  folder: [/^папк/u, /^документ/u, /^folder(?:s)?$/u],
  pen: [/^ручк/u, /^pen(?:s)?$/u],
};

const CONCEPTS = [
  { id: 'learning', label: 'обучение и знания', terms: [/^знани/u, /^уч[еи]б/u, /^учить/u, /^учиться/u, /^обуч/u, /^образован/u, /^изуч/u, /^чтен/u, /^читат/u, /^экзамен/u, /^студент/u, /^learning$/u, /^knowledge$/u], scores: { book: 5, pen: 3, lamp: 2 } },
  { id: 'finance', label: 'финансы и сбережения', terms: [/^деньг/u, /^денеж/u, /^сбереж/u, /^эконом/u, /^копить/u, /^накоп/u, /^финанс/u, /^бюджет/u, /^доход/u, /^плат[её]ж/u, /^покуп/u, /^выгод/u, /^инвест/u, /^богат/u, /^money$/u, /^saving/u], scores: { wallet: 5, coin: 4, phone: 1 } },
  { id: 'teamwork', label: 'совместная работа', terms: [/^команд/u, /^сотруднич/u, /^партнер/u, /^совмест/u, /^вместе$/u, /^единств/u, /^объедин/u, /^team/u, /^collaborat/u], scores: { puzzle: 5, phone: 3, folder: 1 } },
  { id: 'assembly', label: 'объединение частей', terms: [/^воедино$/u, /^част[ьи]/u, /^собрат/u, /^собир/u, /^соедин/u, /^целое$/u, /^целост/u, /^решени/u], scores: { puzzle: 4, book: 1 } },
  { id: 'inspiration', label: 'идеи и вдохновение', terms: [/^вдохнов/u, /^иде[яийю]/u, /^твор/u, /^креатив/u, /^придум/u, /^озарен/u, /^inspir/u, /^creative/u, /^idea/u], scores: { lamp: 5, flowers: 3, pen: 2 } },
  { id: 'communication', label: 'общение и связь', terms: [/^связ[ьи]/u, /^общени/u, /^общат/u, /^коммуникац/u, /^разговор/u, /^звон/u, /^контакт/u, /^чат/u, /^онлайн$/u, /^цифров/u, /^communicat/u, /^connect/u], scores: { phone: 5, headphones: 3, puzzle: 1 } },
  { id: 'music', label: 'музыка и внимание', terms: [/^музык/u, /^аудио/u, /^слуш/u, /^подкаст/u, /^звук/u, /^тишин/u, /^концентр/u, /^фокус/u, /^music$/u, /^audio$/u], scores: { headphones: 5, phone: 2, book: 1 } },
  { id: 'organization', label: 'порядок и работа', terms: [/^поряд/u, /^организ/u, /^планир/u, /^план$/u, /^план[аыу]$/u, /^задач/u, /^работ/u, /^офис/u, /^дел[аоу]$/u, /^продуктив/u, /^процесс/u, /^систематиз/u, /^organization$/u], scores: { folder: 5, pen: 3, lamp: 1 } },
  { id: 'care', label: 'забота и благодарность', terms: [/^забот/u, /^благодар/u, /^радост/u, /^подар/u, /^праздник/u, /^поздрав/u, /^уют/u, /^весн/u, /^красот/u, /^care$/u, /^gift$/u], scores: { flowers: 5, book: 1, wallet: 1 } },
  { id: 'writing', label: 'записи и документы', terms: [/^писат/u, /^письм/u, /^запис/u, /^замет/u, /^текст/u, /^договор/u, /^отчет/u, /^согласован/u, /^writing$/u], scores: { pen: 5, folder: 3, book: 2 } },
];
const FILLER = new Set(('и или с со на в во для по из к ко а но без кроме исключая не только пожалуйста добавь добавьте добавить покажи покажите сделай сделайте создай создайте составь собери собрать композицию композиция иллюстрация иллюстрацию объект объекты предмет предметы мне нужны нужен нужна нужно хочу использовать используй большой большая маленький маленькая маленькие главный главные фоновый фоновые фон фоне рядом немного один одна две два три четыре пять плюс про о об the a an and with without please add create').split(' '));
const NEGATORS = new Set(['без', 'кроме', 'исключая', 'without']);
const RESET_NEGATION = new Set(['а', 'но', 'зато', 'плюс']);
const SOURCE_NOTE = 'Локальный смысловой словарь: подбор ограничен темами и предметами исходной библиотеки.';

export function normalizePrompt(value) {
  return String(value ?? '').toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').replace(/[‐‑–—-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokenStates(prompt) {
  const tokens = normalizePrompt(prompt).match(/[\p{L}\p{N}]+|[,;.!?]/gu) ?? [];
  let negative = false;
  return tokens.map((word, index) => {
    if (/^[,;.!?]$/u.test(word) || RESET_NEGATION.has(word)) { negative = false; return { word, negative: false, control: true }; }
    if (NEGATORS.has(word) || (word === 'не' && tokens[index + 1] !== 'только')) { negative = true; return { word, negative: true, control: true }; }
    return { word, negative, control: false };
  });
}

function matchesSubject(word, subject) {
  if ((SUBJECT_TERMS[subject.id] ?? []).some(pattern => pattern.test(word))) return true;
  const terms = [subject.id, subject.name, ...(subject.aliases ?? [])].map(normalizePrompt);
  return terms.some(term => term === word);
}

function unknownChunks(prompt, subjects) {
  const unknown = [];
  let span = [];
  const flush = () => { if (span.length) unknown.push(span.join(' ')); span = []; };
  for (const token of tokenStates(prompt)) {
    const adjective = /^(?:больш|маленьк|главн|фонов|красн|син[ийеюя]|желт|зелен|бел|черн|сиренев|розов|фиолетов|бирюзов|персиков|настольн)/u.test(token.word);
    const known = subjects.some(subject => matchesSubject(token.word, subject));
    if (token.control || token.negative || FILLER.has(token.word) || adjective || known) flush();
    else span.push(token.word);
  }
  flush();
  return [...new Set(unknown)];
}

/**
 * Returns a transparent local retrieval result; never claims general LLM understanding.
 */
export function analyzePrompt({ prompt = '', mode = 'metaphor', subjects = [] } = {}) {
  const normalized = normalizePrompt(prompt);
  if (!normalized) return { selected: [], matchedIds: [], excludedIds: [], concepts: [], confidence: 'none', warnings: ['Введите названия предметов или короткую идею для иллюстрации.'], explanation: 'Пока нечего собирать.', engine: 'local' };
  const states = tokenStates(prompt);
  const directIds = [];
  const excludedIds = new Set();
  for (const token of states) {
    if (token.control) continue;
    for (const subject of subjects) {
      if (!matchesSubject(token.word, subject)) continue;
      if (token.negative) excludedIds.add(subject.id);
      else if (!directIds.includes(subject.id)) directIds.push(subject.id);
    }
  }
  const direct = directIds.filter(id => !excludedIds.has(id));
  const warnings = [];
  if (mode === 'names') {
    const unknown = unknownChunks(prompt, subjects);
    if (unknown.length) warnings.push('Не найдены в библиотеке: ' + unknown.map(value => '«' + value + '»').join(', ') + '.');
    if (direct.length > 5) warnings.push('В одной автокомпозиции размещаем до пяти предметов. Остальные можно добавить вручную.');
    const selected = direct.slice(0, 5).map((id, index) => ({ id, score: 100 - index, reason: 'указан в запросе' }));
    if (!selected.length) warnings.push('Нет подходящих предметов. Попробуйте: книга, телефон, пазлы, монета, наушники, лампа, цветы, кошелёк, папка, ручка.');
    return { selected, matchedIds: selected.map(item => item.id), excludedIds: [...excludedIds], concepts: [], confidence: selected.length ? 'high' : 'none', warnings, explanation: selected.length ? 'Найдены предметы: ' + selected.map(item => subjects.find(subject => subject.id === item.id)?.name ?? item.id).join(', ') + '.' : 'Ни один предмет не распознан; текущая сцена сохранена.', engine: 'local' };
  }

  const positiveTokens = states.filter(token => !token.control && !token.negative).map(token => token.word);
  const activeConcepts = CONCEPTS.filter(concept => positiveTokens.some(word => concept.terms.some(pattern => pattern.test(word))));
  const scores = new Map(direct.map((id, index) => [id, { id, score: 20 - index * 0.1, reason: 'назван в запросе' }]));
  for (const concept of activeConcepts) {
    for (const [id, score] of Object.entries(concept.scores)) {
      if (!subjects.some(subject => subject.id === id) || excludedIds.has(id)) continue;
      const old = scores.get(id);
      scores.set(id, { id, score: (old?.score ?? 0) + score, reason: old?.reason === 'назван в запросе' ? old.reason : concept.label });
    }
  }
  const ranked = [...scores.values()].filter(item => !excludedIds.has(item.id)).sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
  // Preserve named requests; semantic supporting objects must have enough evidence.
  const chosen = ranked.filter(item => direct.includes(item.id) || item.score >= 2).slice(0, 4);
  const selected = chosen.length ? chosen : ranked.slice(0, 1);
  const names = selected.map(item => subjects.find(subject => subject.id === item.id)?.name ?? item.id);
  if (!selected.length) warnings.push('Эта идея не знакома локальному словарю. Уточните тему или перечислите предметы; новые изображения сервис не генерирует.');
  warnings.push(SOURCE_NOTE);
  return {
    selected, matchedIds: selected.map(item => item.id), excludedIds: [...excludedIds],
    concepts: activeConcepts.map(concept => concept.label),
    confidence: direct.length ? 'high' : activeConcepts.length ? 'medium' : 'none',
    warnings,
    explanation: selected.length ? (activeConcepts.length ? 'Тема «' + activeConcepts.map(concept => concept.label).join(' / ') + '». ' : '') + 'Подобраны: ' + names.join(', ') + '. ' + selected.map(item => (subjects.find(subject => subject.id === item.id)?.name ?? item.id) + ' — ' + item.reason).join('; ') + '.' : 'Подбор не выполнен: подходящей темы или предмета нет в словаре. Текущая сцена сохранена.',
    engine: 'local',
  };
}

function hashSeed(value) {
  let hash = 2166136261;
  for (const letter of String(value)) { hash ^= letter.codePointAt(0); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
}
function dimensions(subject, detail) {
  const variant = subject.variants?.[detail]?.main ?? subject.variants?.L?.main ?? subject.variants?.S?.main;
  const multiplier = detail === 'S' && subject.variants?.S?.main ? 2 : 1;
  return { width: Math.max(1, Number(variant?.width) || 640) * multiplier, height: Math.max(1, Number(variant?.height) || 480) * multiplier };
}
function slotsFor(aspect, count, variation) {
  const mirror = variation % 2 ? -1 : 1;
  let slots;
  if (count === 1) slots = [[0.5, 0.5]];
  else if (aspect > 1.4) {
    const layouts = [
      [[.36, .50], [.67, .48], [.79, .25], [.16, .70], [.82, .77]],
      [[.65, .52], [.33, .52], [.18, .25], [.82, .77], [.19, .80]],
      [[.39, .49], [.68, .67], [.70, .23], [.15, .24], [.18, .81]],
    ];
    slots = layouts[variation % layouts.length];
  } else if (aspect < .78) {
    const layouts = [
      [[.46, .38], [.55, .68], [.76, .20], [.22, .77], [.23, .16]],
      [[.53, .63], [.43, .31], [.80, .83], [.21, .16], [.19, .72]],
      [[.48, .42], [.55, .72], [.75, .15], [.19, .70], [.19, .18]],
    ];
    slots = layouts[variation % layouts.length];
  } else {
    const layouts = [
      [[.42, .48], [.68, .68], [.75, .23], [.21, .76], [.22, .18]],
      [[.57, .49], [.31, .70], [.24, .22], [.80, .76], [.78, .19]],
      [[.42, .47], [.69, .64], [.67, .20], [.18, .77], [.20, .18]],
    ];
    slots = layouts[variation % layouts.length];
  }
  return slots.slice(0, count).map(([x, y], index) => ({ x, y, rotation: index === 0 ? 0 : (index % 2 ? -1 : 1) * mirror * (variation % 3 === 2 ? 4 : 0) }));
}

/**
 * positions are centers. scale is common to every source object, never per object.
 */
export function composeScene({
  prompt = '', mode = 'metaphor', subjects = [], width = 1200, height = 630,
  detail = 'L', seed = 0, includeBackground = true,
} = {}) {
  const analysis = analyzePrompt({ prompt, mode, subjects });
  const stageWidth = Math.max(240, Number(width) || 1200);
  const stageHeight = Math.max(240, Number(height) || 630);
  if (!analysis.selected.length) return { objects: [], scale: 1, ...analysis, status: 'no-match' };
  const variation = hashSeed(seed) % 6;
  const rankedItems = analysis.selected.map((item, semanticRank) => ({ ...item, semanticRank, subject: subjects.find(subject => subject.id === item.id) })).filter(item => item.subject);
  const items = rankedItems.length ? [rankedItems[0], ...rankedItems.slice(1).sort((a, b) => { const da = dimensions(a.subject, detail); const db = dimensions(b.subject, detail); return db.width * db.height - da.width * da.height; })] : [];
  const slots = slotsFor(stageWidth / stageHeight, items.length, variation);
  const sizes = items.map(item => dimensions(item.subject, detail));
  // Fit every subject inside the stage at its chosen slot with one shared coefficient.
  // Rotations use a conservative rotated AABB. No relative scale changes.
  const padding = Math.min(stageWidth, stageHeight) * .055;
  let scale = Infinity;
  sizes.forEach((size, index) => {
    const slot = slots[index];
    const radians = slot.rotation * Math.PI / 180;
    const rotatedWidth = Math.abs(size.width * Math.cos(radians)) + Math.abs(size.height * Math.sin(radians));
    const rotatedHeight = Math.abs(size.width * Math.sin(radians)) + Math.abs(size.height * Math.cos(radians));
    const availableWidth = 2 * Math.max(10, Math.min(slot.x * stageWidth - padding, (1 - slot.x) * stageWidth - padding));
    const availableHeight = 2 * Math.max(10, Math.min(slot.y * stageHeight - padding, (1 - slot.y) * stageHeight - padding));
    scale = Math.min(scale, availableWidth / rotatedWidth, availableHeight / rotatedHeight);
  });
  const mainSize = sizes[0];
  const targetArea = items.length === 1 ? .58 : .53;
  scale = Math.min(scale, stageWidth * targetArea / mainSize.width, stageHeight * .73 / mainSize.height);
  scale = Math.max(.01, scale);
  const objects = items.map((item, index) => ({
    id: 'auto-' + hashSeed(String(seed) + ':' + normalizePrompt(prompt) + ':' + item.id + ':' + index).toString(36),
    assetId: item.id,
    x: Math.round(slots[index].x * stageWidth * 100) / 100,
    y: Math.round(slots[index].y * stageHeight * 100) / 100,
    rotation: slots[index].rotation,
    role: includeBackground && item.semanticRank >= 2 && item.subject.variants?.[detail]?.background ? 'background' : 'main',
  }));
  // Put monochrome supporting objects behind the primary objects.
  objects.sort((left, right) => (left.role === 'background' ? 0 : 1) - (right.role === 'background' ? 0 : 1));
  return { ...analysis, objects, scale, status: 'ok', template: stageWidth / stageHeight > 1.4 ? 'landscape' : stageWidth / stageHeight < .78 ? 'portrait' : 'square' };
}



