// Explicit public-address correction only; no new posts, provider calls or schedule changes.
import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {deliverySnapshotHash,validateDelivery} from '../lib/ad-delivery-records.mjs';
import {preparedInstagramMedia} from '../lib/instagram-scheduler-media.mjs';
import {cleanAdSnapshot} from '../lib/ad-public-address.mjs';
const apply=process.argv[2]==='--apply';if(process.argv.length!==3||!['--review','--apply'].includes(process.argv[2]))throw Error('Use --review or --apply.');
const root=resolve('marketing/advertising-dashboard'),manifest=JSON.parse(await readFile(resolve(root,'reports/lyribop-com-assets.json'),'utf8'));
const videoManifest=JSON.parse(await readFile(resolve(root,'reports/lyribop-com-video.json'),'utf8'));
const tables={facebook:'ad_scheduler_facebook_pilot_approvals',instagram:'ad_scheduler_instagram_approvals',pinterest:'ad_scheduler_pinterest_approvals'};
const sha=b=>createHash('sha256').update(b).digest('hex');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});const db=await pool.connect();
try{
 await db.query('BEGIN');await db.query('SELECT paused FROM ad_scheduler_settings WHERE id=1 FOR UPDATE');
 const rows=(await db.query("SELECT p.* FROM ad_scheduler_plans p WHERE p.status='planned' AND p.scheduled_at>now()+interval '5 minutes' AND NOT EXISTS(SELECT 1 FROM ad_scheduler_deliveries d WHERE d.plan_id=p.id) ORDER BY p.scheduled_at,p.platform FOR UPDATE OF p")).rows;
 const changes=[],skipped=[];
 for(const plan of rows){
  const snapshot=cleanAdSnapshot(plan.snapshot,manifest.assets);
  if(snapshot.format==='video'&&snapshot.video_sha256===videoManifest.original_sha256){snapshot.video=videoManifest.video;snapshot.video_sha256=videoManifest.sha256;snapshot.image_sha256=videoManifest.sha256;snapshot.video_bytes=videoManifest.bytes;if(plan.platform==='instagram')snapshot.publishing_media={format:'mp4',sha256:videoManifest.sha256,path:'/social-scheduler-video/'+videoManifest.sha256+'.mp4'};}
  if(snapshot.format==='video'&&(await db.query('SELECT plan_id FROM ad_scheduler_pinterest_video_uploads WHERE plan_id=$1',[plan.id])).rowCount){skipped.push({plan_id:plan.id,reason:'existing_video_upload_requires_review'});continue;}if(JSON.stringify(snapshot)===JSON.stringify(plan.snapshot))continue;
  const media=[];if(snapshot.format==='video'){const path=resolve(root,snapshot.video);if(!path.startsWith(resolve(root,'assets/videos')+'/'))throw Error('Video path outside catalog.');const bytes=await readFile(path);if(sha(bytes)!==snapshot.video_sha256||bytes.length!==snapshot.video_bytes)throw Error('Video changed.');media.push({sha:snapshot.video_sha256,bytes});}else for(const item of [snapshot,...snapshot.panels||[]]){
   if(!/^[a-f0-9]{64}$/.test(item.image_sha256))throw Error('Artwork digest missing.');
   const path=resolve(root,item.image);if(!path.startsWith(resolve(root,'assets/images')+'/'))throw Error('Artwork path outside catalog.');
   const bytes=await readFile(path);if(sha(bytes)!==item.image_sha256)throw Error('Artwork changed.');media.push({sha:item.image_sha256,bytes});
   if(plan.platform==='instagram')item.publishing_media=await preparedInstagramMedia(resolve('public'),bytes);
  }
  const table=tables[plan.platform];if(!table)throw Error('Unknown platform.');
  const approval=(await db.query(`SELECT * FROM ${table} WHERE plan_id=$1 FOR UPDATE`,[plan.id])).rows[0];
  if(approval?.status==='approved'&&(approval.snapshot_sha256!==deliverySnapshotHash(plan.snapshot)||+new Date(approval.scheduled_at)!==+new Date(plan.scheduled_at)))throw Error('Existing authorization requires review for '+plan.id);
  validateDelivery({...plan,snapshot},media[0].bytes,approval?.destination_id||({facebook:'1271936012676830',instagram:'17841431950776323',pinterest:snapshot.pinterest_board?.id})[plan.platform]);
  changes.push({plan,snapshot,media,approval,table});
 }
 if(apply){
  await db.query('CREATE TABLE IF NOT EXISTS ad_scheduler_com_address_updates(plan_id UUID PRIMARY KEY REFERENCES ad_scheduler_plans(id),original_snapshot JSONB NOT NULL,updated_snapshot JSONB NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT now())');
  for(const c of changes){
   await db.query('INSERT INTO ad_scheduler_com_address_updates(plan_id,original_snapshot,updated_snapshot) VALUES($1,$2,$3)',[c.plan.id,JSON.stringify(c.plan.snapshot),JSON.stringify(c.snapshot)]);
   for(const m of new Map(c.media.map(m=>[m.sha,m])).values())await db.query('INSERT INTO ad_scheduler_media(sha256,image) VALUES($1,$2) ON CONFLICT DO NOTHING',[m.sha,m.bytes]);
   await db.query('UPDATE ad_scheduler_plans SET snapshot=$2 WHERE id=$1',[c.plan.id,JSON.stringify(c.snapshot)]);
   if(c.approval?.status==='approved')await db.query(`UPDATE ${c.table} SET snapshot_sha256=$2 WHERE plan_id=$1`,[c.plan.id,deliverySnapshotHash(c.snapshot)]);
  }
  await db.query('COMMIT');
 }else await db.query('ROLLBACK');
 console.log(JSON.stringify({mode:apply?'updated':'review',changed:changes.length,platforms:Object.fromEntries(Object.keys(tables).map(k=>[k,changes.filter(c=>c.plan.platform===k).length])),dates:[...new Set(changes.map(c=>c.plan.local_day))],skipped,posting_times_changed:0,new_approvals:0,provider_requests:0}));
}catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();await pool.end();}
