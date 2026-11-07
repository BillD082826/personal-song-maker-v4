// On-demand, read-only audience figures for a bounded page of verified scheduled receipts.
import {METRICS,parseMetric} from './instagram-metrics-review.mjs';
import {projectInstagramDelivery} from './instagram-scheduled-report.mjs';
import {reviewMetaAnalyticsAccess} from './analytics-access-review.mjs';
import {MetaPublishingConnections} from './meta-publishing-connections.mjs';
import {weeklySchedulerReport} from './scheduler-weekly-report.mjs';
const account='17841431950776323';
const blank=status=>Object.fromEntries(METRICS.map(n=>[n,{status,value:null,period:'lifetime'}]));
async function get(path,token,fetchImpl){
 try{const r=await fetchImpl('https://graph.facebook.com/v26.0/'+path,{method:'GET',headers:{Authorization:'Bearer '+token},redirect:'error',signal:AbortSignal.timeout(15000)});if(!r.ok)return null;const body=await r.json();return body?.error?null:body;}catch{return null;}
}
export async function scheduledInstagramMetrics(row,{token,fetchImpl=fetch}){
 const receipt=projectInstagramDelivery(row);
 if(receipt?.state!=='verified')throw Error('Verified Instagram receipt required.');
 const id=row.remote_id,base={plan_id:row.plan_id,name:row.snapshot.name,media_id:id,permalink:receipt.permalink,scheduled_at:new Date(row.scheduled_at).toISOString()};
 const media=await get(id+'?fields=id,owner,caption,media_type,media_product_type,permalink,timestamp',token,fetchImpl);
 if(!media||media.id!==id||media.owner?.id!==account||media.caption!==row.snapshot.caption||media.media_type!=='IMAGE'||media.media_product_type!=='FEED'||media.permalink!==receipt.permalink||!Number.isFinite(Date.parse(media.timestamp)))return {...base,status:'identity_unavailable',published_at:null,metrics:blank('collection_failed')};
 const metrics={};for(const name of METRICS){const body=await get(id+'/insights?metric='+name,token,fetchImpl);if(!body){metrics[name]={status:'collection_failed',value:null,period:'lifetime'};continue;}try{metrics[name]=parseMetric(body,name,id);}catch{metrics[name]={status:'invalid_response',value:null,period:'lifetime'};}}
 return {...base,status:'collected',published_at:new Date(media.timestamp).toISOString(),metrics};
}
export async function readScheduledInstagramPerformance({pool,env=process.env,start,offset=0,clock=()=>new Date(),fetchImpl=fetch,connection=new MetaPublishingConnections(pool,{env}),access=reviewMetaAnalyticsAccess}){
 if(env.AD_SCHEDULER_META_CONNECTIONS_ENABLED!=='true'||!pool)throw Error('Reporting unavailable.');
 const end=weeklySchedulerReport({plans:[]},start,clock()).end;
 if(!Number.isInteger(offset)||offset<0||offset>18||offset%3!==0)throw Error('Choose a valid report page.');
 const rows=(await pool.query(`SELECT d.*,p.snapshot,p.scheduled_at AS plan_time FROM ad_scheduler_deliveries d JOIN ad_scheduler_plans p ON p.id=d.plan_id WHERE d.platform='instagram' AND d.state='verified' AND p.local_day BETWEEN $1 AND $2 ORDER BY d.scheduled_at,d.plan_id LIMIT 22`,[start,end])).rows;
 if(rows.length>21||rows.some(r=>projectInstagramDelivery(r)?.state!=='verified'))throw Error('Receipt review required.');
 const base={mode:'instagram_scheduled_performance',account:'lyribop',start,end,metric_scope:'organic_lifetime',weekly_activity_verified:false,collected_at:clock().toISOString(),total_verified:rows.length,offset,next_offset:offset+3<rows.length?offset+3:null,posts_changed:0};
 if(!rows.length)return {...base,items:[]};
 return connection.withCheckedConnection('instagram',async({token,config,accountId})=>{
  if(accountId!==account)throw Error('Account review required.');const grants=await access({token,config,fetchImpl});if(grants.permissions.instagram_manage_insights!=='granted'||grants.permissions.instagram_basic!=='granted')throw Error('Insights permission unavailable.');
  const items=[];for(const row of rows.slice(offset,offset+3))items.push(await scheduledInstagramMetrics(row,{token,fetchImpl}));return {...base,collected_at:clock().toISOString(),items};
 });
}
export function scheduledPerformanceReader(options,{clock=()=>Date.now(),read=readScheduledInstagramPerformance}={}){
 const cache=new Map();let pending=null;
 return async(start,offset=0)=>{weeklySchedulerReport({plans:[]},start);if(!Number.isInteger(offset)||offset<0||offset>18||offset%3!==0)throw Error('Choose a valid report page.');const key=start+':'+offset,hit=cache.get(key);if(hit&&clock()-hit.at<60000)return hit.value;if(pending){if(pending.key===key)return pending.promise;throw Error('A report read is already running.');}
 const promise=read({...options,start,offset}).then(value=>{cache.set(key,{at:clock(),value});while(cache.size>7)cache.delete(cache.keys().next().value);return value;}).finally(()=>{pending=null;});pending={key,promise};return promise;};
}
