import test from 'node:test';import assert from 'node:assert/strict';import express from 'express';import {once} from 'node:events';
import {performanceReader,readInstagramPerformance} from '../lib/instagram-performance.mjs';import {schedulerRouter} from '../lib/ad-scheduler.mjs';
test('concurrent performance reads coalesce, cache expires, failure clears pending and never serves stale success',async()=>{
 let calls=0,time=0,release;const get=performanceReader({}, {clock:()=>time,read:async()=>{calls++;return new Promise(r=>release=r);}});
 const a=get(),b=get();assert.equal(calls,1);release({ok:true});assert.deepEqual(await a,await b);await get();assert.equal(calls,1);time=60000;const c=get();assert.equal(calls,2);release({ok:true});await c;
 let tries=0;const failed=performanceReader({}, {read:async()=>{tries++;throw Error('SECRET');}});await assert.rejects(failed());await assert.rejects(failed());assert.equal(tries,2);
});
test('disabled reporting refuses database and provider access',async()=>{
 await assert.rejects(readInstagramPerformance({pool:{query:()=>assert.fail('query')},env:{AD_SCHEDULER_META_CONNECTIONS_ENABLED:'false'}}));
});
test('performance HTTP is Admin-only, enabled-only, GET-only, no-store, and sanitizes failures',async()=>{
 let calls=0;const app=express(),admin=(req,res,next)=>req.get('Authorization')==='test'?next():res.sendStatus(401);
 const performance=async()=>{calls++;return {mode:'instagram_metrics_review',publishing_enabled:false,posts_changed:0};};
 app.use('/ok',schedulerRouter({store:{},requireAdmin:admin,enabled:true,publicOrigin:'https://example.test',performance}));
 app.use('/off',schedulerRouter({store:{},requireAdmin:admin,enabled:false,performance}));
 app.use('/bad',schedulerRouter({store:{},requireAdmin:admin,enabled:true,performance:async()=>{throw Error('SECRET');}}));
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+server.address().port,headers={Authorization:'test'};
 try{assert.equal((await fetch(base+'/ok/performance')).status,401);assert.equal(calls,0);assert.equal((await fetch(base+'/off/performance',{headers})).status,503);assert.equal(calls,0);
 const good=await fetch(base+'/ok/performance',{headers});assert.equal(good.status,200);assert.equal(good.headers.get('cache-control'),'no-store');assert.equal((await good.json()).posts_changed,0);assert.equal(calls,1);
 assert.notEqual((await fetch(base+'/ok/performance',{method:'POST',headers})).status,200);assert.equal(calls,1);const bad=await fetch(base+'/bad/performance',{headers});assert.equal(bad.status,503);assert(!(await bad.text()).includes('SECRET'));
 }finally{await new Promise(r=>server.close(r));}
});
