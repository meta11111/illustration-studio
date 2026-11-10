import test from 'node:test';
import assert from 'node:assert/strict';
import {changeObjectRole,resizeSceneToFormat} from '../src/scene-operations.js';
import {subjects} from '../src/catalog.js';
import {displaySize} from '../src/svg.js';

test('role changes place background below main while retaining other layer order', () => {
  const scene={objects:[
    {id:'a',role:'background'}, {id:'b',role:'main'},
    {id:'c',role:'main'}, {id:'d',role:'main'},
  ]};
  const lowered=changeObjectRole(scene,'c','background');
  assert.deepEqual(lowered.objects.map(o=>o.id),['a','c','b','d']);
  assert.deepEqual(lowered.objects.map(o=>o.role),['background','background','main','main']);
  const raised=changeObjectRole(lowered,'a','main');
  assert.deepEqual(raised.objects.map(o=>o.id),['c','b','d','a']);
  assert.deepEqual(scene.objects.map(o=>o.id),['a','b','c','d']);
});

test('safe format change preserves proportional positions and common scale', () => {
  const scene={width:1200,height:630,detail:'L',scale:.1,objects:[
    {id:'one',assetId:'coin',role:'main',x:600,y:315,rotation:0},
  ]};
  const next=resizeSceneToFormat(scene,1000,1000);
  assert.equal(next.scale,scene.scale);
  assert.equal(next.objects[0].x,500);
  assert.equal(next.objects[0].y,500);
  assert.equal(scene.width,1200);
});

test('portrait switch keeps rotated edge objects inside canvas with one scale', () => {
  const scene={width:1200,height:630,detail:'L',scale:.8,objects:[
    {id:'one',assetId:'book',role:'main',x:1160,y:40,rotation:35},
    {id:'two',assetId:'lamp',role:'background',x:80,y:590,rotation:-25},
  ]};
  const next=resizeSceneToFormat(scene,800,1200);
  assert.ok(next.scale<=scene.scale);
  for(const object of next.objects){
    const subject=subjects.find(s=>s.id===object.assetId);
    const size=displaySize(subject,next.detail,object.role);
    const angle=object.rotation*Math.PI/180;
    const halfWidth=next.scale*(Math.abs(size.width*Math.cos(angle))+Math.abs(size.height*Math.sin(angle)))/2;
    const halfHeight=next.scale*(Math.abs(size.width*Math.sin(angle))+Math.abs(size.height*Math.cos(angle)))/2;
    assert.ok(object.x-halfWidth>=0 && object.x+halfWidth<=next.width,object.id+' horizontal bounds');
    assert.ok(object.y-halfHeight>=0 && object.y+halfHeight<=next.height,object.id+' vertical bounds');
  }
  assert.equal(scene.objects[0].x,1160);
});
