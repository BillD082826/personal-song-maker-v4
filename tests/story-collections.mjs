import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadSchedulerCatalog,HostedScheduler} from '../lib/ad-scheduler.mjs';
import {validateCollection,readCollectionArtwork,mediaHash} from '../lib/story-collections.mjs';
import {DeliveryRecords,validateDelivery,deliverySnapshotHash} from '../lib/ad-delivery-records.mjs';
import {InstagramDeliveryRecords,runScheduledInstagramDelivery,readScheduledInstagramArtwork,checkPublicInstagramArtwork} from '../lib/instagram-scheduled-delivery.mjs';
import {runScheduledFacebookPilot,uploadSavedFacebookCollection} from '../lib/facebook-scheduled-pilot.mjs';
import {pinterestCollectionSlotText,prepareScheduledPinterestDelivery} from '../lib/pinterest-scheduled-delivery.mjs';
import {reviewFacebookPlans} from '../lib/facebook-pilot-review.mjs';
const catalog=await loadSchedulerCatalog(),root='marketing/advertising-dashboard/';
const destinations={instagram:'17841431950776323',facebook:'1271936012676830'};
async function saved(platform){
 const ad=catalog.find(a=>a.platform===platform&&a.images),snapshots=[],media=new Map(),calls=[];
 const db={query:async(sql,args)=>{calls.push(sql);if(sql.startsWith('INSERT INTO ad_scheduler_media'))media.set(args[0],args[1]);if(sql.startsWith('INSERT INTO ad_scheduler_plans'))snapshots.push(JSON.parse(args[5]));return {rows:[],rowCount:1};},release(){}};
 const scheduler=new HostedScheduler({query:async()=>({rows:[]}),connect:async()=>db},{clock:()=>new Date('2026-11-20T12:00:00Z'),pinterestBoards:async()=>({boards:[{id:'123',name:'Songs'}]})});
 await scheduler.add({ad_id:ad.id,platform,slots:[{day:'2026-11-20',time:'13:00'}],...(platform==='pinterest'?{board_id:'123'}:{})});
 const snapshot=snapshots[0],plan={id:'12345678-1234-4234-8234-123456789012',platform,scheduled_at:'2026-11-20T18:00:00Z',snapshot,status:'planned'};
 const pool={query:async(sql,args)=>({rows:sql.includes('ad_scheduler_plans')?[plan]:[{image:media.get(args[0])}]})};
 return {plan,snapshot,media,pool,calls};
}
test('catalog offers four ready collections per platform, each saves four immutable panels in one unapproved plan',async()=>{
 assert.equal(catalog.filter(a=>a.images&&a.ready).length,12);assert.equal(catalog.filter(a=>a.images&&!a.ready).length,6);
 for(const platform of ['facebook','instagram','pinterest']){
  assert.equal(catalog.filter(a=>a.images&&a.ready&&a.platform===platform).length,4);
  const f=await saved(platform);assert.equal(f.media.size,4);assert.equal(f.snapshot.panels.length,4);assert.equal(f.calls.filter(s=>s.startsWith('INSERT INTO ad_scheduler_plans')).length,1);assert(!f.calls.some(s=>/approval|delivery/.test(s)));
  const bytes=await readCollectionArtwork(f.pool,f.snapshot);assert.equal(bytes.length,4);
  const original=deliverySnapshotHash(f.snapshot),changed=structuredClone(f.snapshot);[changed.panels[1],changed.panels[2]]=[changed.panels[2],changed.panels[1]];assert.notEqual(original,deliverySnapshotHash(changed));
  for(const change of [s=>s.panels.pop(),s=>s.panels[1]=s.panels[0],s=>s.panels[0].image='../escape.png']){const s=structuredClone(f.snapshot);change(s);assert.throws(()=>validateCollection(s));}
  f.media.delete(f.snapshot.panels[3].image_sha256);await assert.rejects(readCollectionArtwork(f.pool,f.snapshot));
 }
});
test('Instagram collection uses four verified public JPEGs, ordered child containers and one parent publication; permanent claim prevents retry',async()=>{
 const f=await saved('instagram'),art=await readScheduledInstagramArtwork(f.plan,f.media.get(f.snapshot.image_sha256));assert.equal(art.items.length,4);
 let publicReads=0;await checkPublicInstagramArtwork(art,async url=>{publicReads++;return new Response(art.items.find(i=>i.url===url).bytes,{headers:{'content-type':'image/jpeg'}});});assert.equal(publicReads,4);
 const events=[],states=[];let claimed=false,child=0;
 const graph={createChild:async(_a,url)=>{events.push(url);return {id:String(++child)};},status:async id=>{events.push('ready:'+id);return {status_code:'FINISHED'};},createCarousel:async(_a,ids,caption)=>{assert.deepEqual(ids,['1','2','3','4']);assert.equal(caption,f.snapshot.caption);return {id:'11'};},publish:async()=>{events.push('publish');return {id:'22'};},verify:async()=>({id:'22',owner:{id:destinations.instagram},username:'lyribop',caption:f.snapshot.caption,media_type:'CAROUSEL_ALBUM',children:{data:[1,2,3,4].map(n=>({id:String(n+100),media_type:'IMAGE'}))},permalink:'https://www.instagram.com/p/TEST/'})};
 const args={pool:f.pool,approval:{approved:true,platform:'instagram',destination:destinations.instagram,plan_id:f.plan.id,scheduled_at:f.plan.scheduled_at,snapshot_sha256:validateDelivery(f.plan,f.media.get(f.snapshot.image_sha256),destinations.instagram)},records:{checkCreating:async()=>{},reserve:async()=>{if(claimed)throw Error();claimed=true;return {claim_id:f.plan.id};},advance:async a=>states.push(a.to),rememberContainer:async()=>{}},connections:{withCheckedConnection:async(_p,fn)=>fn({token:'test',accountId:destinations.instagram})},readArtwork:async()=>art,checkPublic:async()=>{},graphFactory:()=>graph,wait:async()=>{}};
 assert.equal((await runScheduledInstagramDelivery(args)).status,'verified');assert.equal(events.filter(e=>e==='publish').length,1);assert.equal(states.at(-1),'verified');await assert.rejects(runScheduledInstagramDelivery(args));assert.equal(child,4);
});
test('missing fourth panel prevents Instagram provider writes before claiming',async()=>{const f=await saved('instagram');f.media.delete(f.snapshot.panels[3].image_sha256);let writes=0;await assert.rejects(runScheduledInstagramDelivery({pool:f.pool,approval:{approved:true,platform:'instagram',destination:destinations.instagram,plan_id:f.plan.id,scheduled_at:f.plan.scheduled_at,snapshot_sha256:deliverySnapshotHash(f.snapshot)},graphFactory:()=>{writes++;}}));assert.equal(writes,0);});
test('Facebook uploads four unpublished temporary photos in order and publishes one attached-media feed post',async()=>{
 const f=await saved('facebook'),images=await readCollectionArtwork(f.pool,f.snapshot);let i=0,published=0;
 const page={token:'test',fetch:async(url,o)=>{assert.equal(o.body.get('published'),'false');assert.equal(o.body.get('temporary'),'true');assert.deepEqual(Buffer.from(await o.body.get('source').arrayBuffer()),images[i++]);return {ok:true,json:async()=>({id:String(i)})};},call:async(path,body)=>{published++;assert.equal(path,'/'+destinations.facebook+'/feed');assert.deepEqual(JSON.parse(body.attached_media),[1,2,3,4].map(n=>({media_fbid:String(n)})));return {id:destinations.facebook+'_99'};}};
 assert.deepEqual((await uploadSavedFacebookCollection(page,images,f.snapshot.caption)).photo_ids,['1','2','3','4']);assert.equal(published,1);
 let claimed=false;const states=[];
 const args={pool:f.pool,approval:{approved:true,platform:'facebook',destination:destinations.facebook,plan_id:f.plan.id,scheduled_at:f.plan.scheduled_at,snapshot_sha256:deliverySnapshotHash(f.snapshot)},connections:{withCheckedConnection:async(_p,fn)=>fn({token:'test',accountId:destinations.facebook})},graphFactory:()=>({page:async()=>page}),records:{checkCreating:async()=>{},reserve:async()=>{if(claimed)throw Error();claimed=true;return {claim_id:f.plan.id};},advance:async a=>states.push(a.to)},uploadCollection:async()=>{throw Error('uncertain third upload');}};
 await assert.rejects(runScheduledFacebookPilot(args));assert.equal(states.at(-1),'needs_review');await assert.rejects(runScheduledFacebookPilot(args));
 const review=reviewFacebookPlans([{...f.plan,image:images[0]}],false,new Date('2026-11-20T12:00Z'),true);assert.equal(review.items[0].panels.length,4);
});
test('Pinterest submits one four-image Pin with ordered saved bytes and validates returned panel order',async()=>{
 const f=await saved('pinterest');let body;
 const env={AD_SCHEDULER_ENABLED:'true',AD_SCHEDULER_PINTEREST_CONNECTIONS_ENABLED:'true',AD_SCHEDULER_PINTEREST_PIN_REVIEW_ENABLED:'true',PINTEREST_APP_ID:'1628874',PINTEREST_APP_SECRET:'test-only',AD_SCHEDULER_TOKEN_KEY:Buffer.alloc(32,1).toString('base64')};
 const graph={preflight:async()=>{},call:async(path,data)=>{assert.equal(path,'/pins');body=data;return {id:'456'};},verify:async()=>({id:'456',board_id:'123',title:f.snapshot.pin_title,description:f.snapshot.caption,link:f.snapshot.destination,is_owner:true,media:{media_type:'multiple_images',items:body.media_source.items.map(i=>({item_type:'image',title:i.title,description:i.description,link:i.link}))}})};
 const prepared=await prepareScheduledPinterestDelivery({pool:f.pool,snapshot:f.snapshot,artwork:f.media.get(f.snapshot.image_sha256),env,publicBase:'https://personal-song-maker-v5-test.onrender.com',store:{boardAuthorization:async()=> 'test'},graphFactory:()=>graph});
 assert.equal(await prepared.create(),'456');assert.equal(body.media_source.index,0);assert.equal(body.media_source.source_type,'multiple_image_base64');assert.equal(body.media_source.items.length,4);assert.equal(f.snapshot.pinterest_collection_text,'caption_v1');body.media_source.items.forEach(i=>assert.equal(i.description,f.snapshot.caption));
 body.media_source.items.forEach((item,i)=>assert.equal(mediaHash(Buffer.from(item.data,'base64')),f.snapshot.panels[i].image_sha256));assert.equal(await prepared.verify('456'),'https://www.pinterest.com/pin/456/');[body.media_source.items[1],body.media_source.items[2]]=[body.media_source.items[2],body.media_source.items[1]];await assert.rejects(prepared.verify('456'));
});
test('Facebook rechecks approval after temporary uploads and refuses the final feed write when revoked',async()=>{const f=await saved('facebook'),images=await readCollectionArtwork(f.pool,f.snapshot);let n=0,feeds=0;const page={token:'test',fetch:async()=>({ok:true,json:async()=>({id:String(++n)})}),call:async()=>{feeds++;}};await assert.rejects(uploadSavedFacebookCollection(page,images,f.snapshot.caption,async()=>{throw Error('revoked');}));assert.equal(n,4);assert.equal(feeds,0);});
test('Instagram partial child creation stops permanently without publishing',async()=>{const f=await saved('instagram');const events=[];let claimed=false;const args={pool:f.pool,approval:{approved:true,platform:'instagram',destination:destinations.instagram,plan_id:f.plan.id,scheduled_at:f.plan.scheduled_at,snapshot_sha256:deliverySnapshotHash(f.snapshot)},records:{checkCreating:async()=>{},reserve:async()=>{if(claimed)throw Error('claimed');claimed=true;return {claim_id:f.plan.id};},advance:async a=>events.push(a.to)},connections:{withCheckedConnection:async(_p,fn)=>fn({token:'test',accountId:destinations.instagram})},checkPublic:async()=>{},graphFactory:()=>({createChild:async()=>{events.push('child');throw Error('uncertain upload');},publish:()=>assert.fail('must not publish')})};await assert.rejects(runScheduledInstagramDelivery(args));assert.equal(events.at(-1),'needs_review');await assert.rejects(runScheduledInstagramDelivery(args));assert.equal(events.filter(e=>e==='child').length,1);});

test('Pinterest caption rendering is versioned so existing approvals retain their original panel text',()=>{const legacy={pin_title:'Gift',caption:'Full promotional caption',destination:'https://example.test/'};assert.equal(pinterestCollectionSlotText(legacy,0).description,'Panel 1 of 4');const current={...legacy,pinterest_collection_text:'caption_v1'};assert.equal(pinterestCollectionSlotText(current,3).description,legacy.caption);assert.match(pinterestCollectionSlotText(current,3).title,/panel 4 of 4/);assert.notEqual(deliverySnapshotHash(legacy),deliverySnapshotHash(current));assert.throws(()=>pinterestCollectionSlotText({...legacy,pinterest_collection_text:'unknown'},0));});

test('Instagram collection processing accepts only its on-time active claim until the five-minute deadline',async()=>{
 const f=await saved('instagram'),due=+new Date(f.plan.scheduled_at),claimId=f.plan.id;
 const claim={plan_id:f.plan.id,claim_id:claimId,platform:'instagram',state:'creating',created_at:new Date(due+30000),scheduled_at:f.plan.scheduled_at,snapshot_sha256:deliverySnapshotHash(f.snapshot)};
 const run=async({elapsed=120000,plan=f.plan,row=claim,paused=false,id=claimId}={})=>{
  const db={query:async(sql,args)=>({rows:sql.includes('ad_scheduler_settings')?[{paused}]:sql.includes('ad_scheduler_plans')?[plan]:sql.includes('ad_scheduler_deliveries')?(row&&args[1]===claimId?[row]:[]):[]})};
  return new DeliveryRecords(null,{clock:()=>new Date(due+elapsed)}).planForUpdate(db,plan.id,{claimId:id});
 };
 await run();await run({elapsed:300000});
 for(const patch of [{elapsed:300001},{elapsed:-1},{id:null},{id:'wrong'},{row:null},{paused:true},{plan:{...f.plan,status:'canceled'}},{plan:{...f.plan,platform:'facebook'}},{plan:{...f.plan,snapshot:{...f.snapshot,format:'single_image'}}},{row:{...claim,created_at:new Date(due+60001)}},{row:{...claim,created_at:new Date(due-1)}},{row:{...claim,state:'needs_review'}},{row:{...claim,state:'verified'}},{row:{...claim,snapshot_sha256:'changed'}},{row:{...claim,scheduled_at:new Date(due+1)}}])await assert.rejects(run(patch));
 // An unclaimed collection still cannot start late, even if an old row happens to exist.
 await assert.rejects(run({id:null,elapsed:60001}));
});

test('creation checks re-read Instagram approval, pause, worker, claim and exact artwork before writes',async()=>{
 const f=await saved('instagram'),due=+new Date(f.plan.scheduled_at),claimId=f.plan.id;
 let paused=false,enabled=true,status='approved',claimState='creating';
 const row={platform:'instagram',state:'creating',created_at:new Date(due+1000),scheduled_at:f.plan.scheduled_at,snapshot_sha256:deliverySnapshotHash(f.snapshot),destination_id:destinations.instagram};
 const db={query:async(sql,args)=>{if(sql.includes('ad_scheduler_settings'))return {rows:[{paused}]};if(sql.includes('ad_scheduler_plans'))return {rows:[f.plan]};if(sql.includes('ad_scheduler_deliveries'))return {rows:[{...row,state:claimState}]};if(sql.includes('ad_scheduler_media'))return {rows:[{image:f.media.get(args[0])}]};if(sql.includes('ad_scheduler_instagram_approvals'))return {rows:[{status,snapshot_sha256:row.snapshot_sha256,destination_id:destinations.instagram,scheduled_at:f.plan.scheduled_at}]};if(sql.includes('ad_scheduler_instagram_worker'))return {rows:[{enabled}]};return {rows:[]};},release(){}};
 const records=new InstagramDeliveryRecords({connect:async()=>db},{clock:()=>new Date(due+120000)}),args={planId:f.plan.id,claimId,requireWorkerEnabled:true};
 await records.checkCreating(args);
 status='revoked';await assert.rejects(records.checkCreating(args));status='approved';
 paused=true;await assert.rejects(records.checkCreating(args));paused=false;
 enabled=false;await assert.rejects(records.checkCreating(args));enabled=true;
 claimState='needs_review';await assert.rejects(records.checkCreating(args));claimState='creating';
 f.media.set(f.snapshot.panels[2].image_sha256,Buffer.from('tampered'));await assert.rejects(records.checkCreating(args));
});

test('revocation during Instagram child processing stops remaining uploads and parent publication',async()=>{
 const f=await saved('instagram');let creates=0,checks=0,parents=0,publications=0;
 const args={pool:f.pool,approval:{approved:true,platform:'instagram',destination:destinations.instagram,plan_id:f.plan.id,scheduled_at:f.plan.scheduled_at,snapshot_sha256:deliverySnapshotHash(f.snapshot)},records:{reserve:async()=>({claim_id:f.plan.id}),advance:async()=>{},rememberContainer:async()=>{},checkCreating:async()=>{if(++checks===3)throw Error('revoked');}},connections:{withCheckedConnection:async(_p,fn)=>fn({token:'test',accountId:destinations.instagram})},checkPublic:async()=>{},graphFactory:()=>({createChild:async()=>({id:String(++creates)}),status:async()=>({status_code:'FINISHED'}),createCarousel:async()=>{parents++;return{id:'20'};},publish:async()=>{publications++;}})};
 await assert.rejects(runScheduledInstagramDelivery(args));assert.equal(creates,2);assert.equal(parents,0);assert.equal(publications,0);assert.equal(checks,3);
});

test('real isolated PostgreSQL: an on-time Instagram collection finishes late, while revocation and expiry still stop it',{skip:!process.env.SCHEDULER_TEST_DATABASE_URL},async()=>{
 const {default:pg}=await import('pg');const {SCHEMA}=await import('../lib/ad-scheduler.mjs');const {DELIVERY_SCHEMA}=await import('../lib/ad-delivery-records.mjs');const {INSTAGRAM_APPROVAL_SCHEMA}=await import('../lib/instagram-scheduler-approvals.mjs');const {WORKER_SCHEMA}=await import('../lib/instagram-hosted-worker.mjs');
 const f=await saved('instagram'),due=+new Date(f.plan.scheduled_at);let now=new Date(due+15000);
 const pool=new pg.Pool({connectionString:process.env.SCHEDULER_TEST_DATABASE_URL,options:'-c search_path=lyribop_collection_window'});
 try{
  await pool.query('CREATE SCHEMA lyribop_collection_window');for(const schema of [SCHEMA,DELIVERY_SCHEMA,INSTAGRAM_APPROVAL_SCHEMA,WORKER_SCHEMA])await pool.query(schema);
  await pool.query('UPDATE ad_scheduler_instagram_worker SET enabled=true WHERE id=1');
  for(const [sha,image]of f.media)await pool.query('INSERT INTO ad_scheduler_media(sha256,image) VALUES($1,$2)',[sha,image]);
  await pool.query('INSERT INTO ad_scheduler_plans(id,platform,scheduled_at,local_day,local_time,snapshot,created_at) VALUES($1,$2,$3,$4,$5,$6,$3)',[f.plan.id,'instagram',f.plan.scheduled_at,'2026-11-20','13:00',f.snapshot]);
  await pool.query('INSERT INTO ad_scheduler_instagram_approvals(plan_id,snapshot_sha256,destination_id,scheduled_at,status,approved_at) VALUES($1,$2,$3,$4,$5,$6)',[f.plan.id,deliverySnapshotHash(f.snapshot),destinations.instagram,f.plan.scheduled_at,'approved',new Date(due-10000)]);
  const records=new InstagramDeliveryRecords(pool,{clock:()=>now}),guards={requireSavedApproval:true,requireWorkerEnabled:true};
  const claim=await records.reserve({planId:f.plan.id,destination:destinations.instagram,approved:true,...guards});const key={planId:f.plan.id,claimId:claim.claim_id};
  await records.advance({...key,from:'reserved',to:'creating',...guards});now=new Date(due+90000);await records.checkCreating({...key,requireWorkerEnabled:true});
  await pool.query("UPDATE ad_scheduler_instagram_approvals SET status='revoked'");await assert.rejects(records.checkCreating({...key,requireWorkerEnabled:true}));await pool.query("UPDATE ad_scheduler_instagram_approvals SET status='approved'");
  await pool.query('UPDATE ad_scheduler_instagram_worker SET enabled=false');await assert.rejects(records.checkCreating({...key,requireWorkerEnabled:true}));await pool.query('UPDATE ad_scheduler_instagram_worker SET enabled=true');
  await pool.query('UPDATE ad_scheduler_settings SET paused=true');await assert.rejects(records.checkCreating({...key,requireWorkerEnabled:true}));await pool.query('UPDATE ad_scheduler_settings SET paused=false');
  now=new Date(due+180000);await records.advance({...key,from:'creating',to:'container_ready',containerId:'123',...guards});await records.advance({...key,from:'container_ready',to:'publishing',...guards});
  now=new Date(due+300001);await assert.rejects(records.checkPublishing({...key,requireWorkerEnabled:true}));await assert.rejects(records.reserve({planId:f.plan.id,destination:destinations.instagram,approved:true,...guards}));
  await records.advance({...key,from:'publishing',to:'needs_review'});assert.equal((await pool.query('SELECT state FROM ad_scheduler_deliveries')).rows[0].state,'needs_review');assert.equal((await pool.query('SELECT count(*)::int AS count FROM ad_scheduler_deliveries')).rows[0].count,1);
 }finally{await pool.end();}
});
