import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadSchedulerCatalog,HostedScheduler} from '../lib/ad-scheduler.mjs';
import {validateCollection,readCollectionArtwork,mediaHash} from '../lib/story-collections.mjs';
import {validateDelivery,deliverySnapshotHash} from '../lib/ad-delivery-records.mjs';
import {runScheduledInstagramDelivery,readScheduledInstagramArtwork,checkPublicInstagramArtwork} from '../lib/instagram-scheduled-delivery.mjs';
import {runScheduledFacebookPilot,uploadSavedFacebookCollection} from '../lib/facebook-scheduled-pilot.mjs';
import {prepareScheduledPinterestDelivery} from '../lib/pinterest-scheduled-delivery.mjs';
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
 assert.equal(catalog.filter(a=>a.images).length,12);
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
 const args={pool:f.pool,approval:{approved:true,platform:'instagram',destination:destinations.instagram,plan_id:f.plan.id,scheduled_at:f.plan.scheduled_at,snapshot_sha256:validateDelivery(f.plan,f.media.get(f.snapshot.image_sha256),destinations.instagram)},records:{reserve:async()=>{if(claimed)throw Error();claimed=true;return {claim_id:f.plan.id};},advance:async a=>states.push(a.to),rememberContainer:async()=>{}},connections:{withCheckedConnection:async(_p,fn)=>fn({token:'test',accountId:destinations.instagram})},readArtwork:async()=>art,checkPublic:async()=>{},graphFactory:()=>graph,wait:async()=>{}};
 assert.equal((await runScheduledInstagramDelivery(args)).status,'verified');assert.equal(events.filter(e=>e==='publish').length,1);assert.equal(states.at(-1),'verified');await assert.rejects(runScheduledInstagramDelivery(args));assert.equal(child,4);
});
test('missing fourth panel prevents Instagram provider writes before claiming',async()=>{const f=await saved('instagram');f.media.delete(f.snapshot.panels[3].image_sha256);let writes=0;await assert.rejects(runScheduledInstagramDelivery({pool:f.pool,approval:{approved:true,platform:'instagram',destination:destinations.instagram,plan_id:f.plan.id,scheduled_at:f.plan.scheduled_at,snapshot_sha256:deliverySnapshotHash(f.snapshot)},graphFactory:()=>{writes++;}}));assert.equal(writes,0);});
test('Facebook uploads four unpublished temporary photos in order and publishes one attached-media feed post',async()=>{
 const f=await saved('facebook'),images=await readCollectionArtwork(f.pool,f.snapshot);let i=0,published=0;
 const page={token:'test',fetch:async(url,o)=>{assert.equal(o.body.get('published'),'false');assert.equal(o.body.get('temporary'),'true');assert.deepEqual(Buffer.from(await o.body.get('source').arrayBuffer()),images[i++]);return {ok:true,json:async()=>({id:String(i)})};},call:async(path,body)=>{published++;assert.equal(path,'/'+destinations.facebook+'/feed');assert.deepEqual(JSON.parse(body.attached_media),[1,2,3,4].map(n=>({media_fbid:String(n)})));return {id:destinations.facebook+'_99'};}};
 assert.deepEqual((await uploadSavedFacebookCollection(page,images,f.snapshot.caption)).photo_ids,['1','2','3','4']);assert.equal(published,1);
 let claimed=false;const states=[];
 const args={pool:f.pool,approval:{approved:true,platform:'facebook',destination:destinations.facebook,plan_id:f.plan.id,scheduled_at:f.plan.scheduled_at,snapshot_sha256:deliverySnapshotHash(f.snapshot)},connections:{withCheckedConnection:async(_p,fn)=>fn({token:'test',accountId:destinations.facebook})},graphFactory:()=>({page:async()=>page}),records:{reserve:async()=>{if(claimed)throw Error();claimed=true;return {claim_id:f.plan.id};},advance:async a=>states.push(a.to)},uploadCollection:async()=>{throw Error('uncertain third upload');}};
 await assert.rejects(runScheduledFacebookPilot(args));assert.equal(states.at(-1),'needs_review');await assert.rejects(runScheduledFacebookPilot(args));
 const review=reviewFacebookPlans([{...f.plan,image:images[0]}],false,new Date('2026-11-20T12:00Z'),true);assert.equal(review.items[0].panels.length,4);
});
test('Pinterest submits one four-image Pin with ordered saved bytes and validates returned panel order',async()=>{
 const f=await saved('pinterest');let body;
 const env={AD_SCHEDULER_ENABLED:'true',AD_SCHEDULER_PINTEREST_CONNECTIONS_ENABLED:'true',AD_SCHEDULER_PINTEREST_PIN_REVIEW_ENABLED:'true',PINTEREST_APP_ID:'1628874',PINTEREST_APP_SECRET:'test-only',AD_SCHEDULER_TOKEN_KEY:Buffer.alloc(32,1).toString('base64')};
 const graph={preflight:async()=>{},call:async(path,data)=>{assert.equal(path,'/pins');body=data;return {id:'456'};},verify:async()=>({id:'456',board_id:'123',title:f.snapshot.pin_title,description:f.snapshot.caption,link:f.snapshot.destination,is_owner:true,media:{media_type:'multiple_images',items:body.media_source.items.map(i=>({item_type:'image',description:i.description,link:i.link}))}})};
 const prepared=await prepareScheduledPinterestDelivery({pool:f.pool,snapshot:f.snapshot,artwork:f.media.get(f.snapshot.image_sha256),env,publicBase:'https://personal-song-maker-v5-test.onrender.com',store:{boardAuthorization:async()=> 'test'},graphFactory:()=>graph});
 assert.equal(await prepared.create(),'456');assert.equal(body.media_source.index,0);assert.equal(body.media_source.source_type,'multiple_image_base64');assert.equal(body.media_source.items.length,4);
 body.media_source.items.forEach((item,i)=>assert.equal(mediaHash(Buffer.from(item.data,'base64')),f.snapshot.panels[i].image_sha256));assert.equal(await prepared.verify('456'),'https://www.pinterest.com/pin/456/');[body.media_source.items[1],body.media_source.items[2]]=[body.media_source.items[2],body.media_source.items[1]];await assert.rejects(prepared.verify('456'));
});
test('Facebook rechecks approval after temporary uploads and refuses the final feed write when revoked',async()=>{const f=await saved('facebook'),images=await readCollectionArtwork(f.pool,f.snapshot);let n=0,feeds=0;const page={token:'test',fetch:async()=>({ok:true,json:async()=>({id:String(++n)})}),call:async()=>{feeds++;}};await assert.rejects(uploadSavedFacebookCollection(page,images,f.snapshot.caption,async()=>{throw Error('revoked');}));assert.equal(n,4);assert.equal(feeds,0);});
test('Instagram partial child creation stops permanently without publishing',async()=>{const f=await saved('instagram');const events=[];let claimed=false;const args={pool:f.pool,approval:{approved:true,platform:'instagram',destination:destinations.instagram,plan_id:f.plan.id,scheduled_at:f.plan.scheduled_at,snapshot_sha256:deliverySnapshotHash(f.snapshot)},records:{reserve:async()=>{if(claimed)throw Error('claimed');claimed=true;return {claim_id:f.plan.id};},advance:async a=>events.push(a.to)},connections:{withCheckedConnection:async(_p,fn)=>fn({token:'test',accountId:destinations.instagram})},checkPublic:async()=>{},graphFactory:()=>({createChild:async()=>{events.push('child');throw Error('uncertain upload');},publish:()=>assert.fail('must not publish')})};await assert.rejects(runScheduledInstagramDelivery(args));assert.equal(events.at(-1),'needs_review');await assert.rejects(runScheduledInstagramDelivery(args));assert.equal(events.filter(e=>e==='child').length,1);});
