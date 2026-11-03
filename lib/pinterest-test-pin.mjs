// Exactly one separately approved Trial Pin. No automatic scheduler or retries.
import {digest} from './instagram-test-post.mjs';
export class TrialPinError extends Error {}
const fail=()=>{throw new TrialPinError('Trial Pin needs review. Do not retry creation.');};
const numeric=x=>typeof x==='string'&&/^\d+$/.test(x);
export function validateTrialPin(s,image){
 if(s.test_id!=='lyribop-pinterest-story-v1'||s.account_id!=='1138144274488601260'||s.username!=='lyribop'||s.board_id!=='1138144205771307778'||s.trial_creator_only!==true)fail();
 if(typeof s.title!=='string'||!s.title||s.title.length>100||typeof s.description!=='string'||!s.description||s.description.length>800||s.link!=='https://personal-song-maker-v5-test.onrender.com/'||digest(JSON.stringify([s.title,s.description,s.link,s.board_id]))!==s.content_sha256)fail();
 if(image.length>8*1024*1024||!image.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||digest(image)!==s.image_sha256)fail();
}
export class TrialPinStore {
 constructor(pool){this.pool=pool;}
 async reserve(s){await this.pool.query('CREATE TABLE IF NOT EXISTS ad_scheduler_pinterest_test_pins(test_id TEXT PRIMARY KEY,account_id TEXT NOT NULL,board_id TEXT NOT NULL,image_sha256 TEXT NOT NULL,content_sha256 TEXT NOT NULL,state TEXT NOT NULL,pin_id TEXT,updated_at TIMESTAMPTZ NOT NULL DEFAULT now())');return (await this.pool.query("INSERT INTO ad_scheduler_pinterest_test_pins(test_id,account_id,board_id,image_sha256,content_sha256,state) VALUES($1,$2,$3,$4,$5,'reserved') ON CONFLICT DO NOTHING RETURNING test_id",[s.test_id,s.account_id,s.board_id,s.image_sha256,s.content_sha256])).rowCount===1;}
 async mark(id,state,pinId=null){await this.pool.query('UPDATE ad_scheduler_pinterest_test_pins SET state=$2,pin_id=COALESCE($3,pin_id),updated_at=now() WHERE test_id=$1',[id,state,pinId]);}
}
export class TrialPinGraph {
 constructor(token,fetchImpl=fetch){this.token=token;this.fetch=fetchImpl;}
 async call(path,body){try{const r=await this.fetch('https://api.pinterest.com/v5'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+this.token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(20000)});if(!r.ok)fail();return await r.json();}catch{fail();}}
 async preflight(s){const a=await this.call('/user_account');if(a.id!==s.account_id||a.username?.toLowerCase()!==s.username||a.account_type!=='BUSINESS')fail();const b=await this.call('/boards/'+s.board_id);if(b.id!==s.board_id||b.owner?.username?.toLowerCase()!==s.username||b.privacy!=='PUBLIC')fail();}
 create(s,image){return this.call('/pins',{board_id:s.board_id,title:s.title,description:s.description,link:s.link,media_source:{source_type:'image_base64',content_type:'image/png',data:image.toString('base64')}});}
 verify(id){if(!numeric(id))fail();return this.call('/pins/'+id);}
}
export async function runTrialPin({spec,image,store,graph,approved=false}){
 validateTrialPin(spec,image);if(approved!==true)throw new TrialPinError('Separate approval for this exact creator-only Trial Pin is required.');
 await graph.preflight(spec);
 if(!await store.reserve(spec))throw new TrialPinError('This Trial Pin already has a record. No second creation will be attempted.');
 let stage='creating';
 try{await store.mark(spec.test_id,stage);const pin=await graph.create(spec,image);if(!numeric(pin.id))fail();stage='verifying';await store.mark(spec.test_id,stage,pin.id);const v=await graph.verify(pin.id);if(v.id!==pin.id||v.board_id!==spec.board_id||v.title!==spec.title||v.description!==spec.description||v.link!==spec.link||v.is_owner!==true)fail();await store.mark(spec.test_id,'verified_trial',pin.id);return {test_id:spec.test_id,status:'verified_trial',pin_id:pin.id,pin_url:'https://www.pinterest.com/pin/'+pin.id+'/',trial_creator_only:true,publishing_enabled:false};}
 catch{try{await store.mark(spec.test_id,'needs_review_'+stage);}catch{}throw new TrialPinError('Stopped at '+stage+'. A Trial Pin may exist. Do not retry; inspect its saved record.');}
}
