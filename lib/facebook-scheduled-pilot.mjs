import {isVideo,facebookVideoEnabled} from './scheduled-videos.mjs';
import {uploadSavedFacebookVideo,verifySavedFacebookVideo} from './facebook-scheduled-video.mjs';
import {isCollection,readCollectionArtwork} from './story-collections.mjs';
// Inert controlled dispatcher. No route, startup hook, polling, timer, or retries.
import {validateDelivery} from './ad-delivery-records.mjs';
import {FacebookTestGraph,verifiedFacebookLink} from './facebook-test-post.mjs';
const PAGE='1271936012676830',INSTAGRAM='17841431950776323';
const stop=()=>{throw Error('Scheduled Facebook pilot needs review. Do not resend.');};
export async function uploadSavedFacebookPhoto(page,image,caption){
 const body=new FormData();body.set('source',new Blob([image],{type:'image/png'}),'lyribop.png');body.set('caption',caption);body.set('published','true');
 try{
  const r=await page.fetch('https://graph.facebook.com/v26.0/'+PAGE+'/photos',{method:'POST',headers:{Authorization:'Bearer '+page.token},body,redirect:'error',signal:AbortSignal.timeout(15000)});
  const d=await r.json();if(!r.ok||d.error)stop();return d;
 }catch{stop();}
}

export async function uploadSavedFacebookCollection(page,images,caption,beforePublish=async()=>{}){
 const ids=[];
 for(const image of images){
  const body=new FormData();body.set('source',new Blob([image],{type:'image/png'}),'lyribop-panel.png');body.set('published','false');body.set('temporary','true');
  const r=await page.fetch('https://graph.facebook.com/v26.0/'+PAGE+'/photos',{method:'POST',headers:{Authorization:'Bearer '+page.token},body,redirect:'error',signal:AbortSignal.timeout(15000)});
  const d=await r.json();if(!r.ok||d.error||typeof d.id!=='string'||!/^\d+$/.test(d.id)||ids.includes(d.id))stop();ids.push(d.id);
 }
 await beforePublish();
 const post=await page.call('/'+PAGE+'/feed',{message:caption,attached_media:JSON.stringify(ids.map(id=>({media_fbid:id})))});
 return {post_id:post.id,photo_ids:ids};
}

export async function runScheduledFacebookPilot({pool,records,connections,approval,requireWorkerEnabled=false,graphFactory=token=>new FacebookTestGraph(token),upload=uploadSavedFacebookPhoto,uploadCollection=uploadSavedFacebookCollection,uploadVideo=uploadSavedFacebookVideo,verifyVideo=verifySavedFacebookVideo,env=process.env}){
 if(approval?.approved!==true||approval.platform!=='facebook'||approval.destination!==PAGE||!/^([a-f0-9]{64})$/.test(approval.snapshot_sha256||'')||!Number.isFinite(+new Date(approval.scheduled_at)))stop();
 // Preview data is checked again atomically when claiming, then before publishing.
 const plan=(await pool.query('SELECT * FROM ad_scheduler_plans WHERE id=$1',[approval.plan_id])).rows[0];
 const image=(await pool.query('SELECT image FROM ad_scheduler_media WHERE sha256=$1',[plan?.snapshot?.image_sha256])).rows[0]?.image;
 if(plan?.platform!=='facebook'||validateDelivery(plan,image,PAGE)!==approval.snapshot_sha256||+new Date(plan.scheduled_at)!==+new Date(approval.scheduled_at))stop();
 if(isVideo(plan.snapshot)&&!facebookVideoEnabled(env))throw Error('Facebook video publishing is not enabled.');
 const panels=isCollection(plan.snapshot)?await readCollectionArtwork(pool,plan.snapshot):null;
 return connections.withCheckedConnection('facebook',async ({token,accountId})=>{
  if(accountId!==PAGE)stop();
  const page=await graphFactory(token).page({page_id:PAGE,instagram_id:INSTAGRAM});
  const claim=await records.reserve({planId:plan.id,destination:PAGE,approved:true,expectedHash:approval.snapshot_sha256,expectedScheduledAt:approval.scheduled_at,requireSavedApproval:true,requireWorkerEnabled});
  let state='reserved';
  const advance=async(to,extra={})=>{await records.advance({planId:plan.id,claimId:claim.claim_id,from:state,to,requireSavedApproval:true,requireWorkerEnabled,...extra});state=to;};
  try{
   await advance('publishing');
   if(isVideo(plan.snapshot)){
    await records.checkPublishing({planId:plan.id,claimId:claim.claim_id,requireWorkerEnabled});
    const id=await uploadVideo(page,plan.snapshot,image);
    await advance('verifying',{remoteId:PAGE+'_'+id});
    const permalink=await verifyVideo(page,plan.snapshot,id);await advance('verified',{permalink});
    return {plan_id:plan.id,status:'verified',permalink,automatic_worker_enabled:false};
   }
   const result=panels?await uploadCollection(page,panels,plan.snapshot.caption,()=>records.checkPublishing({planId:plan.id,claimId:claim.claim_id,requireWorkerEnabled})):await upload(page,image,plan.snapshot.caption);
   if(typeof result.post_id!=='string'||!/^1271936012676830_\d+$/.test(result.post_id))stop();
   await advance('verifying',{remoteId:result.post_id});
   const post=panels?await page.call('/'+result.post_id+'?fields=id,from,message,permalink_url,attachments{subattachments{target}}'):await page.verify(result.post_id);
   if(panels){const ids=post.attachments?.data?.[0]?.subattachments?.data?.map(a=>a.target?.id);if(!Array.isArray(result.photo_ids)||result.photo_ids.length!==4||!Array.isArray(ids)||JSON.stringify(ids)!==JSON.stringify(result.photo_ids))stop();}
   const permalink=verifiedFacebookLink(post,result.post_id,{page_id:PAGE,caption:plan.snapshot.caption});
   await advance('verified',{permalink});
   return {plan_id:plan.id,status:'verified',permalink,automatic_worker_enabled:false};
  }catch{
   try{await advance('needs_review');}catch{}
   // A crash or failed state write also leaves a permanent claim; never reclaim it.
   stop();
  }
 });
}
