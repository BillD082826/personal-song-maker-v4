// One explicitly approved Instagram test only. No scheduler, timer or activation route.
import {createHash} from 'node:crypto';
const API='https://graph.facebook.com/v26.0';
export const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export class TestPostError extends Error {}
export function validateTest(spec,config,image){
 if(spec.test_id!=='lyribop-instagram-ad29-v1'||spec.account_id!=='17841431950776323'||spec.business_id!=='1050270251226174'||spec.username!=='lyribop')throw new TestPostError('Test destination needs review.');
 if(config.expectedInstagramId!==spec.account_id||config.expectedBusinessId!==spec.business_id)throw new TestPostError('Configured destination does not match the approved test.');
 if(!spec.caption||spec.caption.length>2200||digest(spec.caption)!==spec.caption_sha256)throw new TestPostError('Approved caption changed.');
 if(image.length>8*1024*1024||image[0]!==255||image[1]!==216||digest(image)!==spec.image_sha256)throw new TestPostError('Approved JPEG changed or is invalid.');
 const url=new URL(spec.image_url);if(url.origin!==config.origin||url.pathname!=='/social-test/lyribop-instagram-ad29-v1.jpg'||url.search||url.hash)throw new TestPostError('Test image address needs review.');
}
export class TestRunStore {
 constructor(pool){this.pool=pool;}
 async reserve(spec){
  await this.pool.query(`CREATE TABLE IF NOT EXISTS ad_scheduler_instagram_test_runs (
   test_id TEXT PRIMARY KEY,account_id TEXT NOT NULL,image_sha256 TEXT NOT NULL,caption_sha256 TEXT NOT NULL,
   state TEXT NOT NULL,container_id TEXT,media_id TEXT,permalink TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  const result=await this.pool.query("INSERT INTO ad_scheduler_instagram_test_runs(test_id,account_id,image_sha256,caption_sha256,state) VALUES($1,$2,$3,$4,'reserved') ON CONFLICT DO NOTHING RETURNING test_id",[spec.test_id,spec.account_id,spec.image_sha256,spec.caption_sha256]);
  return result.rowCount===1;
 }
 async mark(id,state,details={}){
  await this.pool.query('UPDATE ad_scheduler_instagram_test_runs SET state=$2,container_id=COALESCE($3,container_id),media_id=COALESCE($4,media_id),permalink=COALESCE($5,permalink),updated_at=now() WHERE test_id=$1',[id,state,details.container_id||null,details.media_id||null,details.permalink||null]);
 }
}
export class InstagramTestGraph {
 constructor(token,fetchImpl=fetch){this.token=token;this.fetch=fetchImpl;}
 async call(path,body){
  try{
   const response=await this.fetch(API+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+this.token,...(body?{'Content-Type':'application/x-www-form-urlencoded'}:{})},...(body?{body:new URLSearchParams(body)}:{}),redirect:'error',signal:AbortSignal.timeout(15000)});
   const data=await response.json();if(!response.ok||data.error)throw Error();return data;
  }catch{throw new TestPostError('Meta did not return a confirmed result. Do not repeat the test; review its saved record.');}
 }
 create(spec){return this.call('/'+spec.account_id+'/media',{image_url:spec.image_url,caption:spec.caption});}
 status(id){return this.call('/'+id+'?fields=status_code');}
 publish(account,id){return this.call('/'+account+'/media_publish',{creation_id:id});}
 verify(id){return this.call('/'+id+'?fields=id,permalink,caption,username,media_type');}
}
const numeric=value=>typeof value==='string'&&/^\d+$/.test(value);
export async function runApprovedTest({spec,config,image,store,graph,approved=false,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))}){
 validateTest(spec,config,image);
 if(approved!==true)throw new TestPostError('Explicit approval to publish this one test is required.');
 if(!await store.reserve(spec))throw new TestPostError('This test already has a record. No second post will be attempted.');
 let stage='creating';
 try{
  await store.mark(spec.test_id,stage);
  const container=await graph.create(spec);if(!numeric(container.id))throw new TestPostError('No confirmed media container ID.');
  await store.mark(spec.test_id,'container_created',{container_id:container.id});
  let ready=false;
  for(let attempt=0;attempt<5;attempt++){
   const status=await graph.status(container.id);
   if(status.status_code==='FINISHED'){ready=true;break;}
   if(status.status_code!=='IN_PROGRESS')throw new TestPostError('Media container needs review.');
   if(attempt<4)await wait(3000);
  }
  if(!ready)throw new TestPostError('Media is not ready. No publication was attempted.');
  stage='publishing';await store.mark(spec.test_id,stage);
  // Exactly one attempt: an unknown result must never cause a second publish.
  const media=await graph.publish(spec.account_id,container.id);if(!numeric(media.id))throw new TestPostError('No confirmed publication ID.');
  stage='verifying';await store.mark(spec.test_id,stage,{media_id:media.id});
  const verified=await graph.verify(media.id);let link;try{link=new URL(verified.permalink);}catch{}
  if(verified.id!==media.id||verified.caption!==spec.caption||verified.username!==spec.username||verified.media_type!=='IMAGE'||!link||link.protocol!=='https:'||!['www.instagram.com','instagram.com'].includes(link.hostname)||!/^\/p\/[^/]+\/?$/.test(link.pathname)||link.username||link.password)throw new TestPostError('Publication may exist, but its details need review. Do not publish again.');
  await store.mark(spec.test_id,'verified',{media_id:media.id,permalink:link.href});
  return {test_id:spec.test_id,status:'verified',media_id:media.id,permalink:link.href,publishing_enabled:false};
 }catch{
  try{await store.mark(spec.test_id,'needs_review_'+stage);}catch{}
  throw new TestPostError('Test stopped at '+stage+'. A post may exist if publishing began. Do not retry; inspect the saved record.');
 }
}

// Read-only reporting; never initializes a test table or activates a connection.
export async function verifiedInstagramTests(pool){
 const exists=await pool.query("SELECT to_regclass('ad_scheduler_instagram_test_runs') AS relation");
 if(!exists.rows[0]?.relation)return [];
 const result=await pool.query("SELECT test_id,account_id,media_id,permalink,updated_at FROM ad_scheduler_instagram_test_runs WHERE test_id=$1 AND account_id=$2 AND state='verified' ORDER BY updated_at DESC LIMIT 1",['lyribop-instagram-ad29-v1','17841431950776323']);
 return result.rows.flatMap(row=>{
  let url;try{url=new URL(row.permalink);}catch{return [];}
  if(!numeric(row.media_id)||url.protocol!=='https:'||!['instagram.com','www.instagram.com'].includes(url.hostname)||!/^\/p\/[^/]+\/?$/.test(url.pathname)||url.username||url.password||!Number.isFinite(+new Date(row.updated_at)))return [];
  return [{id:row.test_id,platform:'instagram',name:'Turn Your Story into a Song — Instagram',media_id:row.media_id,permalink:url.href,verified_at:new Date(row.updated_at).toISOString(),status:'Verified manual test'}];
 });
}
