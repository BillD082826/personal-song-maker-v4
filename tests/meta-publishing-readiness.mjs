import test from 'node:test';import assert from 'node:assert/strict';import {reviewPublishingReadiness} from '../lib/meta-publishing-readiness.mjs';
const config={appId:'1689275265898013',expectedBusinessId:'1050270251226174',expectedInstagramId:'17841431950776323',origin:'https://personal-song-maker-v5-test.onrender.com'};
function fixture(calls,{wrongPage=false,missing=false}={}){return async(url,o)=>{calls.push({url,o});let d;
 if(url.includes('/me?'))d=o.headers.Authorization==='Bearer PAGE_SECRET'?{id:'1271936012676830'}:{id:'123',client_business_id:config.expectedBusinessId};
 else if(url.includes('assigned_instagram'))d={data:[]};
 else if(url.includes('/me/permissions'))d={data:(missing?[]:['instagram_basic','instagram_content_publish','pages_show_list','pages_read_engagement','pages_manage_posts']).map(permission=>({permission,status:'granted'}))};
 else if(url.includes('1271936012676830?'))d={id:wrongPage?'other':'1271936012676830',access_token:'PAGE_SECRET',instagram_business_account:{id:config.expectedInstagramId}};
 else d={id:config.expectedInstagramId,username:'lyribop'};
 return {ok:true,json:async()=>d};};}
test('readiness checks exact Page token identity with only GETs and never claims activation or provider expiry',async()=>{
 const calls=[];const r=await reviewPublishingReadiness({token:'SECRET',config,fetchImpl:fixture(calls)});assert.equal(r.facebook.identity_verified,true);assert.equal(r.instagram.publishing_permission_granted,true);assert.equal(r.publishing_enabled,false);assert.equal(r.connections_activated,0);assert.equal(r.expiry_verified_with_provider,false);assert.equal(r.expiry_status,'no_expiry_recorded');assert(!JSON.stringify(r).includes('SECRET'));
 assert.equal(calls.length,6);for(const {url,o} of calls){assert(!o.method||o.method==='GET');assert.equal(o.redirect,'error');assert(url.startsWith('https://graph.facebook.com/v26.0/'));assert(!url.includes('SECRET'));}
});
test('expired or malformed stored expiry refuses all provider requests',async()=>{for(const storedExpiry of ['invalid','2020-01-01']){const calls=[];await assert.rejects(reviewPublishingReadiness({token:'SECRET',config,storedExpiry,fetchImpl:fixture(calls)}));assert.equal(calls.length,0);}});
test('wrong Page never claims verified and never leaks credentials',async()=>{const calls=[];const r=await reviewPublishingReadiness({token:'SECRET',config,fetchImpl:fixture(calls,{wrongPage:true})});assert.equal(r.facebook.identity_verified,false);assert.equal(r.facebook.status,'page_access_review_required');assert(!JSON.stringify(r).includes('SECRET'));});
test('missing permissions block Page token reads and Instagram readiness',async()=>{const calls=[];const r=await reviewPublishingReadiness({token:'SECRET',config,fetchImpl:fixture(calls,{missing:true})});assert.equal(r.facebook.publishing_permission_granted,false);assert.equal(r.instagram.publishing_permission_granted,false);assert(!calls.some(x=>x.url.includes('1271936012676830')));});
