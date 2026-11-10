import {cp,mkdir,rm,stat,readFile} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=dirname(dirname(fileURLToPath(import.meta.url))),dist=join(root,'dist');
await rm(dist,{recursive:true,force:true});await mkdir(dist,{recursive:true});
for(const file of ['index.html','styles.css'])await cp(join(root,file),join(dist,file));
for(const dir of ['src','assets']){await stat(join(root,dir));await cp(join(root,dir),join(dist,dir),{recursive:true});}
const catalog=await readFile(join(dist,'src','catalog.js'),'utf8');
if(!catalog.includes('export const subjects'))throw new Error('Catalog missing');
console.log('Built static SVG studio in dist/');
