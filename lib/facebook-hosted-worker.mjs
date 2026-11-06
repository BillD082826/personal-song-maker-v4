// Disabled by default. Runs only saved, explicitly approved Facebook work.
import {validateDeliveryInstallation} from './ad-delivery-records.mjs';
import {readApprovedPilot} from './facebook-timed-pilot.mjs';
export const WORKER_SCHEMA=`CREATE TABLE IF NOT EXISTS ad_scheduler_facebook_worker(
 id INTEGER PRIMARY KEY CHECK(id=1),enabled BOOLEAN NOT NULL DEFAULT FALSE,
 last_tick TIMESTAMPTZ,last_outcome TEXT,last_plan_id UUID
);
INSERT INTO ad_scheduler_facebook_worker(id,enabled) VALUES(1,FALSE) ON CONFLICT(id) DO NOTHING;`;
export function workerConfigured(env){try{validateDeliveryInstallation(env);}catch{return false;}return env.AD_SCHEDULER_FACEBOOK_WORKER_ENABLED==='true'&&env.AD_SCHEDULER_ENABLED==='true'&&env.AD_SCHEDULER_META_CONNECTIONS_ENABLED==='true'&&Boolean(env.DATABASE_URL);}
export class FacebookHostedWorker{
 constructor(pool,{env=process.env,clock=()=>new Date(),dispatch,readApproval=readApprovedPilot}={}){this.pool=pool;this.env=env;this.clock=clock;this.dispatch=dispatch;this.readApproval=readApproval;this.stopping=false;this.active=null;this.timer=null;}
 async install(){validateDeliveryInstallation(this.env);await this.pool.query(WORKER_SCHEMA);}
 async status(){
  const exists=(await this.pool.query("SELECT to_regclass('ad_scheduler_facebook_worker') AS relation")).rows[0];if(!exists?.relation)return {mode:'facebook_hosted_worker_status',configured:workerConfigured(this.env),enabled:false,setup_required:true,last_tick:null,last_outcome:null,needs_attention:false};
  const r=(await this.pool.query('SELECT enabled,last_tick,last_outcome,last_plan_id FROM ad_scheduler_facebook_worker WHERE id=1')).rows[0];
  const enabled=workerConfigured(this.env)&&r?.enabled===true;
  const time=r?.last_tick?new Date(r.last_tick):null;
  const outcome=['idle','paused','waiting','verified','needs_review'].includes(r?.last_outcome)?r.last_outcome:null;
  return {mode:'facebook_hosted_worker_status',configured:workerConfigured(this.env),enabled,last_tick:time&&Number.isFinite(+time)?time.toISOString():null,last_outcome:outcome,needs_attention:outcome==='needs_review'||(enabled&&(!time||!Number.isFinite(+time)||+this.clock()-time>90000))};
 }
 async setEnabled(enabled,{approved=false}={}){
  validateDeliveryInstallation(this.env);if(typeof enabled!=='boolean'||approved!==true||(enabled&&!workerConfigured(this.env)))throw Error('Explicit hosted worker setup approval required.');
  const r=await this.pool.query('UPDATE ad_scheduler_facebook_worker SET enabled=$1 WHERE id=1 RETURNING id',[enabled]);if(r.rowCount!==1)throw Error('Worker storage is unavailable.');return {enabled,posts_changed:0};
 }
 async tick(){
  if(this.stopping||!workerConfigured(this.env))return {outcome:'disabled',provider_requests:0};
  validateDeliveryInstallation(this.env);
  let db;try{db=await this.pool.connect();}catch{this.stopping=true;return {outcome:'needs_review'};}let locked=false,planId=null,released=false;
  try{
   locked=(await db.query("SELECT pg_try_advisory_lock(hashtext('lyribop-facebook-hosted-worker-v1')) AS locked")).rows[0]?.locked===true;
   if(!locked)return {outcome:'another_worker_active'};
   const state=(await db.query('SELECT enabled FROM ad_scheduler_facebook_worker WHERE id=1')).rows[0];if(state?.enabled!==true)return {outcome:'disabled'};
   const now=this.clock();if(!Number.isFinite(+now))throw Error('Clock unavailable.');
   const beat=async outcome=>{await db.query('UPDATE ad_scheduler_facebook_worker SET last_tick=$1,last_outcome=$2,last_plan_id=$3 WHERE id=1',[now.toISOString(),outcome,planId]);return {outcome,plan_id:planId};};
   const setting=(await db.query('SELECT paused FROM ad_scheduler_settings WHERE id=1')).rows[0];if(setting?.paused!==false)return beat('paused');
   const unfinished=(await db.query("SELECT plan_id,claim_id,state FROM ad_scheduler_deliveries WHERE platform='facebook' AND state<>'verified' AND (state='needs_review' OR updated_at<$1) ORDER BY updated_at LIMIT 1",[new Date(+now-90000).toISOString()])).rows[0];
   if(unfinished){
    planId=unfinished.plan_id;
    if(unfinished.state!=='needs_review')await db.query("UPDATE ad_scheduler_deliveries SET state='needs_review',updated_at=$1 WHERE plan_id=$2 AND claim_id=$3 AND state=$4",[now.toISOString(),planId,unfinished.claim_id,unfinished.state]);
    throw Error('Unfinished prior delivery requires review.');
   }
   // A permanent claim excludes a plan forever, regardless of delivery outcome.
   const due=(await db.query(`SELECT a.plan_id,a.scheduled_at FROM ad_scheduler_facebook_pilot_approvals a JOIN ad_scheduler_plans p ON p.id=a.plan_id LEFT JOIN ad_scheduler_deliveries d ON d.plan_id=a.plan_id WHERE a.status='approved' AND p.status='planned' AND p.platform='facebook' AND d.plan_id IS NULL ORDER BY a.scheduled_at LIMIT 1`)).rows[0];
   if(!due)return beat('idle');planId=due.plan_id;const at=+new Date(due.scheduled_at);if(!Number.isFinite(at))throw Error('Invalid schedule.');
   if(at>+now)return beat('waiting');if(+now-at>60000)throw Error('Missed delivery requires review.');
   if(this.stopping)return {outcome:'stopping'};
   const approval=await this.readApproval(this.pool,planId);
   if(this.stopping)return {outcome:'stopping'};
   const result=await this.dispatch(approval);
   if(result?.status!=='verified'||result.plan_id!==planId)throw Error('Delivery requires review.');
   return beat('verified');
  }catch{
   // Latch off on any error. Never loop into a blind publication retry.
   let latched=false;
   if(locked)try{const r=await db.query("UPDATE ad_scheduler_facebook_worker SET enabled=FALSE,last_tick=$1,last_outcome='needs_review',last_plan_id=$2 WHERE id=1",[this.clock().toISOString(),planId]);latched=r.rowCount===1;}catch{}
   // A durable OFF switch permits later explicit recovery. If it cannot be saved, stop locally too.
   if(!latched){this.stopping=true;if(this.timer)clearInterval(this.timer);this.timer=null;}
   return {outcome:'needs_review',plan_id:planId};
  }finally{
   if(locked)try{await db.query("SELECT pg_advisory_unlock(hashtext('lyribop-facebook-hosted-worker-v1'))");}catch{db.release(true);released=true;}
   if(!released)db.release();
  }
 }
 runOnce(){if(this.active||this.stopping)return this.active||Promise.resolve({outcome:'stopping'});this.active=this.tick().catch(()=>{this.stopping=true;return {outcome:'needs_review'};}).finally(()=>{this.active=null;});return this.active;}
 start(){if(!workerConfigured(this.env)||this.timer)return false;try{validateDeliveryInstallation(this.env);}catch{this.stopping=true;return false;}this.timer=setInterval(()=>{void this.runOnce();},15000);this.timer.unref?.();void this.runOnce();return true;}
 async stop(){this.stopping=true;if(this.timer)clearInterval(this.timer);this.timer=null;await this.active;}
}
