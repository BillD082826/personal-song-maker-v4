// Explicit single-pilot authorization storage. No provider calls or publishing.
import {validateDelivery} from './ad-delivery-records.mjs';
const PAGE='1271936012676830';
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(x);
export const FACEBOOK_APPROVAL_SCHEMA=`CREATE TABLE IF NOT EXISTS ad_scheduler_facebook_pilot_approvals(
 plan_id UUID PRIMARY KEY REFERENCES ad_scheduler_plans(id),snapshot_sha256 TEXT NOT NULL,
 destination_id TEXT NOT NULL CHECK(destination_id='1271936012676830'),scheduled_at TIMESTAMPTZ NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('approved','revoked')),approved_at TIMESTAMPTZ NOT NULL,revoked_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS ad_scheduler_one_facebook_pilot ON ad_scheduler_facebook_pilot_approvals ((true)) WHERE status='approved';`;
export class FacebookPilotApprovals{
 constructor(pool,{clock=()=>new Date()}={}){this.pool=pool;this.clock=clock;}
 async install(){await this.pool.query(FACEBOOK_APPROVAL_SCHEMA);}
 async transaction(fn){const db=await this.pool.connect();try{await db.query('BEGIN');await db.query("SELECT pg_advisory_xact_lock(hashtext('lyribop-facebook-pilot-approval-v1'))");const result=await fn(db);await db.query('COMMIT');return result;}catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}}
 async approve(input){
  if(input?.confirm!==true||!uuid(input.plan_id)||! /^[a-f0-9]{64}$/.test(input.snapshot_sha256||'')||typeof input.scheduled_at!=='string'||!Number.isFinite(Date.parse(input.scheduled_at)))throw Error('Review the exact post before approving.');
  return this.transaction(async db=>{
   const settings=(await db.query('SELECT paused FROM ad_scheduler_settings WHERE id=1 FOR SHARE')).rows[0];
   const plan=(await db.query('SELECT * FROM ad_scheduler_plans WHERE id=$1 FOR UPDATE',[input.plan_id])).rows[0];
   const now=this.clock(),at=+new Date(plan?.scheduled_at);
   if(!settings||settings.paused||!Number.isFinite(+now)||!plan||plan.status!=='planned'||plan.platform!=='facebook'||!Number.isFinite(at)||at<=+now||at>+now+7*86400000)throw Error('Post is paused, canceled, past due or outside the pilot window.');
   const image=(await db.query('SELECT image FROM ad_scheduler_media WHERE sha256=$1',[plan.snapshot.image_sha256])).rows[0]?.image;
   if(validateDelivery(plan,image,PAGE)!==input.snapshot_sha256||at!==Date.parse(input.scheduled_at))throw Error('Saved content or time changed. Review again.');
   if((await db.query('SELECT plan_id FROM ad_scheduler_deliveries WHERE plan_id=$1',[plan.id])).rowCount)throw Error('A delivery record already exists. Do not resend.');
   if((await db.query("SELECT plan_id FROM ad_scheduler_facebook_pilot_approvals WHERE status='approved' OR plan_id=$1",[plan.id])).rowCount)throw Error('A pilot approval already exists. Review or revoke it first; use a new plan after revocation.');
   await db.query("INSERT INTO ad_scheduler_facebook_pilot_approvals(plan_id,snapshot_sha256,destination_id,scheduled_at,status,approved_at) VALUES($1,$2,$3,$4,'approved',$5)",[plan.id,input.snapshot_sha256,PAGE,plan.scheduled_at,now.toISOString()]);
   return {status:'approved',plan_id:plan.id,publishing_enabled:false,posts_changed:0};
  });
 }
 async revoke(input){
  if(input?.confirm!==true||!uuid(input.plan_id))throw Error('Choose the approval to revoke.');
  return this.transaction(async db=>{
   const r=await db.query("UPDATE ad_scheduler_facebook_pilot_approvals SET status='revoked',revoked_at=$2 WHERE plan_id=$1 AND status='approved' RETURNING plan_id",[input.plan_id,this.clock().toISOString()]);
   if(r.rowCount!==1)throw Error('No active pilot approval was found.');
   return {status:'revoked',plan_id:input.plan_id,publishing_enabled:false,posts_changed:0};
  });
 }
}
