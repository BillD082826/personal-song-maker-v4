// Read-only review. No credentials, provider calls, claims, approvals or schema writes.
import {validateDelivery} from './ad-delivery-records.mjs';
export function reviewPinterestPlans(plans,paused,now=new Date(),approvalStorage=false){
 if(!Array.isArray(plans)||plans.length>1000||typeof paused!=='boolean'||!Number.isFinite(+now))throw Error('Review unavailable.');
 return {mode:'pinterest_pilot_review',checked_at:now.toISOString(),publishing_enabled:false,provider_requests:0,plans_changed:0,approval_storage_available:approvalStorage,items:plans.map(p=>{
  const reasons=[];let hash=null;try{hash=validateDelivery(p,p.image,p.snapshot?.pinterest_board?.id);}catch{reasons.push('Saved artwork or caption needs review');}
  const at=+new Date(p.scheduled_at);if(!Number.isFinite(at))reasons.push('Invalid scheduled time');else if(at<=+now)reasons.push('Past due — choose a new time; no backfill');else if(at>+now+7*86400000)reasons.push('Outside the seven-day review window');
  if(paused)reasons.push('Planner is paused');if(p.status!=='planned')reasons.push('Plan is canceled or unavailable');if(p.delivery_state)reasons.push('A delivery record already exists — do not resend');
  const canApprove=hash!==null&&reasons.length===0&&approvalStorage&&!p.approval_status;
  const approvalMatches=p.approval_status==='approved'&&p.approved_hash===hash&&+new Date(p.approved_scheduled_at)===at;
  if(p.approval_status==='approved'&&!approvalMatches)reasons.push('Approved content or time no longer matches — revoke and create a new plan');
  reasons.push(approvalMatches?'Approval saved for the displayed time':'Specific post approval and timed execution are still required');
  return {plan_id:p.id,platform:'pinterest',destination:p.snapshot?.pinterest_board?.id||null,board_name:p.snapshot?.pinterest_board?.name||null,pin_title:p.snapshot?.pin_title||null,link:p.snapshot?.destination||null,name:typeof p.snapshot?.name==='string'?p.snapshot.name.slice(0,200):'Saved Pinterest ad',caption:hash?p.snapshot.caption:null,image_sha256:hash?p.snapshot.image_sha256:null,snapshot_sha256:hash,scheduled_at:Number.isFinite(at)?new Date(at).toISOString():null,delivery_state:p.delivery_state||null,approval_status:p.approval_status||null,approval_matches:approvalMatches,can_approve:canApprove,reasons};
 })};
}
export async function readPinterestReview(pool,now=new Date()){
 const db=await pool.connect();let begun=false;
 try{
  await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');begun=true;
  const tables=(await db.query("SELECT to_regclass('ad_scheduler_plans') IS NOT NULL AND to_regclass('ad_scheduler_media') IS NOT NULL AND to_regclass('ad_scheduler_settings') IS NOT NULL AS ready,to_regclass('ad_scheduler_deliveries') IS NOT NULL AS deliveries,to_regclass('ad_scheduler_pinterest_approvals') IS NOT NULL AS approvals")).rows[0];
  if(!tables?.ready){await db.query('COMMIT');begun=false;return {...reviewPinterestPlans([],true,now),setup_required:true};}
  const setting=(await db.query('SELECT paused FROM ad_scheduler_settings WHERE id=1')).rows[0];
  const join=tables.deliveries?'LEFT JOIN ad_scheduler_deliveries d ON d.plan_id=p.id':'';
  const field=tables.deliveries?'d.state':'NULL::text';
  const approvalJoin=tables.approvals?'LEFT JOIN ad_scheduler_pinterest_approvals a ON a.plan_id=p.id':'';
  const approvalFields=tables.approvals?'a.status AS approval_status,a.snapshot_sha256 AS approved_hash,a.scheduled_at AS approved_scheduled_at':'NULL::text AS approval_status';
  const plans=(await db.query(`SELECT p.id,p.platform,p.scheduled_at,p.snapshot,p.status,m.image,${field} AS delivery_state,${approvalFields} FROM ad_scheduler_plans p LEFT JOIN ad_scheduler_media m ON m.sha256=p.snapshot->>'image_sha256' ${join} ${approvalJoin} WHERE p.platform='pinterest' ORDER BY p.scheduled_at LIMIT 1001`)).rows;
  const result=reviewPinterestPlans(plans,setting?.paused,now,Boolean(tables.approvals&&tables.deliveries));result.weekly_approval_available=Boolean(tables.approvals&&tables.deliveries);await db.query('COMMIT');begun=false;return result;
 }finally{if(begun)try{await db.query('ROLLBACK');}catch{}db.release();}
}
