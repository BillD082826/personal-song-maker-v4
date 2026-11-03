// Inert one-post tool. No scheduler, timer, HTTP route or automatic retry.
import {digest} from './instagram-test-post.mjs';
export class FacebookTestError extends Error {}
const fail=()=>{throw new FacebookTestError('Facebook test needs review. No retry is permitted.');};
const numeric=x=>typeof x==='string'&&/^\d+$/.test(x);
export function validateFacebookTest(s,image,origin){
 if(s.test_id!=='lyribop-facebook-ad1-v1'||s.page_id!=='1271936012676830'||s.business_id!=='1050270251226174'||s.instagram_id!=='17841431950776323')fail();
 if(!s.caption||s.caption.length>2200||digest(s.caption)!==s.caption_sha256)fail();
 if(!image.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||image.length>8*1024*1024||digest(image)!==s.image_sha256)fail();
 const u=new URL(s.image_url);if(u.origin!==origin||u.protocol!=='https:'||u.pathname!=='/social-test/lyribop-facebook-ad1-v1.png'||u.search||u.hash||u.username||u.password)fail();
}
export class FacebookTestStore {
 constructor(pool){this.pool=pool;}
 async reserve(s){
  await this.pool.query(`CREATE TABLE IF NOT EXISTS ad_scheduler_facebook_test_runs(test_id TEXT PRIMARY KEY,page_id TEXT NOT NULL,image_sha256 TEXT NOT NULL,caption_sha256 TEXT NOT NULL,state TEXT NOT NULL,photo_id TEXT,post_id TEXT,permalink TEXT,updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  return (await this.pool.query("INSERT INTO ad_scheduler_facebook_test_runs(test_id,page_id,image_sha256,caption_sha256,state) VALUES($1,$2,$3,$4,'reserved') ON CONFLICT DO NOTHING RETURNING test_id",[s.test_id,s.page_id,s.image_sha256,s.caption_sha256])).rowCount===1;
 }
 async mark(id,state,d={}){await this.pool.query('UPDATE ad_scheduler_facebook_test_runs SET state=$2,photo_id=COALESCE($3,photo_id),post_id=COALESCE($4,post_id),permalink=COALESCE($5,permalink),updated_at=now() WHERE test_id=$1',[id,state,d.photo_id||null,d.post_id||null,d.permalink||null]);}
}
export class FacebookTestGraph {
 constructor(token,fetchImpl=fetch){this.token=token;this.fetch=fetchImpl;}
 async call(path,body){
  try{const r=await this.fetch('https://graph.facebook.com/v26.0'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+this.token,...(body?{'Content-Type':'application/x-www-form-urlencoded'}:{})},...(body?{body:new URLSearchParams(body)}:{}),redirect:'error',signal:AbortSignal.timeout(15000)});const d=await r.json();if(!r.ok||d.error)fail();return d;}catch{fail();}
 }
 async page(s){
  const d=await this.call('/'+s.page_id+'?fields=id,access_token,instagram_business_account');
  if(d.id!==s.page_id||d.instagram_business_account?.id!==s.instagram_id||typeof d.access_token!=='string'||!d.access_token)fail();
  const g=new FacebookTestGraph(d.access_token,this.fetch);
  const me=await g.call('/me?fields=id');if(me.id!==s.page_id)fail();return g;
 }
 publish(s){return this.call('/'+s.page_id+'/photos',{url:s.image_url,caption:s.caption,published:'true'});}
 verify(id){return this.call('/'+id+'?fields=id,from,message,permalink_url');}
}
export async function runFacebookTest({spec,image,origin,approved=false,store,graph}){
 validateFacebookTest(spec,image,origin);if(approved!==true)fail();
 // Read-only Page-token identity check before reserving; no credentials persisted.
 const page=await graph.page(spec);
 if(!await store.reserve(spec))throw new FacebookTestError('This test already has a record. No second post will be attempted.');
 let stage='publishing';
 try{
  await store.mark(spec.test_id,stage);
  const d=await page.publish(spec);
  if(!numeric(d.id)||typeof d.post_id!=='string'||!new RegExp('^'+spec.page_id+'_\\d+$').test(d.post_id))fail();
  stage='verifying';await store.mark(spec.test_id,stage,{photo_id:d.id,post_id:d.post_id});
  const v=await page.verify(d.post_id);const u=new URL(v.permalink_url);
  if(v.id!==d.post_id||v.from?.id!==spec.page_id||v.message!==spec.caption||u.protocol!=='https:'||!['www.facebook.com','facebook.com'].includes(u.hostname)||u.username||u.password||u.hash||!u.pathname.startsWith('/'+spec.page_id+'/posts/'))fail();
  await store.mark(spec.test_id,'verified',{permalink:u.href});
  return {test_id:spec.test_id,status:'verified',post_id:d.post_id,permalink:u.href,publishing_enabled:false};
 }catch{try{await store.mark(spec.test_id,'needs_review_'+stage);}catch{}throw new FacebookTestError('Stopped at '+stage+'. A post may exist. Do not retry; inspect the saved record.');}
}
