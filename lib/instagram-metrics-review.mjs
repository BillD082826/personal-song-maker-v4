// Bounded read-only probe of one previously verified production test post.
import {reviewMetaAnalyticsAccess} from './analytics-access-review.mjs';
export const METRICS=Object.freeze(['views','reach','likes','comments','saved','shares']);
export const POST=Object.freeze({id:'18057389519584911',account:'17841431950776323',username:'lyribop',permalink:'https://www.instagram.com/p/DfQJHDtARad/'});
const fail=()=>{throw Error('Instagram metrics review could not verify the expected account and post. No posts changed.');};
export function parseMetric(body,name){
 if(!METRICS.includes(name)||!Array.isArray(body?.data)||body.data.length>1||body.paging?.next)throw Error('Invalid metrics response.');
 if(!body.data.length)return {status:'not_available',value:null,period:'lifetime'};
 const item=body.data[0];
 if(item.name!==name||item.period!=='lifetime'||item.id!==`${POST.id}/insights/${name}/lifetime`)throw Error('Invalid metrics response.');
 const values=item.values;
 if(!Array.isArray(values)||values.length!==1||!Number.isSafeInteger(values[0]?.value)||values[0].value<0)throw Error('Invalid metrics response.');
 return {status:'available',value:values[0].value,period:'lifetime'};
}
async function getJson(path,token,fetchImpl){
 try{
  const response=await fetchImpl('https://graph.facebook.com/v26.0/'+path,{method:'GET',headers:{Authorization:'Bearer '+token},redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!response.ok)return {ok:false,status:'collection_failed'};
  const body=await response.json();if(body?.error)return {ok:false,status:'collection_failed'};
  return {ok:true,body};
 }catch{return {ok:false,status:'collection_failed'};}
}
export async function reviewInstagramMetrics({token,config,fetchImpl=fetch,clock=()=>new Date()}){
 const grants=await reviewMetaAnalyticsAccess({token,config,fetchImpl});
 if(grants.permissions.instagram_manage_insights!=='granted'||grants.permissions.instagram_basic!=='granted')fail();
 const media=await getJson(POST.id+'?fields=id,owner,media_type,media_product_type,permalink,timestamp',token,fetchImpl);
 const b=media.body;
 if(!media.ok||b.id!==POST.id||b.owner?.id!==POST.account||b.media_type!=='IMAGE'||b.media_product_type!=='FEED'||b.permalink!==POST.permalink||typeof b.timestamp!=='string'||!Number.isFinite(Date.parse(b.timestamp)))fail();
 const metrics={};
 for(const name of METRICS){
  const result=await getJson(POST.id+'/insights?metric='+name,token,fetchImpl);
  if(!result.ok){metrics[name]={status:result.status,value:null,period:'lifetime'};continue;}
  try{metrics[name]=parseMetric(result.body,name);}catch{metrics[name]={status:'invalid_response',value:null,period:'lifetime'};}
 }
 return {mode:'instagram_metrics_review',account:POST.username,media_id:POST.id,permalink:POST.permalink,published_at:new Date(b.timestamp).toISOString(),collected_at:clock().toISOString(),is_test_post:true,metric_scope:'organic_lifetime',weekly_activity_verified:false,data_may_be_delayed_hours:48,metrics,publishing_enabled:false,posts_changed:0};
}
