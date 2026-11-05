// Inert registry. No server route, timer or publisher uses this module yet.
import {randomUUID} from 'node:crypto';
import {metaConfiguration,openToken} from './meta-connection.mjs';
import {reviewPublishingReadiness} from './meta-publishing-readiness.mjs';
export const META_DESTINATIONS=Object.freeze({facebook:'1271936012676830',instagram:'17841431950776323'});
export const CONNECTION_SCHEMA=`
CREATE TABLE IF NOT EXISTS ad_scheduler_publishing_connections (
 platform TEXT PRIMARY KEY CHECK(platform IN ('facebook','instagram')),
 account_id TEXT NOT NULL,authorization_id UUID NOT NULL REFERENCES ad_scheduler_meta_authorizations(id),
 status TEXT NOT NULL CHECK(status IN ('active','inactive')),
 activated_at TIMESTAMPTZ NOT NULL,checked_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS ad_scheduler_connection_events (
 id UUID PRIMARY KEY,platform TEXT NOT NULL,account_id TEXT NOT NULL,
 authorization_id UUID NOT NULL REFERENCES ad_scheduler_meta_authorizations(id),
 action TEXT NOT NULL CHECK(action IN ('activated','deactivated')),created_at TIMESTAMPTZ NOT NULL
);`;
const safeFail=()=>{throw Error('Publishing connection needs review. No publication attempted.');};
function configuration(env){
 if(env.AD_SCHEDULER_ENABLED!=='true'||env.AD_SCHEDULER_META_CONNECTIONS_ENABLED!=='true'||!env.DATABASE_URL)safeFail();
 const origin=(env.PUBLIC_BASE_URL||'https://personal-song-maker-v5-test.onrender.com').replace(/\/+$/,'');
 const config=metaConfiguration(env,origin);
 if(config.appId!=='1689275265898013'||config.configId!=='2105143776809540'||config.expectedBusinessId!=='1050270251226174'||config.expectedInstagramId!==META_DESTINATIONS.instagram||origin!=='https://personal-song-maker-v5-test.onrender.com')safeFail();return config;
}
function checkAuthorization(row,config,now){
 if(!row||row.app_id!==config.appId||row.config_id!==config.configId||row.business_id!==config.expectedBusinessId||row.status!=='pending_review'||!Array.isArray(row.accounts)||row.accounts.length!==1||row.accounts[0].id!==META_DESTINATIONS.instagram||row.accounts[0].username!=='lyribop'||!Number.isFinite(+now))safeFail();
 if(row.token_expires_at!==null&&(!Number.isFinite(+new Date(row.token_expires_at))||+new Date(row.token_expires_at)<=+now))safeFail();
}
function requireReadiness(result,platform){
 if(result?.mode!=='meta_publishing_readiness'||result.publishing_enabled!==false||result.posts_changed!==0||result.connections_activated!==0)safeFail();
 const r=result[platform];if(!r?.identity_verified||r.publishing_permission_granted!==true||(platform==='facebook'?r.page_id:r.account_id)!==META_DESTINATIONS[platform])safeFail();
}
const columns='id,app_id,config_id,business_id,accounts,protected_token,token_expires_at,status';
export class MetaPublishingConnections{
 constructor(pool,{env=process.env,clock=()=>new Date(),review=reviewPublishingReadiness}={}){this.pool=pool;this.env=env;this.clock=clock;this.review=review;}
 async install(){configuration(this.env);await this.pool.query(CONNECTION_SCHEMA);}
 async candidate(){
  const config=configuration(this.env),row=(await this.pool.query(`SELECT ${columns} FROM ad_scheduler_meta_authorizations WHERE app_id=$1 AND config_id=$2 AND status='pending_review' AND (token_expires_at IS NULL OR token_expires_at>now()) ORDER BY created_at DESC LIMIT 1`,[config.appId,config.configId])).rows[0];
  checkAuthorization(row,config,this.clock());return {row,config};
 }
 token(row,config){return openToken(row.protected_token,config.key,`lyribop-meta-v1:${row.id}:${row.app_id}:${row.config_id}`);}
 async activate({approved=false}={}){
  if(approved!==true)safeFail();const {row,config}=await this.candidate();
  const readiness=await this.review({token:this.token(row,config),config,storedExpiry:row.token_expires_at,clock:this.clock});
  for(const platform of Object.keys(META_DESTINATIONS))requireReadiness(readiness,platform);
  const db=await this.pool.connect();
  try{
   await db.query('BEGIN');await db.query("SELECT pg_advisory_xact_lock(hashtext('lyribop-publishing-connections-v1'))");
   const current=(await db.query(`SELECT ${columns} FROM ad_scheduler_meta_authorizations WHERE id=$1 FOR SHARE`,[row.id])).rows[0];checkAuthorization(current,config,this.clock());
   if(JSON.stringify(current.protected_token)!==JSON.stringify(row.protected_token))safeFail();
   const prior=(await db.query('SELECT platform,account_id,authorization_id,status FROM ad_scheduler_publishing_connections FOR UPDATE')).rows;
   // Never silently replace an existing binding or reactivate a disabled connection.
   if(prior.some(r=>r.authorization_id!==row.id||r.status!=='active'||r.account_id!==META_DESTINATIONS[r.platform]))safeFail();
   const now=this.clock().toISOString();let changed=0;
   for(const [platform,id] of Object.entries(META_DESTINATIONS)){
    const r=await db.query("INSERT INTO ad_scheduler_publishing_connections(platform,account_id,authorization_id,status,activated_at,checked_at) VALUES($1,$2,$3,'active',$4,$4) ON CONFLICT(platform) DO NOTHING RETURNING platform",[platform,id,row.id,now]);
    if(r.rowCount){changed++;await db.query("INSERT INTO ad_scheduler_connection_events VALUES($1,$2,$3,$4,'activated',$5)",[randomUUID(),platform,id,row.id,now]);}
   }
   await db.query('COMMIT');return {mode:'meta_destinations_registered',connections_added:changed,destinations:META_DESTINATIONS,authorization_id:row.id,publishing_enabled:false,posts_changed:0,worker_enabled:false};
  }catch{await db.query('ROLLBACK');safeFail();}finally{db.release();}
 }
 async withCheckedConnection(platform,fn){
  if(!Object.hasOwn(META_DESTINATIONS,platform)||typeof fn!=='function')safeFail();const config=configuration(this.env);
  const connection=(await this.pool.query('SELECT platform,account_id,authorization_id,status FROM ad_scheduler_publishing_connections WHERE platform=$1',[platform])).rows[0];
  if(!connection||connection.status!=='active'||connection.account_id!==META_DESTINATIONS[platform])safeFail();
  const row=(await this.pool.query(`SELECT ${columns} FROM ad_scheduler_meta_authorizations WHERE id=$1`,[connection.authorization_id])).rows[0];checkAuthorization(row,config,this.clock());
  const token=this.token(row,config),r=await this.review({token,config,storedExpiry:row.token_expires_at,clock:this.clock});requireReadiness(r,platform);
  // Recheck local deactivation after network preflight. Credentials stay inside this callback.
  const active=(await this.pool.query("SELECT c.platform FROM ad_scheduler_publishing_connections c JOIN ad_scheduler_meta_authorizations a ON a.id=c.authorization_id WHERE c.platform=$1 AND c.account_id=$2 AND c.authorization_id=$3 AND c.status='active' AND a.status='pending_review' AND (a.token_expires_at IS NULL OR a.token_expires_at>now())",[platform,connection.account_id,row.id])).rows;
  if(active.length!==1)safeFail();return fn({token,config,accountId:connection.account_id});
 }
 async deactivate({approved=false}={}){
  if(approved!==true)safeFail();configuration(this.env);const db=await this.pool.connect();
  try{await db.query('BEGIN');await db.query("SELECT pg_advisory_xact_lock(hashtext('lyribop-publishing-connections-v1'))");
   const rows=(await db.query("UPDATE ad_scheduler_publishing_connections SET status='inactive' WHERE status='active' RETURNING platform,account_id,authorization_id")).rows;
   for(const r of rows)await db.query("INSERT INTO ad_scheduler_connection_events VALUES($1,$2,$3,$4,'deactivated',$5)",[randomUUID(),r.platform,r.account_id,r.authorization_id,this.clock().toISOString()]);
   await db.query('COMMIT');return {connections_deactivated:rows.length,publishing_enabled:false,posts_changed:0};
  }catch{await db.query('ROLLBACK');safeFail();}finally{db.release();}
 }
}
