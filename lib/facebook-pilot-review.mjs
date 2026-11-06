// Read-only review. No credentials, provider calls, claims, approvals or schema writes.
import {validateDelivery} from './ad-delivery-records.mjs';
const PAGE='1271936012676830';
export function reviewFacebookPlans(plans,paused,now=new Date()){
 if(!Array.isArray(plans)||plans.length>1000||typeof paused!=='boolean'||!Number.isFinite(+now))throw Error('Review unavailable.');
 return {mode:'facebook_pilot_review',checked_at:now.toISOString(),publishing_enabled:false,provider_requests:0,plans_changed:0,items:plans.map(p=>{
  const reasons=[];let hash=null;try{hash=validateDelivery(p,p.image,PAGE);}catch{reasons.push('Saved artwork or caption needs review');}
  const at=+new Date(p.scheduled_at);if(!Number.isFinite(at))reasons.push('Invalid scheduled time');else if(at<=+now)reasons.push('Past due — choose a new time; no backfill');else if(at>+now+7*86400000)reasons.push('Outside the seven-day review window');
  if(paused)reasons.push('Planner is paused');if(p.status!=='planned')reasons.push('Plan is canceled or unavailable');if(p.delivery_state)reasons.push('A delivery record already exists — do not resend');
  reasons.push('Specific post approval and timed execution are still required');
  return {plan_id:p.id,platform:'facebook',destination:PAGE,name:typeof p.snapshot?.name==='string'?p.snapshot.name.slice(0,200):'Saved Facebook ad',caption:hash?p.snapshot.caption:null,image_sha256:hash?p.snapshot.image_sha256:null,snapshot_sha256:hash,scheduled_at:Number.isFinite(at)?new Date(at).toISOString():null,delivery_state:p.delivery_state||null,reasons};
 })};
}
export async function readFacebookPilotReview(pool,now=new Date()){
 const db=await pool.connect();let begun=false;
 try{
  await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');begun=true;
  const tables=(await db.query("SELECT to_regclass('ad_scheduler_plans') IS NOT NULL AND to_regclass('ad_scheduler_media') IS NOT NULL AND to_regclass('ad_scheduler_settings') IS NOT NULL AS ready,to_regclass('ad_scheduler_deliveries') IS NOT NULL AS deliveries")).rows[0];
  if(!tables?.ready){await db.query('COMMIT');begun=false;return {...reviewFacebookPlans([],true,now),setup_required:true};}
  const setting=(await db.query('SELECT paused FROM ad_scheduler_settings WHERE id=1')).rows[0];
  const join=tables.deliveries?'LEFT JOIN ad_scheduler_deliveries d ON d.plan_id=p.id':'';
  const field=tables.deliveries?'d.state':'NULL::text';
  const plans=(await db.query(`SELECT p.id,p.platform,p.scheduled_at,p.snapshot,p.status,m.image,${field} AS delivery_state FROM ad_scheduler_plans p LEFT JOIN ad_scheduler_media m ON m.sha256=p.snapshot->>'image_sha256' ${join} WHERE p.platform='facebook' ORDER BY p.scheduled_at LIMIT 1001`)).rows;
  const result=reviewFacebookPlans(plans,setting?.paused,now);await db.query('COMMIT');begun=false;return result;
 }finally{if(begun)try{await db.query('ROLLBACK');}catch{}db.release();}
}
