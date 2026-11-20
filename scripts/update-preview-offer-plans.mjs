// Updates only future, unclaimed posts after the approved 30-to-60-second offer correction.
// No provider requests. Original snapshots are retained for audit and recovery.
import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {deliverySnapshotHash} from '../lib/ad-delivery-records.mjs';
import {preparedInstagramMedia} from '../lib/instagram-scheduler-media.mjs';
const apply=process.argv[2]==='--apply';
if(process.argv.length!==3||!['--review','--apply'].includes(process.argv[2]))throw Error('Use --review or --apply.');
const root=resolve('marketing/advertising-dashboard');
const manifest=JSON.parse(await readFile(resolve(root,'reports/preview-60-assets.json'),'utf8'));
const tables={facebook:'ad_scheduler_facebook_pilot_approvals',instagram:'ad_scheduler_instagram_approvals',pinterest:'ad_scheduler_pinterest_approvals'};
const sha=b=>createHash('sha256').update(b).digest('hex');
const replace=s=>s.replace(/30(?=[- ]second\b)/gi,'60');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
const db=await pool.connect();
try{
 await db.query('BEGIN');
 // Workers acquire this settings row before reserving posts. Hold it for this atomic update.
 await db.query('SELECT paused FROM ad_scheduler_settings WHERE id=1 FOR UPDATE');
 const rows=(await db.query("SELECT p.* FROM ad_scheduler_plans p WHERE p.status='planned' AND p.scheduled_at>now()+interval '5 minutes' AND NOT EXISTS(SELECT 1 FROM ad_scheduler_deliveries d WHERE d.plan_id=p.id) ORDER BY p.scheduled_at,p.platform FOR UPDATE OF p")).rows;
 const changes=[];
 for(const p of rows){
  const old=p.snapshot,asset=manifest.assets.find(a=>a.original_sha256===old.image_sha256);
  const caption=replace(old.caption);
  if(caption===old.caption&&(!asset||asset.sha256===old.image_sha256))continue;
  if(!asset)throw Error('Artwork correction missing for plan '+p.id);
  const image=await readFile(resolve(root,asset.path));
  if(sha(image)!==asset.sha256)throw Error('Corrected image digest changed.');
  const snapshot={...old,caption,image:asset.path,image_sha256:asset.sha256};
  if(p.platform==='instagram')snapshot.publishing_media=await preparedInstagramMedia(resolve('public'),image);
  const table=tables[p.platform];if(!table)throw Error('Unknown platform.');
  const approval=(await db.query(`SELECT * FROM ${table} WHERE plan_id=$1 FOR UPDATE`,[p.id])).rows[0];
  if(approval&&(approval.status!=='approved'||approval.snapshot_sha256!==deliverySnapshotHash(old)||+new Date(approval.scheduled_at)!==+new Date(p.scheduled_at)))throw Error('Existing approval needs review for '+p.id);
  changes.push({plan:p,snapshot,image,approval,table});
 }
 if(apply){
  await db.query('CREATE TABLE IF NOT EXISTS ad_scheduler_preview_offer_updates(plan_id UUID PRIMARY KEY REFERENCES ad_scheduler_plans(id),original_snapshot JSONB NOT NULL,updated_snapshot JSONB NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT now())');
  for(const c of changes){
   await db.query('INSERT INTO ad_scheduler_preview_offer_updates(plan_id,original_snapshot,updated_snapshot) VALUES($1,$2,$3)',[c.plan.id,JSON.stringify(c.plan.snapshot),JSON.stringify(c.snapshot)]);
   await db.query('INSERT INTO ad_scheduler_media(sha256,image) VALUES($1,$2) ON CONFLICT DO NOTHING',[c.snapshot.image_sha256,c.image]);
   await db.query('UPDATE ad_scheduler_plans SET snapshot=$2 WHERE id=$1',[c.plan.id,JSON.stringify(c.snapshot)]);
   // Preserve the existing authorization and schedule for this explicitly approved wording correction.
   if(c.approval)await db.query(`UPDATE ${c.table} SET snapshot_sha256=$2 WHERE plan_id=$1`,[c.plan.id,deliverySnapshotHash(c.snapshot)]);
  }
  await db.query('COMMIT');
 }else await db.query('ROLLBACK');
 console.log(JSON.stringify({mode:apply?'updated':'review',changed:changes.length,platforms:Object.fromEntries(Object.keys(tables).map(k=>[k,changes.filter(c=>c.plan.platform===k).length])),posting_times_changed:0,new_approvals:0,provider_requests:0}));
}catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();await pool.end();}
