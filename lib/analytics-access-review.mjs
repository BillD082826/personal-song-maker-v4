// Read-only Meta grant inventory. Grant presence is not proof an insights endpoint works.
import {MetaGraph} from './meta-connection.mjs';
export const REVIEW_PERMISSIONS=Object.freeze(['pages_show_list','pages_read_engagement','pages_manage_posts','read_insights','instagram_basic','instagram_content_publish','instagram_manage_insights','instagram_business_basic','instagram_business_manage_insights']);
const fail=()=>{throw Error('Analytics access review could not complete. No permissions or posts were changed.');};
export function summarizeAnalyticsGrants(data){
 if(!Array.isArray(data?.data)||data.data.length>100||data.paging?.next)fail();const seen=new Set(),map=new Map();
 for(const p of data.data){if(typeof p.permission!=='string'||!p.permission||seen.has(p.permission)||!['granted','declined','expired'].includes(p.status))fail();seen.add(p.permission);if(REVIEW_PERMISSIONS.includes(p.permission))map.set(p.permission,p.status);}
 return Object.fromEntries(REVIEW_PERMISSIONS.map(p=>[p,map.get(p)||'not_returned']));
}
export async function reviewMetaAnalyticsAccess({token,config,fetchImpl=fetch}){
 if(config?.appId!=='1689275265898013'||config.expectedBusinessId!=='1050270251226174'||config.expectedInstagramId!=='17841431950776323'||config.origin!=='https://personal-song-maker-v5-test.onrender.com'||typeof token!=='string'||!token)fail();
 try{const graph=new MetaGraph(fetchImpl),identity=await graph.identity(token,config);
 if(identity.businessId!=='1050270251226174'||identity.accounts.length!==1||identity.accounts[0].id!=='17841431950776323'||identity.accounts[0].username!=='lyribop')fail();
 const grants=await graph.json('https://graph.facebook.com/v26.0/me/permissions?limit=100',{headers:{Authorization:'Bearer '+token}});
 return{mode:'analytics_access_review',account:'lyribop',permissions:summarizeAnalyticsGrants(grants),insights_endpoint_verified:false,publishing_enabled:false,permissions_changed:0,posts_changed:0};
 }catch{fail();}
}
