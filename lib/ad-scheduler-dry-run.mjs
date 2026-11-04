// Inspection only: no provider adapters, credentials, publication or plan mutations.
import {createHash} from 'node:crypto';
const platforms=new Set(['facebook','instagram','pinterest']);
export function inspectSchedulerPlans({plans,paused,now=new Date()}){
 if(!Array.isArray(plans)||plans.length>1000||typeof paused!=='boolean'||!Number.isFinite(+now))throw Error('Dry-run input needs review.');
 const items=plans.map(p=>{
  const s=p.snapshot,at=new Date(p.scheduled_at),validTime=typeof p.scheduled_at==='string'||p.scheduled_at instanceof Date;
  const reasons=[];let timing='invalid';
  if(!validTime||!Number.isFinite(+at))reasons.push('Invalid scheduled time');else timing=+at<=+now?'past_due':+at<=+now+7*86400000?'upcoming':'outside_window';
  if(!platforms.has(p.platform)||!s||s.platform!==p.platform||typeof s.name!=='string'||!s.name.trim()||typeof s.caption!=='string'||!s.caption.trim()||s.caption.length>12000||s.time_zone!=='America/New_York')reasons.push('Saved advertisement metadata needs review');
  if(!['planned','canceled'].includes(p.status))reasons.push('Unknown plan status');
  if(p.status==='canceled')reasons.push('Plan canceled');
  if(paused)reasons.push('Planner paused');
  if(timing==='past_due')reasons.push('Past due — manual review required; no backfill');
  if(timing==='outside_window')reasons.push('Outside seven-day inspection window');
  const image=p.image,hash=s?.image_sha256;
  if(!Buffer.isBuffer(image)||image.length>12*1024*1024||!image.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||! /^[a-f0-9]{64}$/.test(hash||'')||createHash('sha256').update(image).digest('hex')!==hash)reasons.push('Saved artwork missing or changed');
  if(p.platform==='pinterest'){let u;try{u=new URL(s?.destination);}catch{}if(typeof s?.pin_title!=='string'||!s.pin_title.trim()||s.pin_title.length>100||!u||u.protocol!=='https:'||u.username||u.password)reasons.push('Pinterest title or destination needs review');}
  reasons.push('Automatic publishing is not implemented or enabled','No active publishing connection has been verified for this plan');
  return{id:typeof p.id==='string'?p.id:null,platform:platforms.has(p.platform)?p.platform:null,name:typeof s?.name==='string'?s.name.slice(0,200):null,scheduled_at:validTime&&Number.isFinite(+at)?at.toISOString():null,timing,status:'blocked',reasons};
 });
 return {mode:'dry_run',checked_at:now.toISOString(),time_zone:'America/New_York',publishing_enabled:false,provider_requests:0,plans_changed:0,paused,total:items.length,items};
}
export async function readSchedulerDryRun(pool,now=new Date()){
 const db=await pool.connect();let begun=false;
 try{await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');begun=true;
 const tables=(await db.query("SELECT to_regclass('ad_scheduler_plans') IS NOT NULL AND to_regclass('ad_scheduler_media') IS NOT NULL AND to_regclass('ad_scheduler_settings') IS NOT NULL AS ready")).rows[0];
 if(!tables?.ready){await db.query('COMMIT');begun=false;return {...inspectSchedulerPlans({plans:[],paused:true,now}),setup_required:true};}
 const setting=(await db.query('SELECT paused FROM ad_scheduler_settings WHERE id=1')).rows[0];
 if(typeof setting?.paused!=='boolean')throw Error('Planner settings need review.');
 const plans=(await db.query("SELECT p.id,p.platform,p.scheduled_at,p.snapshot,p.status,m.image FROM ad_scheduler_plans p LEFT JOIN ad_scheduler_media m ON m.sha256=p.snapshot->>'image_sha256' ORDER BY p.scheduled_at,p.platform LIMIT 1001")).rows;
 const result=inspectSchedulerPlans({plans,paused:setting.paused,now});await db.query('COMMIT');begun=false;return result;
 }finally{if(begun)try{await db.query('ROLLBACK');}catch{}db.release();}
}
