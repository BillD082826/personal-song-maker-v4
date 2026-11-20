import express from 'express';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import {publicNotFound} from '../lib/public-not-found.mjs';
const app=express();app.use(express.static('public'));app.get('/health',(_req,res)=>res.json({ok:true}));app.use(publicNotFound);app.use((_req,res)=>res.status(404).json({error:'Route not found'}));
const server=app.listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+server.address().port;
try{
 let r=await fetch(base+'/missing-page',{headers:{accept:'text/html'}});assert.equal(r.status,404);assert.equal(r.headers.get('x-robots-tag'),'noindex');let text=await r.text();assert.ok(text.includes('Page Not Found | LyriBop'));assert.ok(text.includes('href="/"'));assert.ok(text.includes('href="/order.html"'));
 r=await fetch(base+'/missing-page',{method:'HEAD',headers:{accept:'text/html'}});assert.equal(r.status,404);assert.equal(await r.text(),'');
 for(const [path,options] of [['/api/missing',{headers:{accept:'text/html'}}],['/admin/missing',{headers:{accept:'text/html'}}],['/missing-page',{method:'POST'}],['/missing-page',{headers:{accept:'application/json'}}]]){r=await fetch(base+path,options);assert.equal(r.status,404);assert.deepEqual(await r.json(),{error:'Route not found'});}
 r=await fetch(base+'/health');assert.deepEqual(await r.json(),{ok:true});
 r=await fetch(base+'/order.html');assert.equal(r.status,200);text=await r.text();assert.ok(text.includes('label for="alternateStyle"'));assert.ok(!text.includes('noindex,nofollow'));assert.ok(text.includes('rel="canonical"'));
 console.log('PASS HTML/HEAD missing-page handling, API/admin/POST exclusions, existing pages and health route.');
}finally{await new Promise(resolve=>server.close(resolve));}
