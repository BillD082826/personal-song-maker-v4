import test from 'node:test';import assert from 'node:assert/strict';import {createHash,randomUUID} from 'node:crypto';import {DeliveryRecords,validateDelivery,validateDeliveryInstallation} from '../lib/ad-delivery-records.mjs';
const bytes=Buffer.from([137,80,78,71,13,10,26,10,1]),hash=createHash('sha256').update(bytes).digest('hex'),now=new Date('2026-11-05T20:00:00Z');
const plan={id:randomUUID(),platform:'instagram',status:'planned',scheduled_at:now,snapshot:{platform:'instagram',caption:'Approved pilot',image_sha256:hash}};
test('delivery binds exact destination, platform, immutable caption and artwork',()=>{
 const d=validateDelivery(plan,bytes,'17841431950776323');assert.equal(d,validateDelivery({...plan,snapshot:{image_sha256:hash,caption:'Approved pilot',platform:'instagram'}},bytes,'17841431950776323'));assert.notEqual(d,validateDelivery({...plan,snapshot:{...plan.snapshot,caption:'Changed'}},bytes,'17841431950776323'));
 for(const [p,b,dest] of [[plan,bytes,'other'],[{...plan,platform:'pinterest'},bytes,'17841431950776323'],[plan,Buffer.from('wrong'),'17841431950776323']])assert.throws(()=>validateDelivery(p,b,dest));
});
test('missing approval refuses all database access',async()=>{await assert.rejects(new DeliveryRecords({connect:()=>assert.fail()}).reserve({planId:plan.id,destination:'17841431950776323'}));});
test('paused canceled early and expired plans are blocked before insert',async()=>{
 for(const patch of [{paused:true},{status:'canceled'},{scheduled_at:new Date(+now+1)},{scheduled_at:new Date(+now-60001)}]){
 const queries=[],db={query:async(q)=>{queries.push(q);return q.includes('settings')?{rows:[{paused:patch.paused||false}]}:q.includes('SELECT *')?{rows:[{...plan,...patch}]}:{rows:[]};},release(){}};
 await assert.rejects(new DeliveryRecords({connect:async()=>db},{clock:()=>now}).reserve({planId:plan.id,destination:'17841431950776323',approved:true}));assert(!queries.some(q=>q.startsWith('INSERT')));assert(queries.includes('ROLLBACK'));
 }
});
test('real isolated PostgreSQL: concurrent claims, restart and terminal uncertain state prevent duplicates',{skip:!process.env.SCHEDULER_TEST_DATABASE_URL},async()=>{
 const {default:pg}=await import('pg');const {SCHEMA}=await import('../lib/ad-scheduler.mjs');const pool=new pg.Pool({connectionString:process.env.SCHEDULER_TEST_DATABASE_URL,options:'-c search_path=lyribop_test_deliveries'});
 try{
 await pool.query('CREATE SCHEMA IF NOT EXISTS lyribop_test_deliveries');await pool.query(SCHEMA);const store=new DeliveryRecords(pool,{clock:()=>now});await store.install();
 await pool.query('INSERT INTO ad_scheduler_media VALUES($1,$2)',[hash,bytes]);await pool.query('INSERT INTO ad_scheduler_plans(id,platform,scheduled_at,local_day,local_time,snapshot,created_at) VALUES($1,$2,$3,$4,$5,$6,$3)',[plan.id,plan.platform,now,'2026-11-05','15:00',JSON.stringify(plan.snapshot)]);
 const input={planId:plan.id,destination:'17841431950776323',approved:true};const r=await Promise.allSettled([store.reserve(input),store.reserve(input)]);assert.equal(r.filter(x=>x.status==='fulfilled').length,1);const claim=r.find(x=>x.status==='fulfilled').value.claim_id;
 const reopened=new DeliveryRecords(pool,{clock:()=>now});await assert.rejects(reopened.reserve(input));
 await reopened.advance({planId:plan.id,claimId:claim,from:'reserved',to:'creating'});await reopened.advance({planId:plan.id,claimId:claim,from:'creating',to:'container_ready',containerId:'123'});
 await pool.query('UPDATE ad_scheduler_settings SET paused=true');await assert.rejects(reopened.advance({planId:plan.id,claimId:claim,from:'container_ready',to:'publishing'}));
 await pool.query('UPDATE ad_scheduler_settings SET paused=false');await pool.query("UPDATE ad_scheduler_plans SET snapshot=jsonb_set(snapshot,'{caption}','\"changed\"') WHERE id=$1",[plan.id]);await assert.rejects(reopened.advance({planId:plan.id,claimId:claim,from:'container_ready',to:'publishing'}));
 await reopened.advance({planId:plan.id,claimId:claim,from:'container_ready',to:'needs_review'});await assert.rejects(reopened.advance({planId:plan.id,claimId:claim,from:'needs_review',to:'publishing'}));await assert.rejects(reopened.reserve(input));
 const rows=(await pool.query('SELECT * FROM ad_scheduler_deliveries')).rows;assert.equal(rows.length,1);assert.equal(rows[0].state,'needs_review');assert.equal(rows[0].container_id,'123');
 }finally{await pool.end();}
});

test('installer matches application default origin while rejecting wrong host and disabled setup',()=>{
 const env={AD_SCHEDULER_ENABLED:'true',DATABASE_URL:'TEST'};assert.doesNotThrow(()=>validateDeliveryInstallation(env));assert.doesNotThrow(()=>validateDeliveryInstallation({...env,PUBLIC_BASE_URL:'https://personal-song-maker-v5-test.onrender.com/'}));
 for(const patch of [{AD_SCHEDULER_ENABLED:'false'},{DATABASE_URL:''},{PUBLIC_BASE_URL:'https://wrong.test'},{PUBLIC_BASE_URL:'http://personal-song-maker-v5-test.onrender.com'}])assert.throws(()=>validateDeliveryInstallation({...env,...patch}));
});
