import {metaConfiguration,openToken} from './meta-connection.mjs';
import {POST,reviewInstagramMetrics} from './instagram-metrics-review.mjs';
export async function readInstagramPerformance({pool,env=process.env,publicBase,review=reviewInstagramMetrics}){
 if(env.AD_SCHEDULER_META_CONNECTIONS_ENABLED!=='true'||!pool)throw Error('Reporting access is unavailable.');
 const config=metaConfiguration(env,publicBase);
 const verified=(await pool.query("SELECT media_id,permalink FROM ad_scheduler_instagram_test_runs WHERE test_id=$1 AND account_id=$2 AND state='verified' LIMIT 1",['lyribop-instagram-ad29-v1',POST.account])).rows[0];
 if(verified?.media_id!==POST.id||verified?.permalink!==POST.permalink)throw Error('Verified post unavailable.');
 const row=(await pool.query("SELECT id,app_id,config_id,business_id,accounts,protected_token FROM ad_scheduler_meta_authorizations WHERE app_id=$1 AND config_id=$2 AND status='pending_review' AND (token_expires_at IS NULL OR token_expires_at>now()) ORDER BY created_at DESC LIMIT 1",[config.appId,config.configId])).rows[0];
 if(!row||row.business_id!=='1050270251226174'||!Array.isArray(row.accounts)||row.accounts.length!==1||row.accounts[0].id!==POST.account||row.accounts[0].username!==POST.username)throw Error('Reporting authorization unavailable.');
 const token=openToken(row.protected_token,config.key,`lyribop-meta-v1:${row.id}:${row.app_id}:${row.config_id}`);
 return review({token,config});
}
// One shared read per minute, coalescing simultaneous clicks. No timers or background work.
export function performanceReader(options,{clock=()=>Date.now(),read=readInstagramPerformance}={}){
 let pending=null,last=null,at=0;
 return async()=>{if(last&&clock()-at<60000)return last;if(pending)return pending;
 pending=read(options).then(result=>{last=result;at=clock();return result;}).finally(()=>{pending=null;});return pending;};
}
