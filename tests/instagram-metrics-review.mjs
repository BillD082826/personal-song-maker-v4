import test from 'node:test';import assert from 'node:assert/strict';
import {METRICS,POST,parseMetric,reviewInstagramMetrics} from '../lib/instagram-metrics-review.mjs';
const config={appId:'1689275265898013',expectedBusinessId:'1050270251226174',expectedInstagramId:POST.account,origin:'https://personal-song-maker-v5-test.onrender.com'};
const metric=(name,value=0)=>({data:[{name,period:'lifetime',id:`${POST.id}/insights/${name}/lifetime`,values:[{value}],private:'SECRET'}]});
function fixture(calls,patch={}){return async(url,o)=>{
 calls.push({url,o});let body;
 if(url.includes('/me?'))body={id:'123',client_business_id:config.expectedBusinessId};
 else if(url.includes('assigned_instagram'))body={data:[]};
 else if(url.includes('/me/permissions'))body={data:['instagram_basic','instagram_manage_insights'].map(permission=>({permission,status:'granted'}))};
 else if(url.includes(POST.id+'?fields='))body={id:POST.id,owner:{id:POST.account},media_type:'IMAGE',media_product_type:'FEED',permalink:POST.permalink,timestamp:'2026-11-02T20:15:33Z',...patch};
 else if(url.includes('/insights?'))body=metric(new URL(url).searchParams.get('metric'));
 else body={id:POST.account,username:'lyribop'};
 return {ok:true,json:async()=>body};
};}
test('metric parser preserves true zero and missing data separately; rejects malformed or wrong period/identity',()=>{
 assert.equal(parseMetric(metric('reach'),'reach').value,0);assert.equal(parseMetric({data:[]},'reach').value,null);
 for(const body of [metric('likes'),{data:metric('reach').data,paging:{next:'SECRET'}},{data:[{...metric('reach').data[0],period:'day'}]},metric('reach',-1),metric('reach','4'),metric('reach',1.5),{data:[{...metric('reach').data[0],id:'other'}]}])assert.throws(()=>parseMetric(body,'reach'));
});
test('probe verifies exact account/post then performs six fixed-host GETs with safe lifetime/test projection',async()=>{
 const calls=[];const r=await reviewInstagramMetrics({token:'SECRET',config,fetchImpl:fixture(calls)});
 assert.equal(calls.length,11);assert.equal(Object.keys(r.metrics).length,6);assert.equal(r.metric_scope,'organic_lifetime');assert.equal(r.weekly_activity_verified,false);assert.equal(r.is_test_post,true);assert.equal(r.posts_changed,0);assert(!JSON.stringify(r).includes('SECRET'));
 for(const {url,o} of calls){assert(url.startsWith('https://graph.facebook.com/v26.0/'));assert(!url.includes('SECRET'));assert(!o.method||o.method==='GET');assert.equal(o.redirect,'error');assert.equal(o.headers.Authorization,'Bearer SECRET');}
});
test('wrong post ownership/type/link fails before metrics and wrong config before any request',async()=>{
 for(const patch of [{owner:{id:'other'}},{media_type:'VIDEO'},{permalink:'https://evil.test/'},{id:'other'}]){const calls=[];await assert.rejects(reviewInstagramMetrics({token:'SECRET',config,fetchImpl:fixture(calls,patch)}));assert(!calls.some(x=>x.url.includes('/insights?')));}
 const calls=[];await assert.rejects(reviewInstagramMetrics({token:'SECRET',config:{...config,appId:'wrong'},fetchImpl:fixture(calls)}));assert.equal(calls.length,0);
});
test('one failed or empty metric preserves other values without retry or provider error disclosure',async()=>{
 const calls=[],base=fixture(calls);const r=await reviewInstagramMetrics({token:'SECRET',config,fetchImpl:async(url,o)=>{
 if(url.includes('metric=views')){calls.push({url,o});return {ok:false,json:async()=>({error:'SECRET'})};}
 if(url.includes('metric=reach')){calls.push({url,o});return {ok:true,json:async()=>({data:[]})};}
 return base(url,o);
 }});
 assert.equal(r.metrics.views.status,'collection_failed');assert.equal(r.metrics.reach.status,'not_available');assert.equal(r.metrics.likes.value,0);assert.equal(calls.filter(x=>x.url.includes('metric=views')).length,1);assert(!JSON.stringify(r).includes('SECRET'));
});
test('missing insights grant never queries post or metrics',async()=>{
 const calls=[],base=fixture(calls);await assert.rejects(reviewInstagramMetrics({token:'SECRET',config,fetchImpl:async(url,o)=>url.includes('/me/permissions')?{ok:true,json:async()=>({data:[]})}:base(url,o)}));assert(!calls.some(x=>x.url.includes(POST.id)));
});
