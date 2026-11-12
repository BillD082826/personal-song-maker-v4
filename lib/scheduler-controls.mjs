import {PinterestHostedWorker} from './pinterest-hosted-worker.mjs';
// Admin controls change only an existing worker switch. They never send a post.
import {createHash} from 'node:crypto';
import {validateDeliveryInstallation,deliverySnapshotHash} from './ad-delivery-records.mjs';
import {FacebookHostedWorker} from './facebook-hosted-worker.mjs';
import {InstagramHostedWorker} from './instagram-hosted-worker.mjs';
const platforms={facebook:{table:'ad_scheduler_facebook_pilot_approvals',worker:'ad_scheduler_facebook_worker',account:'1271936012676830',Class:FacebookHostedWorker},instagram:{table:'ad_scheduler_instagram_approvals',worker:'ad_scheduler_instagram_worker',account:'17841431950776323',Class:InstagramHostedWorker},pinterest:{table:'ad_scheduler_pinterest_approvals',worker:'ad_scheduler_pinterest_worker',Class:PinterestHostedWorker}};
function platformConfig(platform){if(!Object.hasOwn(platforms,platform))throw Error('Choose a scheduler platform.');return platforms[platform];}
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export class SchedulerControls{
 constructor(pool,{env=process.env,clock=()=>new Date(),checkConnection=null}={}){this.pool=pool;this.env=env;this.clock=clock;this.checkConnection=checkConnection;}
 async inspect(platform,{db=this.pool,lock=false}={}){
  const c=platformConfig(platform),worker=new c.Class(this.pool,{env:this.env,clock:this.clock}),status=await worker.status();
  const reasons=[];if(status.setup_required)reasons.push('Scheduler storage needs installation.');if(!status.configured)reasons.push('Start controls need one-time server setup.');
  const tables=(await db.query(`SELECT to_regclass('${c.table}') IS NOT NULL AND to_regclass('ad_scheduler_plans') IS NOT NULL AND to_regclass('ad_scheduler_deliveries') IS NOT NULL AND to_regclass('ad_scheduler_settings') IS NOT NULL AS ready`)).rows[0]?.ready;
  if(!tables)return {platform,enabled:status.enabled,can_start:false,can_stop:!status.setup_required,reasons:[...reasons,'Approval storage needs installation.'],queue:[],queue_sha256:null,provider_requests:0};
  const settings=(await db.query('SELECT paused FROM ad_scheduler_settings WHERE id=1'+(lock?' FOR SHARE':''))).rows[0];if(settings?.paused!==false)reasons.push('The plan is paused. Resume it before starting.');
  const unfinished=(await db.query("SELECT plan_id FROM ad_scheduler_deliveries WHERE platform=$1 AND state<>'verified' LIMIT 1",[platform])).rows[0];if(unfinished)reasons.push('A previous delivery needs review. Do not resend it.');
  const rows=(await db.query(`SELECT a.plan_id,a.snapshot_sha256,a.destination_id,a.scheduled_at,p.scheduled_at AS plan_time,p.snapshot FROM ${c.table} a JOIN ad_scheduler_plans p ON p.id=a.plan_id LEFT JOIN ad_scheduler_deliveries d ON d.plan_id=a.plan_id WHERE a.status='approved' AND p.status='planned' AND p.platform=$1 AND d.plan_id IS NULL ORDER BY a.plan_id LIMIT 22${lock?' FOR SHARE OF a,p':''}`,[platform])).rows;
  if(platform==='pinterest'&&!rows.length)reasons.push('Approve a Pinterest Pin before starting.');
  if(rows.length>21)reasons.push('More than 21 posts await delivery. Review the queue.');const now=+this.clock();if(!Number.isFinite(now))throw Error('Scheduler clock needs review.');
  const queue=rows.map(r=>{const at=+new Date(r.scheduled_at);let hash;try{hash=deliverySnapshotHash(r.snapshot);}catch{}if(!Number.isFinite(at)||at<=now||at>now+7*86400000)reasons.push('An approved post is outside the upcoming seven-day window. Review its time.');const destination=platform==='pinterest'&&r.snapshot?.pinterest_board?.account==='lyribop'?r.snapshot.pinterest_board.id:c.account;if(!destination||r.destination_id!==destination||r.snapshot?.platform!==platform||hash!==r.snapshot_sha256||at!==+new Date(r.plan_time))reasons.push('Approved content, destination or time changed. Review it again.');return {plan_id:r.plan_id,board_name:platform==='pinterest'?r.snapshot?.pinterest_board?.name||null:null,name:typeof r.snapshot?.name==='string'?r.snapshot.name.slice(0,200):'Approved advertisement',scheduled_at:Number.isFinite(at)?new Date(at).toISOString():null,snapshot_sha256:r.snapshot_sha256};});
  return {platform,enabled:status.enabled,can_start:reasons.length===0&&!status.enabled,can_stop:!status.setup_required,needs_attention:status.needs_attention,last_tick:status.last_tick,last_outcome:status.last_outcome,reasons:[...new Set(reasons)],queue,queue_sha256:digest(queue),provider_requests:0};
 }
 async change(input){
  const c=platformConfig(input?.platform);if(input?.confirm!==true||typeof input.enabled!=='boolean')throw Error('Confirm the scheduler switch change.');
  validateDeliveryInstallation(this.env);
  if(input.enabled&&(!/^[a-f0-9]{64}$/.test(input.queue_sha256||'')||!this.checkConnection))throw Error('Review the approved queue before starting.');
  const db=await this.pool.connect();try{
   await db.query('BEGIN');await db.query(`SELECT pg_advisory_xact_lock(hashtext('lyribop-${input.platform}-pilot-approval-v1'))`);
   if(!input.enabled){const r=await db.query(`UPDATE ${c.worker} SET enabled=FALSE WHERE id=1 RETURNING id`);if(r.rowCount!==1)throw Error('Scheduler storage needs review.');await db.query('COMMIT');return {platform:input.platform,enabled:false,posts_changed:0};}
   const initial=await this.inspect(input.platform,{db});if(!initial.can_start||initial.queue_sha256!==input.queue_sha256)throw Error('Scheduler readiness or approved queue changed. Refresh and review again.');
   // Serialize switches while checking readiness; never hold plan locks during provider reads.
   try{await this.checkConnection(input.platform);}catch{throw Error('Connection needs review before scheduling can start. No posts sent by this action.');}
   const review=await this.inspect(input.platform,{db,lock:true});if(!review.can_start||review.queue_sha256!==input.queue_sha256)throw Error('Scheduler readiness or approved queue changed. Refresh and review again.');
   const r=await db.query(`UPDATE ${c.worker} SET enabled=TRUE WHERE id=1 RETURNING id`);if(r.rowCount!==1)throw Error('Scheduler storage needs review.');await db.query('COMMIT');return {platform:input.platform,enabled:true,posts_changed:0};
  }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
 }
}
