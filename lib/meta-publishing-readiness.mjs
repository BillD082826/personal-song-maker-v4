// Read-only account preflight. This does not activate a connection or publish content.
import {reviewMetaAnalyticsAccess} from './analytics-access-review.mjs';
import {FacebookTestGraph} from './facebook-test-post.mjs';
const PAGE='1271936012676830',IG='17841431950776323';
export async function reviewPublishingReadiness({token,config,storedExpiry=null,fetchImpl=fetch,clock=()=>new Date()}){
 const now=clock();if(!Number.isFinite(+now)||storedExpiry!==null&&(!Number.isFinite(+new Date(storedExpiry))||+new Date(storedExpiry)<=+now))throw Error('Stored authorization has expired or needs review. No posts changed.');
 const grants=await reviewMetaAnalyticsAccess({token,config,fetchImpl});
 const granted=p=>grants.permissions[p]==='granted';
 const instagram={account_id:IG,username:'lyribop',identity_verified:true,publishing_permission_granted:granted('instagram_basic')&&granted('instagram_content_publish'),automatic_connection_active:false};
 const facebook={page_id:PAGE,identity_verified:false,publishing_permission_granted:['pages_show_list','pages_read_engagement','pages_manage_posts'].every(granted),status:'permission_review_required',automatic_connection_active:false};
 if(facebook.publishing_permission_granted){
  try{await new FacebookTestGraph(token,fetchImpl).page({page_id:PAGE,instagram_id:IG});facebook.identity_verified=true;facebook.status='read_only_identity_verified';}
  catch{facebook.status='page_access_review_required';}
 }
 return {mode:'meta_publishing_readiness',checked_at:now.toISOString(),facebook,instagram,stored_token_expires_at:storedExpiry===null?null:new Date(storedExpiry).toISOString(),expiry_status:storedExpiry===null?'no_expiry_recorded':'future_expiry_recorded',expiry_verified_with_provider:false,publishing_enabled:false,posts_changed:0,connections_activated:0,remaining:['Explicit approved destination activation','Provider credential validity and revocation checks before each send','Durable per-plan delivery records and duplicate prevention','Automatic worker and controlled scheduled pilot']};
}
