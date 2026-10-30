import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {validateAlbumCover,albumCoverTemplates} from '../lib/album-cover.mjs';
import {coverForOrder,validateCoverPhoto} from '../lib/cover-photo.mjs';
const source=await readFile(new URL('../server.mjs',import.meta.url),'utf8');
const routes=new Map();let writes=[],exists=true,order={id:'test',status:'Ready',person:'Jamie',song_title:'Our Song',cover_photo:null,album_cover:null};
const auth=()=>{};
const context={validateAlbumCover,albumCoverTemplates,coverForOrder,validateCoverPhoto,requireAdmin:auth,albumCoverFiles:new Map(),Buffer,logError(){},readFile:async()=>Buffer.from('original curated artwork'),buildEditedAlbumCover:async cover=>'rendered:'+JSON.stringify(cover),pool:{query:async(sql,args)=>{
 if(sql.includes('INSERT INTO order_album_covers')){writes.push(args);return {};}
 return {rowCount:exists?1:0,rows:exists?[order]:[]};
}},app:{}};
for(const method of ['get','post','put'])context.app[method]=(path,...handlers)=>routes.set(method+path,{handler:handlers.at(-1),handlers});
vm.createContext(context);
let code=source.slice(source.indexOf('app.get("/api/admin/orders/:id/album-cover"'),source.indexOf('app.get("/api/delivery/:token",'));
code=code.replace(/const albumCoverFiles = new Map\(\[[\s\S]*?\]\);/,'');
vm.runInContext(code,context);
function response(){return {code:200,headers:{},setHeader(k,v){this.headers[k]=v},status(v){this.code=v;return this},type(v){this.headers.type=v;return this},json(v){this.body=v;return this},send(v){this.body=v;return this},sendStatus(v){this.code=v;return this}};}
async function call(method,path,body={},params={id:'test',token:'private',kind:'cover'}){const res=response();await routes.get(method+path).handler({params,body},res);return res;}
for(const [key,value] of routes)if(key.includes('/api/admin/'))assert(value.handlers.includes(auth),key);
let res=await call('get','/api/delivery/:token/cover');assert.equal(res.code,200);assert.match(res.body,/Our Song/);assert.equal(writes.length,0);
order.status='New';assert.equal((await call('get','/api/delivery/:token/cover')).code,403);assert.equal((await call('get','/api/delivery/:token/cover-photo')).code,403);order.status='Ready';
exists=false;assert.equal((await call('get','/api/delivery/:token/cover')).code,404);exists=true;
const fields={template:'other',title:'Our Song',names:'Jamie',message:'',photo:null};
res=await call('post','/api/admin/orders/:id/album-cover/preview',fields);assert.equal(res.code,200);assert.equal(writes.length,0);
res=await call('put','/api/admin/orders/:id/album-cover',{...fields,photo:'https://untrusted/photo.svg'});assert.equal(res.code,400);assert.equal(writes.length,0);
res=await call('put','/api/admin/orders/:id/album-cover',fields);assert.equal(res.code,200);assert.equal(writes[0][5],'');
context.albumCoverFiles.set('test','curated');res=await call('get','/api/delivery/:token/cover');assert.equal(res.body.toString(),'original curated artwork');
order.album_cover=fields;res=await call('get','/api/delivery/:token/cover');assert.match(res.body,/rendered:/);
console.log('PASS: private/Admin guards, ready-state/missing-order checks, default/curated/saved cover precedence, preview isolation, invalid uploads and saved photo removal (mocked database).');
