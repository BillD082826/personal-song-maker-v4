import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { HostedScheduler, schedulerRouter, schedulerPages, resolveScheduledTime, validatePlan, loadSchedulerCatalog } from '../lib/ad-scheduler.mjs';
const now=new Date('2026-10-31T12:00:00Z');

test('Eastern scheduling preserves daylight saving, rejects repeated/skipped hours and past/out-of-range days',()=>{
 assert.equal(resolveScheduledTime('2026-10-31','09:00',now),'2026-10-31T13:00:00.000Z');
 assert.equal(resolveScheduledTime('2026-11-01','09:00',now),'2026-11-01T14:00:00.000Z');
 for(const [d,t] of [['2026-11-01','01:30'],['2026-11-07','09:00'],['2026-10-31','07:00'],['2026-10-32','09:00'],['2026-11-01','24:00']])assert.throws(()=>resolveScheduledTime(d,t,now));
 assert.throws(()=>resolveScheduledTime('2027-03-14','02:30',new Date('2027-03-13T12:00:00Z')));
});
test('63 slots validate across three platforms; Draft, wrong platform, malformed metadata and duplicate slots fail',async()=>{
 const catalog=await loadSchedulerCatalog();let total=0;
 for(const platform of ['facebook','instagram','pinterest']){
  const ad=catalog.find(a=>a.platform===platform&&a.ready);
  const slots=Array.from({length:7},(_,i)=>['09:00','13:00','18:00'].map(time=>({day:new Date(+new Date('2026-10-31T12:00:00Z')+i*86400000).toISOString().slice(0,10),time}))).flat();
  total+=validatePlan({ad_id:ad.id,platform,slots},catalog,now).slots.length;
  assert.throws(()=>validatePlan({ad_id:ad.id,platform,slots:[slots[0],slots[0]]},catalog,now));
 }
 assert.equal(total,63);
 assert.throws(()=>validatePlan({ad_id:8,platform:'pinterest',slots:[{day:'2026-10-31',time:'09:00'}]},catalog,now));
 const a=catalog.find(a=>a.platform==='pinterest'&&a.ready);
 for(const destination of ['javascript:alert(1)','https://user:password@example.com'])assert.throws(()=>validatePlan({ad_id:a.id,platform:a.platform,slots:[{day:'2026-10-31',time:'09:00'}],destination},catalog,now));
});
test('SQL batch rollback and connection release on conflict, artwork saved with immutable caption snapshot',async()=>{
 const calls=[];const ad=(await loadSchedulerCatalog()).find(a=>a.platform==='facebook'&&a.ready);
 const db={query:async(sql,args)=>{calls.push([sql,args]);if(sql.startsWith('INSERT INTO ad_scheduler_plans')){const e=new Error('database detail');e.code='23505';throw e;}},release(){calls.push(['RELEASE']);}};
 const pool={query:async sql=>{calls.push([sql]);return {rows:[]};},connect:async()=>db};
 const store=new HostedScheduler(pool,{clock:()=>now});
 await assert.rejects(store.add({ad_id:ad.id,platform:ad.platform,caption:'Saved wording',slots:[{day:'2026-10-31',time:'09:00'}]}),/No new plans were saved/);
 assert(calls.some(([s])=>s==='ROLLBACK'));assert(!calls.some(([s])=>s==='COMMIT'));assert.equal(calls.at(-1)[0],'RELEASE');
 const media=calls.find(([s])=>s.startsWith('INSERT INTO ad_scheduler_media'));
 assert(Buffer.isBuffer(media[1][1]));
 const insert=calls.find(([s])=>s.startsWith('INSERT INTO ad_scheduler_plans'));
 assert.equal(JSON.parse(insert[1][5]).caption,'Saved wording');
});
test('state has no publication claim and past-due plans require review',async()=>{
 const pool={query:async sql=> sql.startsWith('SELECT paused')?{rows:[{paused:false}]}:sql.startsWith('SELECT *')?{rows:[{id:'example',status:'planned',scheduled_at:new Date('2026-10-31T10:00:00Z'),snapshot:{}}]}:{rows:[]}};
 const state=await new HostedScheduler(pool,{clock:()=>now}).state();
 assert.equal(state.hosting_mode,'hosted');assert.equal(state.publishing_enabled,false);assert.deepEqual(state.verified_posts,[]);assert.equal(state.plans[0].display_status,'Past due — review required');
});

test('hosted HTTP requires Admin, canonical Origin and explicit enablement; no publishing endpoint',async()=>{
 let writes=0;
 const admin=(req,res,next)=>req.get('Authorization')==='Basic test'?next():res.status(401).end();
 const store={state:async()=>({publishing_enabled:false,plans:[]}),pause:async()=>{writes++;},add:async()=>{writes++;return 1;},artwork:async()=>null};
 const app=express();app.use(express.json());
 app.use('/api/admin/ad-scheduler',schedulerRouter({store,requireAdmin:admin,enabled:true,publicOrigin:'https://lyribop.example'}));
 app.use('/disabled',schedulerRouter({store,requireAdmin:admin,enabled:false,publicOrigin:'https://lyribop.example'}));
 app.use('/admin/ad-scheduler',schedulerPages({requireAdmin:admin,enabled:true}));
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
 const headers={Authorization:'Basic test','Content-Type':'application/json','X-LyriBop-Scheduler':'1',Origin:'https://lyribop.example'};
 try{
  assert.equal((await fetch(base+'/api/admin/ad-scheduler')).status,401);
  assert.equal((await fetch(base+'/disabled',{headers})).status,503);
  assert.equal((await fetch(base+'/api/admin/ad-scheduler/pause',{method:'POST',headers:{...headers,Origin:'https://evil.example'},body:'{"paused":true}'})).status,403);
  assert.equal((await fetch(base+'/api/admin/ad-scheduler/pause',{method:'POST',headers:{...headers,'X-LyriBop-Scheduler':''},body:'{"paused":true}'})).status,403);
  assert.equal(writes,0);
  assert.equal((await fetch(base+'/api/admin/ad-scheduler/pause',{method:'POST',headers,body:'{"paused":true}'})).status,200);assert.equal(writes,1);
  assert.equal((await fetch(base+'/api/admin/ad-scheduler/publish',{method:'POST',headers,body:'{}'})).status,404);
  assert.equal((await fetch(base+'/admin/ad-scheduler/',{headers})).status,200);
  assert.equal((await fetch(base+'/admin/ad-scheduler/scheduler.js',{headers})).status,200);
  const ad=(await loadSchedulerCatalog())[0];assert.equal((await fetch(base+'/admin/ad-scheduler/'+ad.image,{headers})).status,200);
  assert.equal((await fetch(base+'/admin/ad-scheduler/.scheduler-data/plans.sqlite3',{headers})).status,404);
  assert.equal((await fetch(base+'/admin/ad-scheduler/ads.json',{headers})).status,404);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});

test('real isolated PostgreSQL: 63 durable plans, transaction rollback, concurrent conflict, stored artwork and restart', {skip:!process.env.SCHEDULER_TEST_DATABASE_URL}, async()=>{
 const {default:pg}=await import('pg');
 const pool=new pg.Pool({connectionString:process.env.SCHEDULER_TEST_DATABASE_URL});
 try{
  const store=new HostedScheduler(pool,{clock:()=>now});await store.ready();
  const catalog=await loadSchedulerCatalog();
  for(const platform of ['facebook','instagram','pinterest']){
   const ad=catalog.find(a=>a.platform===platform&&a.ready);
   const slots=Array.from({length:7},(_,i)=>['09:00','13:00','18:00'].map(time=>({day:new Date(+new Date('2026-10-31T12:00:00Z')+i*86400000).toISOString().slice(0,10),time}))).flat();
   assert.equal(await store.add({ad_id:ad.id,platform,slots}),21);
  }
  const state=await new HostedScheduler(pool,{clock:()=>now}).state();assert.equal(state.plans.length,63);assert.deepEqual(state.verified_posts,[]);
  const first=state.plans[0];const bytes=await store.artwork(first.snapshot.image_sha256);
  assert(bytes.equals(await readFile(new URL('../marketing/advertising-dashboard/'+first.snapshot.image,import.meta.url))));
  const ad=catalog.find(a=>a.platform==='facebook'&&a.ready);
  await assert.rejects(store.add({ad_id:ad.id,platform:ad.platform,slots:[{day:'2026-11-01',time:'11:00'},{day:'2026-11-01',time:'09:00'}]}),/No new plans were saved/);
  assert.equal((await store.state()).plans.length,63);
  const input={ad_id:ad.id,platform:ad.platform,slots:[{day:'2026-11-01',time:'11:00'}]};
  const results=await Promise.allSettled([store.add(input),store.add(input)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  await store.pause(true);assert.equal((await store.state()).paused,true);
  await store.cancel(first.id);assert.equal((await store.state()).plans.find(p=>p.id===first.id).status,'canceled');
  assert.equal((await store.state()).publishing_enabled,false);
 }finally{await pool.end();}
});
