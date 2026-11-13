// Inert storage foundation: no provider client, route, timer, or worker imports this module.
import {createHash,randomUUID} from 'node:crypto';
import {pinterestDeliverySpec} from './pinterest-scheduled-delivery.mjs';
const destinations={facebook:'1271936012676830',instagram:'17841431950776323'};
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const digest=x=>createHash('sha256').update(x).digest('hex');
function canonical(x){if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';if(x&&typeof x==='object')return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';return JSON.stringify(x);}
export const deliverySnapshotHash=snapshot=>digest(canonical(snapshot));
export const DELIVERY_SCHEMA=`CREATE TABLE IF NOT EXISTS ad_scheduler_deliveries (
 plan_id UUID PRIMARY KEY REFERENCES ad_scheduler_plans(id),claim_id UUID NOT NULL UNIQUE,
 platform TEXT NOT NULL CHECK(platform IN ('facebook','instagram','pinterest')),destination_id TEXT NOT NULL,
 snapshot_sha256 TEXT NOT NULL,scheduled_at TIMESTAMPTZ NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('reserved','creating','container_ready','publishing','verifying','verified','needs_review','closed_unverified')),
 container_id TEXT,remote_id TEXT,permalink TEXT,created_at TIMESTAMPTZ NOT NULL,updated_at TIMESTAMPTZ NOT NULL
);`;
export function validateDelivery(plan,image,destination){
 const s=plan?.snapshot;
 if(plan?.platform==='pinterest'){
  if(!uuid(plan.id)||!Number.isFinite(Date.parse(plan.scheduled_at)))throw Error('Delivery needs review.');
  const spec=pinterestDeliverySpec(s,image);
  if(destination!==spec.board_id)throw Error('Pinterest delivery board changed.');
  return deliverySnapshotHash(s);
 }
 if(!uuid(plan?.id)||!Object.hasOwn(destinations,plan.platform)||destination!==destinations[plan.platform]||s?.platform!==plan.platform||typeof s.caption!=='string'||!s.caption.trim()||s.caption.length>2200||!Number.isFinite(+new Date(plan.scheduled_at)))throw Error('Delivery needs review.');
 if(!Buffer.isBuffer(image)||image.length>8*1024*1024||!image.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||s.image_sha256!==digest(image))throw Error('Delivery artwork needs review.');
 return deliverySnapshotHash(s);
}
export class DeliveryRecords{
 constructor(pool,{clock=()=>new Date()}={}){this.pool=pool;this.clock=clock;}
 // Must be explicitly invoked during an approved migration, never on application startup.
 async install(){await this.pool.query(DELIVERY_SCHEMA);}
 async transaction(fn){const db=await this.pool.connect();try{await db.query('BEGIN');const result=await fn(db);await db.query('COMMIT');return result;}catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}}
 async planForUpdate(db,id){
  const settings=(await db.query('SELECT paused FROM ad_scheduler_settings WHERE id=1 FOR SHARE')).rows[0];
  const plan=(await db.query('SELECT * FROM ad_scheduler_plans WHERE id=$1 FOR UPDATE',[id])).rows[0];
  if(!settings||settings.paused||!plan||plan.status!=='planned')throw Error('Delivery is paused, canceled, or unavailable.');
  const now=this.clock(),due=+new Date(plan.scheduled_at);if(!Number.isFinite(+now)||due>+now||+now-due>60000)throw Error('Delivery is outside its one-minute pilot window. Review required; no backfill.');
  return {plan,now};
 }
 async checkWorker(db){
  const state=(await db.query('SELECT enabled FROM ad_scheduler_facebook_worker WHERE id=1 FOR SHARE')).rows[0];
  if(state?.enabled!==true)throw Error('Hosted worker is disabled.');
 }
 async checkSavedApproval(db,planId,hash,scheduledAt,destination){
  const a=(await db.query('SELECT * FROM ad_scheduler_facebook_pilot_approvals WHERE plan_id=$1 FOR SHARE',[planId])).rows[0];
  if(!a||a.status!=='approved'||a.snapshot_sha256!==hash||a.destination_id!==destination||+new Date(a.scheduled_at)!==+new Date(scheduledAt))throw Error('Saved pilot approval is absent, revoked or changed.');
 }
 async reserve({planId,destination,approved=false,expectedHash=null,expectedScheduledAt=null,requireSavedApproval=false,requireWorkerEnabled=false}){
  if(!uuid(planId)||approved!==true)throw Error('Explicit pilot approval required.');
  return this.transaction(async db=>{
   const {plan,now}=await this.planForUpdate(db,planId);
   const image=(await db.query('SELECT image FROM ad_scheduler_media WHERE sha256=$1',[plan.snapshot.image_sha256])).rows[0]?.image;
   const hash=validateDelivery(plan,image,destination),claim=randomUUID();
   if((expectedHash!==null&&hash!==expectedHash)||(expectedScheduledAt!==null&&+new Date(plan.scheduled_at)!==+new Date(expectedScheduledAt)))throw Error('Approved delivery changed.');
   if(requireSavedApproval)await this.checkSavedApproval(db,plan.id,hash,plan.scheduled_at,destination);
   if(requireWorkerEnabled)await this.checkWorker(db);
   const r=await db.query("INSERT INTO ad_scheduler_deliveries(plan_id,claim_id,platform,destination_id,snapshot_sha256,scheduled_at,state,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,'reserved',$7,$7) ON CONFLICT(plan_id) DO NOTHING RETURNING claim_id",[plan.id,claim,plan.platform,destination,hash,plan.scheduled_at,now.toISOString()]);
   if(!r.rowCount)throw Error('This plan already has a permanent delivery record. Do not resend.');
   return {claim_id:claim,plan_id:plan.id,state:'reserved'};
  });
 }
 async advance({planId,claimId,from,to,remoteId=null,containerId=null,permalink=null,requireSavedApproval=false,requireWorkerEnabled=false}){
  if(!uuid(planId)||!uuid(claimId))throw Error('Invalid delivery claim.');
  return this.transaction(async db=>{
   // Consistent lock order with reserve prevents claim/transition deadlocks.
   await db.query('SELECT paused FROM ad_scheduler_settings WHERE id=1 FOR SHARE');
   await db.query('SELECT id FROM ad_scheduler_plans WHERE id=$1 FOR UPDATE',[planId]);
   const row=(await db.query('SELECT * FROM ad_scheduler_deliveries WHERE plan_id=$1 AND claim_id=$2 FOR UPDATE',[planId,claimId])).rows[0];
   if(!row||row.state!==from||['verified','needs_review','closed_unverified'].includes(from))throw Error('Delivery state requires review.');
   const edges=row.platform==='instagram'?{reserved:['creating'],creating:['container_ready'],container_ready:['publishing'],publishing:['verifying'],verifying:['verified']}:{reserved:['publishing'],publishing:['verifying'],verifying:['verified']};
   if(to!=='needs_review'&&!edges[from]?.includes(to))throw Error('Invalid delivery transition.');
   if(['creating','publishing'].includes(to)){
    const {plan}=await this.planForUpdate(db,planId);const image=(await db.query('SELECT image FROM ad_scheduler_media WHERE sha256=$1',[plan.snapshot.image_sha256])).rows[0]?.image;
    if(validateDelivery(plan,image,row.destination_id)!==row.snapshot_sha256||+new Date(plan.scheduled_at)!==+new Date(row.scheduled_at))throw Error('Reserved delivery content changed.');
    if(requireSavedApproval)await this.checkSavedApproval(db,plan.id,row.snapshot_sha256,row.scheduled_at,row.destination_id);
    if(requireWorkerEnabled)await this.checkWorker(db);
   }
   if(to==='container_ready'&&(row.platform!=='instagram'||!/^\d+$/.test(containerId||'')))throw Error('Container identifier required.');
   if(to==='verifying'&&!(row.platform==='facebook'?/^1271936012676830_\d+$/:/^\d+$/).test(remoteId||''))throw Error('Remote identifier required.');
   if(to==='verified'){
    let u;try{u=new URL(permalink);}catch{}const id=row.remote_id;
    if(row.platform==='pinterest'&&(!/^\d+$/.test(id||'')||permalink!=='https://www.pinterest.com/pin/'+id+'/'))throw Error('Verified Pin link required.');
    if(row.platform!=='pinterest'&&(!u||u.protocol!=='https:'||u.search||u.hash||u.username||u.password||u.port||!id||!(row.platform==='instagram'?['instagram.com','www.instagram.com'].includes(u.hostname)&&/^\/p\/[^/]+\/$/.test(u.pathname):['facebook.com','www.facebook.com'].includes(u.hostname)&&new RegExp('^/\\d+/posts/'+id.split('_')[1]+'/?$').test(u.pathname))))throw Error('Verified post link required.');
   }
   await db.query('UPDATE ad_scheduler_deliveries SET state=$3,container_id=COALESCE($4,container_id),remote_id=COALESCE($5,remote_id),permalink=COALESCE($6,permalink),updated_at=$7 WHERE plan_id=$1 AND claim_id=$2',[planId,claimId,to,to==='container_ready'?containerId:null,to==='verifying'?remoteId:null,to==='verified'?permalink:null,this.clock().toISOString()]);
   return {plan_id:planId,state:to};
  });
 }
}

export function validateDeliveryInstallation(env){
 const origin=(env.PUBLIC_BASE_URL||'https://personal-song-maker-v5-test.onrender.com').replace(/\/+$/,'');
 if(env.AD_SCHEDULER_ENABLED!=='true'||origin!=='https://personal-song-maker-v5-test.onrender.com'||!env.DATABASE_URL)throw Error('Delivery storage setup is not enabled for this service.');
}
