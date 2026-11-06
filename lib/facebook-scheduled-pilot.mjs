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
export async function runScheduledFacebookPilot({pool,records,connections,approval,graphFactory=token=>new FacebookTestGraph(token),upload=uploadSavedFacebookPhoto}){
 if(approval?.approved!==true||approval.platform!=='facebook'||approval.destination!==PAGE||!/^([a-f0-9]{64})$/.test(approval.snapshot_sha256||'')||!Number.isFinite(+new Date(approval.scheduled_at)))stop();
 // Preview data is checked again atomically when claiming, then before publishing.
 const plan=(await pool.query('SELECT * FROM ad_scheduler_plans WHERE id=$1',[approval.plan_id])).rows[0];
 const image=(await pool.query('SELECT image FROM ad_scheduler_media WHERE sha256=$1',[plan?.snapshot?.image_sha256])).rows[0]?.image;
 if(plan?.platform!=='facebook'||validateDelivery(plan,image,PAGE)!==approval.snapshot_sha256||+new Date(plan.scheduled_at)!==+new Date(approval.scheduled_at))stop();
 return connections.withCheckedConnection('facebook',async ({token,accountId})=>{
  if(accountId!==PAGE)stop();
  const page=await graphFactory(token).page({page_id:PAGE,instagram_id:INSTAGRAM});
  const claim=await records.reserve({planId:plan.id,destination:PAGE,approved:true,expectedHash:approval.snapshot_sha256,expectedScheduledAt:approval.scheduled_at,requireSavedApproval:true});
  let state='reserved';
  const advance=async(to,extra={})=>{await records.advance({planId:plan.id,claimId:claim.claim_id,from:state,to,requireSavedApproval:true,...extra});state=to;};
  try{
   await advance('publishing');
   const result=await upload(page,image,plan.snapshot.caption);
   if(typeof result.post_id!=='string'||!/^1271936012676830_\d+$/.test(result.post_id))stop();
   await advance('verifying',{remoteId:result.post_id});
   const post=await page.verify(result.post_id);
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
