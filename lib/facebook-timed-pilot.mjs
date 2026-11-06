// One explicitly enabled foreground pilot. No startup import or recurring scheduler.
import {setTimeout as delay} from 'node:timers/promises';
import {validateDeliveryInstallation} from './ad-delivery-records.mjs';
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(x);
export function validateTimedPilot(env,planId){validateDeliveryInstallation(env);if(env.AD_SCHEDULER_FACEBOOK_PILOT_ENABLED!=='true'||!uuid(planId))throw Error('Timed Facebook pilot is not explicitly enabled.');}
export async function readApprovedPilot(pool,planId){
 if(!uuid(planId))throw Error('Invalid pilot reference.');
 const db=await pool.connect();let begun=false;
 try{
  await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');begun=true;
  const row=(await db.query(`SELECT a.plan_id,a.snapshot_sha256,a.destination_id,a.scheduled_at,a.status,p.platform,p.status AS plan_status,p.scheduled_at AS plan_time,s.paused,d.plan_id AS existing_delivery FROM ad_scheduler_facebook_pilot_approvals a JOIN ad_scheduler_plans p ON p.id=a.plan_id CROSS JOIN ad_scheduler_settings s LEFT JOIN ad_scheduler_deliveries d ON d.plan_id=a.plan_id WHERE a.plan_id=$1 AND s.id=1`,[planId])).rows[0];
  if(!row||row.status!=='approved'||row.plan_status!=='planned'||row.platform!=='facebook'||row.destination_id!=='1271936012676830'||row.paused!==false||row.existing_delivery||! /^[a-f0-9]{64}$/.test(row.snapshot_sha256)||!Number.isFinite(+new Date(row.scheduled_at))||+new Date(row.scheduled_at)!==+new Date(row.plan_time))throw Error('Pilot approval, plan or delivery needs review. Do not resend.');
  await db.query('COMMIT');begun=false;
  return {approved:true,plan_id:row.plan_id,platform:'facebook',destination:row.destination_id,snapshot_sha256:row.snapshot_sha256,scheduled_at:new Date(row.scheduled_at).toISOString()};
 }finally{if(begun)try{await db.query('ROLLBACK');}catch{}db.release();}
}
export async function waitForApprovedFacebookPilot({env,planId,pool,dispatch,clock=()=>new Date(),sleep=ms=>delay(ms)}){
 validateTimedPilot(env,planId);
 const started=+clock();if(!Number.isFinite(started))throw Error('Pilot clock needs review.');
 let original=null;
 for(;;){
  const approval=await readApprovedPilot(pool,planId),now=+clock(),due=Date.parse(approval.scheduled_at);
  if(!Number.isFinite(now)||now<started||now-started>30*60000)throw Error('Pilot waiting window expired. No backfill.');
  const identity=JSON.stringify(approval);if(original&&identity!==original)throw Error('Pilot approval changed while waiting.');original=identity;
  if(due-now>30*60000)throw Error('Start the controlled pilot within 30 minutes of its scheduled time.');
  if(now-due>60000)throw Error('Pilot is past its one-minute delivery window. No backfill.');
  if(due<=now)return dispatch(approval);
  // Short waits keep pause/revocation checks responsive; dispatch rechecks under DB locks.
  await sleep(Math.min(30000,due-now));
 }
}
