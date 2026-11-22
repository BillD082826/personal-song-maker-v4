// Durable, approval-bound preparation. This registry never creates a public Pin.
import {validateDelivery,deliverySnapshotHash} from './ad-delivery-records.mjs';
import {isVideo,pinterestVideoEnabled} from './scheduled-videos.mjs';
import {uploadPinterestVideo} from './pinterest-scheduled-video.mjs';
import {pinterestDeliverySpec} from './pinterest-scheduled-delivery.mjs';
import {PinterestStore,pinterestConfiguration} from './pinterest-connection.mjs';
import {TrialPinGraph} from './pinterest-test-pin.mjs';
export const UPLOAD_SCHEMA=`CREATE TABLE IF NOT EXISTS ad_scheduler_pinterest_video_uploads(
 plan_id UUID PRIMARY KEY REFERENCES ad_scheduler_plans(id),snapshot_sha256 TEXT NOT NULL,
 scheduled_at TIMESTAMPTZ NOT NULL,media_id TEXT,
 state TEXT NOT NULL CHECK(state IN ('registering','uploading','processing','ready','needs_review')),
 created_at TIMESTAMPTZ NOT NULL,updated_at TIMESTAMPTZ NOT NULL
);`;
const fail=()=>{throw Error('Pinterest video preparation needs review.');};
export class PinterestVideoUploads{
 constructor(pool,{env=process.env,clock=()=>new Date(),graphFactory=null,fetchImpl=fetch}={}){this.pool=pool;this.env=env;this.clock=clock;this.graphFactory=graphFactory;this.fetchImpl=fetchImpl;}
 async install(){await this.pool.query(UPLOAD_SCHEMA);}
 async available(){return Boolean((await this.pool.query("SELECT to_regclass('ad_scheduler_pinterest_video_uploads') AS relation")).rows[0]?.relation);}
 async graph(plan){if(this.graphFactory)return this.graphFactory(plan);const config=pinterestConfiguration(this.env,'https://personal-song-maker-v5-test.onrender.com','production'),token=await new PinterestStore(this.pool).boardAuthorization(config,{readOnly:true});return new TrialPinGraph(token);}
 async transaction(fn){const db=await this.pool.connect();try{await db.query('BEGIN');const result=await fn(db);await db.query('COMMIT');return result;}catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}}
 async guard(id,hash,{uploading=false,db=this.pool}={}){
  if(!pinterestVideoEnabled(this.env))fail();
  const p=(await db.query('SELECT * FROM ad_scheduler_plans WHERE id=$1'+(db===this.pool?'':' FOR SHARE'),[id])).rows[0],a=(await db.query('SELECT * FROM ad_scheduler_pinterest_approvals WHERE plan_id=$1'+(db===this.pool?'':' FOR SHARE'),[id])).rows[0],paused=(await db.query('SELECT paused FROM ad_scheduler_settings WHERE id=1'+(db===this.pool?'':' FOR SHARE'))).rows[0]?.paused,enabled=(await db.query('SELECT enabled FROM ad_scheduler_pinterest_worker WHERE id=1'+(db===this.pool?'':' FOR SHARE'))).rows[0]?.enabled;
  const now=+this.clock(),at=+new Date(p?.scheduled_at);if(!Number.isFinite(now)||!isVideo(p?.snapshot)||p.platform!=='pinterest'||p.status!=='planned'||paused!==false||enabled!==true||a?.status!=='approved'||a.destination_id!==p.snapshot.pinterest_board?.id||a.snapshot_sha256!==hash||deliverySnapshotHash(p.snapshot)!==hash||+new Date(a.scheduled_at)!==at||at<now-60000||at>now+30*60000||(uploading&&at<=now))fail();
  if((await db.query('SELECT plan_id FROM ad_scheduler_deliveries WHERE plan_id=$1',[id])).rowCount)fail();
  const bytes=(await db.query('SELECT image FROM ad_scheduler_media WHERE sha256=$1',[p.snapshot.image_sha256])).rows[0]?.image;if(validateDelivery(p,bytes,a.destination_id)!==hash)fail();return {plan:p,bytes};
 }
 async mark(id,state){await this.pool.query('UPDATE ad_scheduler_pinterest_video_uploads SET state=$2,updated_at=$3 WHERE plan_id=$1',[id,state,this.clock().toISOString()]);}
 async prepare(id,hash){
  const {plan,bytes}=await this.guard(id,hash,{uploading:true}),spec=pinterestDeliverySpec(plan.snapshot,bytes),graph=await this.graph(plan);await graph.preflight(spec);
  const reserved=await this.transaction(async db=>{await this.guard(id,hash,{uploading:true,db});return (await db.query("INSERT INTO ad_scheduler_pinterest_video_uploads(plan_id,snapshot_sha256,scheduled_at,state,created_at,updated_at) VALUES($1,$2,$3,'registering',$4,$4) ON CONFLICT(plan_id) DO NOTHING RETURNING plan_id",[id,hash,plan.scheduled_at,this.clock().toISOString()])).rowCount===1;});
  if(!reserved)return {status:'already_preparing'};
  try{const mediaId=await uploadPinterestVideo({graph,snapshot:plan.snapshot,bytes,spec,env:this.env,fetchImpl:this.fetchImpl,checkPublishing:()=>this.guard(id,hash,{uploading:true}),rememberMedia:async mediaId=>{const r=await this.pool.query("UPDATE ad_scheduler_pinterest_video_uploads SET media_id=$2,state='uploading',updated_at=$3 WHERE plan_id=$1 AND state='registering' AND media_id IS NULL RETURNING plan_id",[id,mediaId,this.clock().toISOString()]);if(r.rowCount!==1)fail();}});await this.mark(id,'processing');return {status:'processing',media_id:mediaId};}
  catch{const row=(await this.pool.query('SELECT media_id FROM ad_scheduler_pinterest_video_uploads WHERE plan_id=$1',[id])).rows[0];if(!row?.media_id)await this.mark(id,'needs_review');return {status:row?.media_id?'uploading':'needs_review'};}
 }
 async poll(row){
  try{const {plan}=await this.guard(row.plan_id,row.snapshot_sha256);if(!/^\d+$/.test(row.media_id||'')){await this.mark(row.plan_id,'needs_review');return {status:'needs_review'};}
   const graph=await this.graph(plan),media=await graph.call('/media/'+row.media_id);if(media.media_id!==row.media_id||media.media_type!=='video'||!['registered','processing','succeeded','failed'].includes(media.status))fail();
   await this.guard(row.plan_id,row.snapshot_sha256);const status=media.status==='succeeded'?'ready':media.status==='failed'?'needs_review':'processing';await this.mark(row.plan_id,status);return {status};
  }catch{await this.mark(row.plan_id,'needs_review');return {status:'needs_review'};}
 }
 async step({allowUpload=true}={}){
  if(!pinterestVideoEnabled(this.env)||!await this.available())return {status:'disabled'};
  const now=this.clock();await this.pool.query("UPDATE ad_scheduler_pinterest_video_uploads SET state='needs_review',updated_at=$1 WHERE state<>'needs_review' AND scheduled_at<$2 AND NOT EXISTS(SELECT 1 FROM ad_scheduler_deliveries d WHERE d.plan_id=ad_scheduler_pinterest_video_uploads.plan_id AND d.state='verified')",[now.toISOString(),new Date(+now-60000).toISOString()]);
  // Resume only read-only checks of a known upload. An unknown registration is never repeated.
  const pending=(await this.pool.query("SELECT u.* FROM ad_scheduler_pinterest_video_uploads u JOIN ad_scheduler_plans p ON p.id=u.plan_id WHERE u.state IN ('registering','uploading','processing') AND p.status='planned' ORDER BY u.scheduled_at LIMIT 1")).rows[0];if(pending)return this.poll(pending);
  if(!allowUpload)return {status:'waiting'};
  const next=(await this.pool.query("SELECT p.id,a.snapshot_sha256 FROM ad_scheduler_plans p JOIN ad_scheduler_pinterest_approvals a ON a.plan_id=p.id LEFT JOIN ad_scheduler_pinterest_video_uploads u ON u.plan_id=p.id LEFT JOIN ad_scheduler_deliveries d ON d.plan_id=p.id WHERE p.platform='pinterest' AND p.status='planned' AND p.snapshot->>'format'='video' AND a.status='approved' AND a.scheduled_at=p.scheduled_at AND u.plan_id IS NULL AND d.plan_id IS NULL AND p.scheduled_at>$1 AND p.scheduled_at<=$2 ORDER BY p.scheduled_at LIMIT 1",[new Date(+now+240000).toISOString(),new Date(+now+30*60000).toISOString()])).rows[0];if(!next)return {status:'waiting'};
  try{return await this.prepare(next.id,next.snapshot_sha256);}catch{return {status:'needs_review'};}
 }
 async ready(plan,hash){if(!pinterestVideoEnabled(this.env)||!await this.available())fail();const r=(await this.pool.query('SELECT * FROM ad_scheduler_pinterest_video_uploads WHERE plan_id=$1',[plan.id])).rows[0],now=+this.clock(),at=+new Date(plan.scheduled_at);if(!r||r.state!=='ready'||!/^\d+$/.test(r.media_id||'')||r.snapshot_sha256!==hash||+new Date(r.scheduled_at)!==at||now<at||now-at>60000)fail();return r.media_id;}
 async statuses(){if(!await this.available())return new Map();return new Map((await this.pool.query('SELECT plan_id,state FROM ad_scheduler_pinterest_video_uploads')).rows.map(r=>[r.plan_id,r.state]));}
}
