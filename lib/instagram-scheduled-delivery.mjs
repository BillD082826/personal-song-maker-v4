// Inactive delivery adapter. Invoked only by an explicitly enabled approved scheduler.
import {readFile} from 'node:fs/promises';import {resolve} from 'node:path';import {createHash} from 'node:crypto';
import {DeliveryRecords,validateDelivery} from './ad-delivery-records.mjs';
import {validatePreparedInstagramMedia} from './instagram-scheduler-media.mjs';
import {InstagramTestGraph} from './instagram-test-post.mjs';
const ACCOUNT='17841431950776323',ORIGIN='https://personal-song-maker-v5-test.onrender.com';
const fail=()=>{throw Error('Scheduled Instagram delivery needs review. Do not resend.');};
const numeric=x=>typeof x==='string'&&/^\d+$/.test(x);
const sha=x=>createHash('sha256').update(x).digest('hex');
export class InstagramDeliveryRecords extends DeliveryRecords{
 async rememberContainer(planId,claimId,id){
  if(!numeric(id))fail();const r=await this.pool.query("UPDATE ad_scheduler_deliveries SET container_id=$3,updated_at=$4 WHERE plan_id=$1 AND claim_id=$2 AND platform='instagram' AND state='creating' AND container_id IS NULL RETURNING plan_id",[planId,claimId,id,this.clock().toISOString()]);if(r.rowCount!==1)fail();
 }
 async checkSavedApproval(db,planId,hash,at,destination){
  const a=(await db.query('SELECT * FROM ad_scheduler_instagram_approvals WHERE plan_id=$1 FOR SHARE',[planId])).rows[0];
  if(destination!==ACCOUNT||!a||a.status!=='approved'||a.destination_id!==ACCOUNT||a.snapshot_sha256!==hash||+new Date(a.scheduled_at)!==+new Date(at))fail();
 }
 async checkWorker(db){if((await db.query('SELECT enabled FROM ad_scheduler_instagram_worker WHERE id=1 FOR SHARE')).rows[0]?.enabled!==true)fail();}
}
export async function readScheduledInstagramArtwork(plan,png,publicRoot=resolve('public')){
 const m=plan?.snapshot?.publishing_media;
 if(m?.format!=='jpeg'||! /^[a-f0-9]{64}$/.test(m.sha256||'')||m.path!==`/social-scheduler/${m.sha256}.jpg`)fail();
 const jpeg=await readFile(resolve(publicRoot,'social-scheduler',m.sha256+'.jpg'));
 validatePreparedInstagramMedia({source_sha256:m.source_sha256,jpeg_sha256:m.sha256,path:m.path,width:m.width,height:m.height},png,jpeg);
 return {bytes:jpeg,url:ORIGIN+m.path};
}
export async function checkPublicInstagramArtwork(art,fetchImpl=fetch){
 if(typeof art?.url!=='string'||!new RegExp('^'+ORIGIN.replaceAll('.','\\.')+'/social-scheduler/[a-f0-9]{64}\\.jpg$').test(art.url))fail();
 const response=await fetchImpl(art.url,{redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!response.ok||!response.headers.get('content-type')?.toLowerCase().startsWith('image/jpeg')||!response.body)fail();
 const chunks=[];let length=0;const reader=response.body.getReader();
 try{for(;;){const r=await reader.read();if(r.done)break;length+=r.value.length;if(length>8*1024*1024){await reader.cancel();fail();}chunks.push(Buffer.from(r.value));}}finally{reader.releaseLock();}
 if(sha(Buffer.concat(chunks))!==sha(art.bytes))fail();
}
class ScheduledInstagramGraph extends InstagramTestGraph{
 verify(id){return this.call('/'+id+'?fields=id,owner,permalink,caption,username,media_type');}
}
export async function runScheduledInstagramDelivery({pool,records,connections,approval,requireWorkerEnabled=true,readArtwork=readScheduledInstagramArtwork,checkPublic=checkPublicInstagramArtwork,graphFactory=token=>new ScheduledInstagramGraph(token),wait=ms=>new Promise(r=>setTimeout(r,ms))}){
 if(approval?.approved!==true||approval.platform!=='instagram'||approval.destination!==ACCOUNT||! /^[a-f0-9]{64}$/.test(approval.snapshot_sha256||'')||!Number.isFinite(Date.parse(approval.scheduled_at)))fail();
 const plan=(await pool.query('SELECT * FROM ad_scheduler_plans WHERE id=$1',[approval.plan_id])).rows[0];
 const png=(await pool.query('SELECT image FROM ad_scheduler_media WHERE sha256=$1',[plan?.snapshot?.image_sha256])).rows[0]?.image;
 if(plan?.platform!=='instagram'||validateDelivery(plan,png,ACCOUNT)!==approval.snapshot_sha256||+new Date(plan.scheduled_at)!==+new Date(approval.scheduled_at))fail();
 const art=await readArtwork(plan,png);await checkPublic(art);
 return connections.withCheckedConnection('instagram',async({token,accountId})=>{
  if(accountId!==ACCOUNT)fail();const graph=graphFactory(token);
  const claim=await records.reserve({planId:plan.id,destination:ACCOUNT,approved:true,expectedHash:approval.snapshot_sha256,expectedScheduledAt:approval.scheduled_at,requireSavedApproval:true,requireWorkerEnabled});
  let state='reserved',containerId=null;
  const advance=async(to,extra={})=>{await records.advance({planId:plan.id,claimId:claim.claim_id,from:state,to,requireSavedApproval:true,requireWorkerEnabled,...extra});state=to;};
  try{
   await advance('creating');const container=await graph.create({account_id:ACCOUNT,image_url:art.url,caption:plan.snapshot.caption});if(!numeric(container.id))fail();containerId=container.id;
   // Save the returned ID immediately, before checking readiness; permanent claim prevents retries.
   await records.rememberContainer(plan.id,claim.claim_id,containerId);
   let ready=false;for(let attempt=0;attempt<5;attempt++){const status=await graph.status(containerId);if(status.status_code==='FINISHED'){ready=true;break;}if(status.status_code!=='IN_PROGRESS')fail();if(attempt<4)await wait(3000);}if(!ready)fail();
   await advance('container_ready',{containerId});await advance('publishing');
   const media=await graph.publish(ACCOUNT,containerId);if(!numeric(media.id))fail();
   await advance('verifying',{remoteId:media.id});const post=await graph.verify(media.id);let link;try{link=new URL(post.permalink);}catch{}
   if(post.id!==media.id||post.owner?.id!==ACCOUNT||post.username!=='lyribop'||post.caption!==plan.snapshot.caption||post.media_type!=='IMAGE'||!link||link.protocol!=='https:'||!['instagram.com','www.instagram.com'].includes(link.hostname)||!/^\/p\/[^/]+\/?$/.test(link.pathname)||link.search||link.hash||link.port||link.username||link.password)fail();
   if(!link.pathname.endsWith('/'))link.pathname+='/';await advance('verified',{permalink:link.href});return {plan_id:plan.id,status:'verified',permalink:link.href};
  }catch{try{await advance('needs_review');}catch{}fail();}
 });
}
