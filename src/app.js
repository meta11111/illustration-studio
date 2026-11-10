import {subjects,palettes} from './catalog.js';
import {uuid} from './scene.js';
import {renderScene,exportScene,downloadText,displaySize,validatePalette} from './svg.js';
import {composeScene} from './composer.js';
import {paletteOptions,identifyImportedPalette} from './palette-options.js';

const root=document.getElementById('app');
const formats={wide:[1200,630],square:[1000,1000],portrait:[800,1200]};
let scene={width:1200,height:630,detail:'L',paletteId:'violet',backgroundIndex:0,scale:.42,objects:[]};
let selected=null,mode='metaphor',prompt='',query='',seed=0,message='Выберите объекты или введите идею.',busy=false;
let undo=[],redo=[],renderTicket=0;
try { const saved=JSON.parse(localStorage.getItem('sobrano-scene')||'null');if(saved&&Array.isArray(saved.objects)&&saved.width>0&&saved.height>0)scene=saved; }catch{}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const subject=id=>subjects.find(s=>s.id===id);
const findSelected=()=>scene.objects.find(o=>o.id===selected);
function commit(next){undo.push(JSON.stringify(scene));if(undo.length>80)undo.shift();redo=[];scene=next;localStorage.setItem('sobrano-scene',JSON.stringify(scene));update();}
function patch(updateObject){commit({...scene,objects:scene.objects.map(o=>o.id===selected?{...o,...updateObject}:o)});}
function add(id){const s=subject(id);if(!s)return;const size=displaySize(s,scene.detail);const factor=Math.min(scene.scale,scene.width*.48/size.width,scene.height*.52/size.height);const object={id:uuid(),assetId:id,role:'main',x:scene.width/2+(scene.objects.length%3-1)*scene.width*.12,y:scene.height/2,rotation:0};selected=object.id;commit({...scene,scale:factor,objects:[...scene.objects,object]});}
function shapeIcon(name){const paths={search:'<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',download:'<path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4"/>',spark:'<path d="m12 2 2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z"/>',plus:'<path d="M12 4v16M4 12h16"/>',trash:'<path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7"/>',duplicate:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>',arrow:'<path d="m7 14 5-5 5 5"/>',undo:'<path d="M8 7 3 12l5 5M3 12h11a6 6 0 0 1 0 12"/>',close:'<path d="m5 5 14 14M19 5 5 19"/>'};return '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(paths[name]||'')+'</svg>';}
function options(){return paletteOptions(scene,palettes);}
function template(){
 const current=findSelected(),palette=options().find(p=>p.id===scene.paletteId)||palettes[0],format=Object.entries(formats).find(([,d])=>d[0]===scene.width&&d[1]===scene.height)?.[0]||'wide';
 const filtered=subjects.filter(s=>(s.name+' '+s.id+' '+(s.aliases||[]).join(' ')).toLowerCase().includes(query.toLowerCase()));
 return '<header class="topbar"><div class="brand"><div class="brand-icon">с.</div><div><div class="brand-name">собрано</div><div class="brand-caption">векторная мастерская</div></div></div><div class="top-status"><span class="status-dot"></span> Исходные SVG • локальный режим</div><div class="top-actions"><button class="button secondary" data-action="demo">Демо</button><button class="button primary" data-action="export">'+shapeIcon('download')+' Скачать SVG</button></div></header>'+
 '<div class="page-heading"><div><p class="eyebrow">Конструктор иллюстраций</p><h1>Идеи из готовых деталей</h1><p class="subtitle">Соберите композицию из исходных векторных объектов — вручную или по смыслу.</p></div><span class="step-hint">10 объектов · 3 палитры · 2 размера</span></div>'+
 '<main class="shell"><div class="workbench"><aside class="library"><div class="panel-heading"><h2>Библиотека</h2><span class="count-badge">'+subjects.length+' предметов</span></div><label class="searchbox"><span class="sr-only">Поиск объекта</span><input id="search" value="'+esc(query)+'" placeholder="Найти предмет..."></label><div class="asset-grid">'+(filtered.length?filtered.map(s=>'<button class="asset-card" data-add="'+esc(s.id)+'" title="Добавить: '+esc(s.name)+'"><span class="asset-thumb"><img src="'+esc(s.variants?.[scene.detail]?.main?.path)+'" alt=""></span><span class="asset-label">'+esc(s.name)+'</span><span class="asset-add">+</span></button>').join(''):'<p class="empty-search">Такого предмета в библиотеке нет.</p>')+'</div><p class="library-note">Предметы взяты из исходного файла Figma. Их форма остаётся прежней.</p></aside>'+
 '<section class="workspace"><div class="prompt-area"><div class="prompt-header"><div class="segmented"><button data-mode="metaphor" class="'+(mode==='metaphor'?'selected':'')+'">По смыслу</button><button data-mode="names" class="'+(mode==='names'?'selected':'')+'">По названиям</button></div><span class="local-tag">Локальный подбор: понимает ограниченный набор тем</span></div><div class="prompt-row"><label class="prompt-input-wrap"><span class="sr-only">Идея композиции</span><input id="prompt" class="prompt-input" placeholder="'+(mode==='metaphor'?'Например: собрать знания воедино':'Например: книга, телефон, пазлы')+'" value="'+esc(prompt)+'"></label><button class="button primary compose-button" data-action="compose" '+(busy?'disabled':'')+'>'+shapeIcon('spark')+' Собрать</button></div><div class="prompt-examples"><span>Попробуйте:</span><button data-example="Собрать знания воедино">Собрать знания воедино</button><button data-example="Команда собирает решение">Команда собирает решение</button><button data-example="Накопить на мечту">Накопить на мечту</button></div></div>'+
 '<div class="canvas-toolbar"><div class="toolbar-group"><label class="field-label" for="format">Формат</label><select id="format" class="toolbar-select"><option value="wide" '+(format==='wide'?'selected':'')+'>Горизонтальный</option><option value="square" '+(format==='square'?'selected':'')+'>Квадрат</option><option value="portrait" '+(format==='portrait'?'selected':'')+'>Вертикальный</option></select><span class="toolbar-divider"></span><span class="field-label">Детализация</span><div class="detail-switch"><button data-detail="S" class="'+(scene.detail==='S'?'selected':'')+'">S</button><button data-detail="L" class="'+(scene.detail==='L'?'selected':'')+'">L</button></div></div><div class="toolbar-group"><button class="button icon" data-action="undo" title="Отменить" '+(!undo.length?'disabled':'')+'>↶</button><button class="button icon" data-action="redo" title="Повторить" '+(!redo.length?'disabled':'')+'>↷</button><button class="button icon" data-action="variation" title="Другой вариант">⟳</button></div></div>'+
 '<div class="canvas-zone"><div class="stage-shell" id="stage" style="aspect-ratio:'+scene.width+'/'+scene.height+'"><div id="stage-content" class="stage-content"></div></div></div><div class="canvas-footer"><span>'+scene.width+' × '+scene.height+' · SVG</span><span class="shortcut-hint">Перетаскивайте объекты на холсте · Delete — удалить</span></div></section>'+
 '<aside class="inspector"><div class="inspector-section"><div class="panel-heading"><h2>Цветовая схема</h2></div><div class="palette-list">'+options().map(p=>'<button data-palette="'+esc(p.id)+'" class="palette-choice '+(p.id===scene.paletteId?'active':'')+'" title="'+esc(p.name)+'" aria-label="'+esc(p.name)+'"><span style="background:'+p.background[0]+'"></span><span style="background:'+p.objects[0]+'"></span><span style="background:'+p.objects[1]+'"></span></button>').join('')+'</div><label class="field-label" for="background">Фон</label><select id="background" class="toolbar-select"><option value="0" '+(scene.backgroundIndex===0?'selected':'')+'>Светлый</option><option value="1" '+(scene.backgroundIndex===1?'selected':'')+'>Средний</option><option value="2" '+(scene.backgroundIndex===2?'selected':'')+'>Яркий</option></select><button class="button secondary small" data-action="palette-import">Загрузить палитру JSON</button><input id="palette-file" type="file" accept=".json,application/json" hidden></div>'+
 '<div class="inspector-section layers-section"><div class="panel-heading"><h2>Слои</h2><span class="count-badge">'+scene.objects.length+'</span></div><div class="layers-list">'+(scene.objects.length?scene.objects.slice().reverse().map(o=>'<button data-select="'+esc(o.id)+'" class="layer-item '+(selected===o.id?'active':'')+'"><span class="layer-dot" style="background:'+(o.role==='main'?palette.objects[1]:palette.background[2])+'"></span><span>'+esc(subject(o.assetId)?.name||o.assetId)+'</span><small>'+(o.role==='main'?'Главный':'Фоновый')+'</small></button>').join(''):'<p class="empty-search">Здесь появятся добавленные предметы.</p>')+'</div></div>'+
 '<div class="inspector-section"><div class="panel-heading"><h2>Объект</h2></div>'+(current?'<div class="properties"><strong>'+esc(subject(current.assetId)?.name)+'</strong><label>Роль<select id="role"><option value="main" '+(current.role==='main'?'selected':'')+'>Главный</option><option value="background" '+(current.role==='background'?'selected':'')+'>Фоновый</option></select></label><label>Поворот, °<input type="number" id="rotation" min="-180" max="180" value="'+current.rotation+'"></label><div class="property-actions"><button class="button secondary small" data-action="up">Выше</button><button class="button secondary small" data-action="down">Ниже</button><button class="button secondary small" data-action="duplicate">Дублировать</button><button class="button secondary small" data-action="delete">Удалить</button></div></div>':'<p class="empty-search">Выделите предмет на холсте.</p>')+'</div></aside></div>'+
 '<div class="composition-info"><span class="info-copy" role="status">'+esc(message)+'</span><span>Локальный подбор: темы и слова из словаря, без внешнего API.</span></div><footer class="site-footer">Исходные векторы предоставлены для тестового задания · <a href="https://www.figma.com/design/Vc5WqbTfcR32TaVNrmEAZm/" target="_blank" rel="noopener">Figma</a></footer></main>';
}
async function update(){
 const ticket=++renderTicket;root.innerHTML=template();bind();
 try{const svg=await renderScene(scene,{interactive:true});if(ticket!==renderTicket)return;
 const stage=document.getElementById('stage-content');if(stage){stage.replaceChildren(svg);stage.querySelectorAll('[data-instance-id]').forEach(g=>g.classList.toggle('is-selected',g.getAttribute('data-instance-id')===selected));bindStage(svg);}
 }catch(error){if(ticket===renderTicket){const stage=document.getElementById('stage-content');if(stage)stage.innerHTML='<p class="render-error">'+esc(error.message)+'</p>';}}
}
function recomposition(){if(!prompt.trim()){message='Введите идею или названия предметов.';update();return;}const out=composeScene({prompt,mode,subjects,width:scene.width,height:scene.height,detail:scene.detail,seed:seed++,includeBackground:true});message=(out.explanation||'')+' '+(out.warnings||[]).join(' ');if(out.status==='ok'){selected=null;commit({...scene,objects:out.objects,scale:out.scale});}else update();}
function history(direction){const source=direction==='undo'?undo:redo,target=direction==='undo'?redo:undo;if(!source.length)return;target.push(JSON.stringify(scene));scene=JSON.parse(source.pop());selected=null;localStorage.setItem('sobrano-scene',JSON.stringify(scene));update();}
async function importPalette(file){try{const parsed=identifyImportedPalette(validatePalette(JSON.parse(await file.text())),uuid);commit({...scene,customPalette:parsed,paletteId:parsed.id});message='Палитра загружена.';update();}catch(error){message='Ошибка палитры: '+error.message;update();}}
const demos=[['Собрать знания воедино','wide','violet'],['Накопить на мечту','square','peach'],['Команда собирает решение','portrait','turquoise']];let demoIndex=0;
function runDemo(){const [p,f,color]=demos[demoIndex++%demos.length];prompt=p;mode='metaphor';const [width,height]=formats[f];const out=composeScene({prompt,mode,subjects,width,height,detail:scene.detail,seed:demoIndex,includeBackground:true});message='Демо '+((demoIndex-1)%demos.length+1)+'/3 · '+out.explanation;commit({...scene,width,height,paletteId:color,objects:out.objects,scale:out.scale});}
function bind(){
 root.querySelector('#search')?.addEventListener('input',e=>{query=e.target.value;const selection=[e.target.selectionStart,e.target.selectionEnd];update();const field=document.getElementById('search');field?.focus();field?.setSelectionRange(...selection);});
 root.querySelector('#prompt')?.addEventListener('input',e=>prompt=e.target.value);
 root.querySelector('#prompt')?.addEventListener('keydown',e=>{if(e.key==='Enter')recomposition();});
 root.querySelectorAll('[data-add]').forEach(el=>el.addEventListener('click',()=>add(el.dataset.add)));
 root.querySelectorAll('[data-select]').forEach(el=>el.addEventListener('click',()=>{selected=el.dataset.select;update();}));
 root.querySelectorAll('[data-mode]').forEach(el=>el.addEventListener('click',()=>{mode=el.dataset.mode;update();}));
 root.querySelectorAll('[data-detail]').forEach(el=>el.addEventListener('click',()=>commit({...scene,detail:el.dataset.detail})));
 root.querySelectorAll('[data-palette]').forEach(el=>el.addEventListener('click',()=>commit({...scene,paletteId:el.dataset.palette})));
 root.querySelectorAll('[data-example]').forEach(el=>el.addEventListener('click',()=>{prompt=el.dataset.example;mode='metaphor';recomposition();}));
 root.querySelector('#format')?.addEventListener('change',e=>{const [width,height]=formats[e.target.value];commit({...scene,width,height,objects:scene.objects.map(o=>({...o,x:o.x*width/scene.width,y:o.y*height/scene.height}))});});
 root.querySelector('#background')?.addEventListener('change',e=>commit({...scene,backgroundIndex:Number(e.target.value)}));
 root.querySelector('#role')?.addEventListener('change',e=>patch({role:e.target.value}));
 root.querySelector('#rotation')?.addEventListener('change',e=>patch({rotation:Number(e.target.value)||0}));
 root.querySelector('#palette-file')?.addEventListener('change',e=>{if(e.target.files?.[0])importPalette(e.target.files[0]);});
 root.querySelectorAll('[data-action]').forEach(el=>el.addEventListener('click',async()=>{
 switch(el.dataset.action){
 case 'compose':recomposition();break;case 'variation':if(prompt)recomposition();else {message='Введите идею для нового варианта.';update();}break;
 case 'demo':runDemo();break;case 'palette-import':document.getElementById('palette-file')?.click();break;
 case 'export':try{downloadText(await exportScene(scene),'sobrano-composition.svg');message='SVG сохранён: контуры остались векторами.';update();}catch(error){message='Экспорт: '+error.message;update();}break;
 case 'undo':history('undo');break;case 'redo':history('redo');break;
 case 'delete':if(selected){commit({...scene,objects:scene.objects.filter(o=>o.id!==selected)});selected=null;update();}break;
 case 'duplicate':if(findSelected()){const o=findSelected();const copy={...o,id:uuid(),x:o.x+25,y:o.y+25};selected=copy.id;commit({...scene,objects:[...scene.objects,copy]});}break;
 case 'up':case 'down':if(selected){const list=[...scene.objects],i=list.findIndex(o=>o.id===selected),j=i+(el.dataset.action==='up'?1:-1);if(j>=0&&j<list.length){[list[i],list[j]]=[list[j],list[i]];commit({...scene,objects:list});}}break;
 }
 }));
}
function bindStage(svg){
 let dragging=null;
 svg.addEventListener('pointerdown',e=>{
 const group=e.target.closest('[data-instance-id]');if(!group){selected=null;update();return;}
 selected=group.getAttribute('data-instance-id');const object=findSelected();if(!object)return;
 const point=svg.createSVGPoint();point.x=e.clientX;point.y=e.clientY;const pos=point.matrixTransform(svg.getScreenCTM().inverse());
 dragging={id:selected,dx:pos.x-object.x,dy:pos.y-object.y,start:JSON.stringify(scene)};
 svg.setPointerCapture(e.pointerId);svg.querySelectorAll('[data-instance-id]').forEach(g=>g.classList.toggle('is-selected',g===group));
 });
 svg.addEventListener('pointermove',e=>{if(!dragging)return;const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const pos=p.matrixTransform(svg.getScreenCTM().inverse());const object=findSelected();if(!object)return;
 object.x=Math.max(-scene.width,Math.min(scene.width*2,Math.round(pos.x-dragging.dx)));object.y=Math.max(-scene.height,Math.min(scene.height*2,Math.round(pos.y-dragging.dy)));
 const g=svg.querySelector('[data-instance-id="'+CSS.escape(object.id)+'"]');if(g)g.setAttribute('transform','translate('+object.x+' '+object.y+') rotate('+object.rotation+') scale('+scene.scale+')');
 });
 svg.addEventListener('pointerup',()=>{if(!dragging)return;undo.push(dragging.start);redo=[];localStorage.setItem('sobrano-scene',JSON.stringify(scene));dragging=null;update();});
 svg.addEventListener('pointercancel',()=>{dragging=null;update();});
}
window.addEventListener('keydown',e=>{if(e.target instanceof HTMLElement&&['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;if((e.key==='Delete'||e.key==='Backspace')&&selected){commit({...scene,objects:scene.objects.filter(o=>o.id!==selected)});selected=null;update();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();history(e.shiftKey?'redo':'undo');}});
window.__studio={getScene:()=>structuredClone(scene),compose:(text,kind='metaphor')=>{prompt=text;mode=kind;recomposition();},demo:runDemo,exportSvg:()=>exportScene(scene)};
update();


