// Meta connection preparation only. No publishing client or sender lives here.
import express from 'express';
import { randomBytes, randomUUID, createHash, createCipheriv, createDecipheriv } from 'node:crypto';
const COOKIE='__Secure-lyribop-meta-state';
const CALLBACK='/api/admin/ad-scheduler/meta/callback';
const API='https://graph.facebook.com/v26.0';
const hash=value=>createHash('sha256').update(value).digest('hex');
const nonce=()=>randomBytes(32).toString('base64url');
export class MetaConnectionError extends Error {}
const OUTCOMES={
 pending_review:'Login received. Account review is pending; publishing remains off.',
 account_empty:'Meta returned no assigned Instagram accounts. Business integration assignment needs review.',
 account_details:'Meta returned incomplete Instagram account details.',
 account_list:'Meta returned an unexpected Instagram account list.',
 account_pages:'Meta returned an incomplete account list. Pagination needs review.',
 identity:'Meta returned an unexpected login identity.',
 declined:'Meta login was canceled or declined.',
 failed:'Login could not complete. Publishing remains off.'
};
function outcomeFor(error){
 const message=error instanceof MetaConnectionError?error.message:'';
 if(message.includes('no assigned Instagram'))return 'account_empty';
 if(message.includes('incomplete Instagram account details'))return 'account_details';
 if(message.includes('unexpected Instagram account list'))return 'account_list';
 if(message.includes('pagination review'))return 'account_pages';
 if(message.includes('unexpected login identity'))return 'identity';
 return 'failed';
}
export function tokenKey(value){
  // Clipboard-generated keys commonly include a final newline.
  if(typeof value==='string')value=value.trim();
  if(typeof value!=='string'||! /^[A-Za-z0-9+/]{43}=$/.test(value))throw new MetaConnectionError('Server token protection is not configured.');
  const key=Buffer.from(value,'base64');if(key.length!==32)throw new MetaConnectionError('Server token protection is not configured.');return key;
}
export function sealToken(token,key,context){
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from(context));
  const content=Buffer.concat([cipher.update(token,'utf8'),cipher.final()]);
  return {version:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),content:content.toString('base64')};
}
export function openToken(box,key,context){
  if(box.version!==1)throw new Error('Unsupported protected token format.');
  const cipher=createDecipheriv('aes-256-gcm',key,Buffer.from(box.iv,'base64'));cipher.setAAD(Buffer.from(context));cipher.setAuthTag(Buffer.from(box.tag,'base64'));
  return Buffer.concat([cipher.update(Buffer.from(box.content,'base64')),cipher.final()]).toString('utf8');
}
export function metaConfiguration(env,publicBase){
  let base;try{base=new URL(publicBase);}catch{}
  if(!base||base.protocol!=='https:'||base.username||base.password)throw new MetaConnectionError('Use the configured secure LyriBop address.');
  if(!/^\d+$/.test(env.META_APP_ID||'')||!/^\d+$/.test(env.META_LOGIN_CONFIG_ID||'')||!env.META_APP_SECRET)throw new MetaConnectionError('Meta login settings are not configured.');
  const expectedBusinessId=env.META_EXPECTED_BUSINESS_ID||'',expectedInstagramId=env.META_EXPECTED_INSTAGRAM_ID||'';
  if((expectedBusinessId||expectedInstagramId)&&(!/^\d+$/.test(expectedBusinessId)||!/^\d+$/.test(expectedInstagramId)))throw new MetaConnectionError('Expected account verification settings need review.');
  return {appId:env.META_APP_ID,appSecret:env.META_APP_SECRET,configId:env.META_LOGIN_CONFIG_ID,expectedBusinessId,expectedInstagramId,key:tokenKey(env.AD_SCHEDULER_TOKEN_KEY),origin:base.origin,redirectUri:base.origin+CALLBACK};
}
export function loginUrl(config,state){
  const url=new URL('https://www.facebook.com/v26.0/dialog/oauth');
  for(const [key,value] of Object.entries({client_id:config.appId,config_id:config.configId,redirect_uri:config.redirectUri,response_type:'code',state}))url.searchParams.set(key,value);
  return url.toString();
}
export const META_SCHEMA=`
CREATE TABLE IF NOT EXISTS ad_scheduler_meta_attempts (
 state_hash TEXT PRIMARY KEY,binding_hash TEXT NOT NULL,app_id TEXT NOT NULL,config_id TEXT NOT NULL,
 expires_at TIMESTAMPTZ NOT NULL,consumed_at TIMESTAMPTZ
);
ALTER TABLE ad_scheduler_meta_attempts ADD COLUMN IF NOT EXISTS outcome TEXT;
CREATE TABLE IF NOT EXISTS ad_scheduler_meta_authorizations (
 id UUID PRIMARY KEY,app_id TEXT NOT NULL,config_id TEXT NOT NULL,system_user_id TEXT NOT NULL,
 business_id TEXT,accounts JSONB NOT NULL,protected_token JSONB NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending_review' CHECK(status IN ('pending_review','superseded')),
 token_expires_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL
);
`;
export class MetaStateStore {
 constructor(pool,clock=()=>new Date()){this.pool=pool;this.clock=clock;this.initializing=null;}
 async ready(){if(!this.pool)throw new MetaConnectionError('The connection database is unavailable.');if(!this.initializing)this.initializing=this.pool.query(META_SCHEMA).catch(e=>{this.initializing=null;throw e;});await this.initializing;}
 async begin(config){
  await this.ready();const state=nonce(),binding=nonce();
  await this.pool.query('INSERT INTO ad_scheduler_meta_attempts(state_hash,binding_hash,app_id,config_id,expires_at) VALUES($1,$2,$3,$4,$5)',[hash(state),hash(binding),config.appId,config.configId,new Date(+this.clock()+10*60000).toISOString()]);
  return {state,binding};
 }
 async consume(state,binding,config){
  if(!/^[A-Za-z0-9_-]{43}$/.test(state||'')||!/^[A-Za-z0-9_-]{43}$/.test(binding||''))return false;
  await this.ready();const now=this.clock().toISOString();
  const result=await this.pool.query('UPDATE ad_scheduler_meta_attempts SET consumed_at=$1 WHERE state_hash=$2 AND binding_hash=$3 AND app_id=$4 AND config_id=$5 AND consumed_at IS NULL AND expires_at>$1 RETURNING state_hash',[now,hash(state),hash(binding),config.appId,config.configId]);return result.rowCount===1;
 }
 async recordOutcome(state,binding,config,outcome){
  if(!Object.hasOwn(OUTCOMES,outcome))throw new Error('Invalid login outcome.');
  await this.ready();
  await this.pool.query('UPDATE ad_scheduler_meta_attempts SET outcome=$1 WHERE state_hash=$2 AND binding_hash=$3 AND app_id=$4 AND config_id=$5 AND consumed_at IS NOT NULL AND outcome IS NULL',[outcome,hash(state),hash(binding),config.appId,config.configId]);
 }
 async lastAttempt(config){
  await this.ready();
  const result=await this.pool.query('SELECT expires_at,consumed_at,outcome FROM ad_scheduler_meta_attempts WHERE app_id=$1 AND config_id=$2 ORDER BY expires_at DESC LIMIT 1',[config.appId,config.configId]);
  const row=result.rows[0];if(!row)return null;
  return {expires_at:row.expires_at,consumed_at:row.consumed_at,outcome:row.outcome||null,message:OUTCOMES[row.outcome]||'Login has not completed. No connection was activated.'};
 }
 async pending(config){
  await this.ready();
  // Explicit projection: never read protected tokens into a browser-facing result.
  const result=await this.pool.query("SELECT id,accounts,token_expires_at,created_at FROM ad_scheduler_meta_authorizations WHERE app_id=$1 AND config_id=$2 AND status='pending_review' AND (token_expires_at IS NULL OR token_expires_at>$3) ORDER BY created_at DESC LIMIT 10",[config.appId,config.configId,this.clock().toISOString()]);
  return result.rows.map(row=>({id:row.id,accounts:row.accounts.map(a=>({id:a.id,username:a.username})),token_expires_at:row.token_expires_at,created_at:row.created_at,status:'pending_review'}));
 }
 async savePending(config,identity,token,expiresIn){
  await this.ready();const id=randomUUID(),context=`lyribop-meta-v1:${id}:${config.appId}:${config.configId}`;
  const box=sealToken(token,config.key,context),expires=Number.isFinite(expiresIn)&&expiresIn>0?new Date(+this.clock()+expiresIn*1000).toISOString():null;
  await this.pool.query('INSERT INTO ad_scheduler_meta_authorizations(id,app_id,config_id,system_user_id,accounts,protected_token,token_expires_at,created_at,business_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[id,config.appId,config.configId,identity.systemUserId,JSON.stringify(identity.accounts),JSON.stringify(box),expires,this.clock().toISOString(),identity.businessId||null]);
  return {id,status:'pending_review',accounts:identity.accounts};
 }
}
export class MetaGraph {
 constructor(fetchImpl=fetch){this.fetch=fetchImpl;}
 async json(url,options={}){
  let response;try{response=await this.fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error();const data=await response.json();if(data.error)throw new Error();return data;}catch{throw new MetaConnectionError('Meta could not complete this connection. Start a new connection and try again.');}
 }
 async exchange(config,code){
  const url=new URL(API+'/oauth/access_token');
  for(const [key,value] of Object.entries({client_id:config.appId,client_secret:config.appSecret,redirect_uri:config.redirectUri,code}))url.searchParams.set(key,value);
  const data=await this.json(url);
  if(typeof data.access_token!=='string'||!data.access_token)throw new MetaConnectionError('Meta did not return a usable connection token.');
  return {token:data.access_token,expiresIn:typeof data.expires_in==='number'?data.expires_in:null};
 }
 async identity(token,expected={}){
  const headers={Authorization:'Bearer '+token};
  const me=await this.json(API+'/me?fields=id,client_business_id',{headers});
  const assigned=await this.json(API+'/me/assigned_instagram_accounts?fields=id,username&limit=100',{headers});
  if(!/^\d+$/.test(me.id||''))throw new MetaConnectionError('Meta returned an unexpected login identity. No connection was activated.');
  if(!Array.isArray(assigned.data))throw new MetaConnectionError('Meta returned an unexpected Instagram account list. No connection was activated.');
  if(!assigned.data.length&&expected.expectedBusinessId&&expected.expectedInstagramId){
   // A configured ID is a restriction, never proof of access: require Meta to verify
   // the token's business identity AND return that exact account with this token.
   if(String(me.client_business_id)!==expected.expectedBusinessId)throw new MetaConnectionError('Meta returned a different business identity. No connection was activated.');
   const account=await this.json(API+'/'+expected.expectedInstagramId+'?fields=id,username',{headers});
   if(String(account.id)!==expected.expectedInstagramId||typeof account.username!=='string'||!account.username.trim())throw new MetaConnectionError('Meta could not verify the expected Instagram account. No connection was activated.');
   return {systemUserId:me.id,businessId:expected.expectedBusinessId,accounts:[{id:account.id,username:account.username}]};
  }
  if(!assigned.data.length)throw new MetaConnectionError('Meta approved login but returned no assigned Instagram accounts. Review the business integration account assignment. No connection was activated.');
  if(assigned.paging?.next)throw new MetaConnectionError('Meta returned an incomplete Instagram account list. Account discovery needs pagination review. No connection was activated.');
  const accounts=assigned.data.map(a=>{if(!/^\d+$/.test(a.id||'')||typeof a.username!=='string')throw new MetaConnectionError('Meta returned incomplete Instagram account details. No connection was activated.');return {id:a.id,username:a.username};});
  if(expected.expectedBusinessId&&String(me.client_business_id)!==expected.expectedBusinessId)throw new MetaConnectionError('Meta returned a different business identity. No connection was activated.');
  if(expected.expectedInstagramId&&(accounts.length!==1||accounts[0].id!==expected.expectedInstagramId))throw new MetaConnectionError('Meta returned a different Instagram account selection. No connection was activated.');
  return {systemUserId:me.id,...(expected.expectedBusinessId?{businessId:expected.expectedBusinessId}:{}),accounts};
 }
}
function cookieValue(req){const values=(req.get('Cookie')||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(COOKIE+'='));return values.length===1?values[0].slice(COOKIE.length+1):'';}
export function metaConnectionRouter({requireAdmin,store,graph=new MetaGraph(),env=process.env,publicBase,planningEnabled=false}){
 const router=express.Router();router.use(requireAdmin);router.use((_req,res,next)=>{res.set({'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});if(!planningEnabled||env.AD_SCHEDULER_META_CONNECTIONS_ENABLED!=='true')return res.status(503).json({error:'Meta connections are not enabled. Publishing remains off.'});next();});
 const config=()=>metaConfiguration(env,publicBase);
 const safe=fn=>async(req,res)=>{try{await fn(req,res);}catch(e){res.status(e instanceof MetaConnectionError?400:503).json({error:e instanceof MetaConnectionError?e.message:'The connection could not be saved. Publishing remains off.'});}};
 router.get('/status',safe(async(_req,res)=>{config();res.json({configured:true,publishing_enabled:false,connection_status:'not_activated',callback_path:CALLBACK});}));
 router.get('/last-attempt',safe(async(_req,res)=>{res.json({attempt:await store.lastAttempt(config()),publishing_enabled:false});}));
 router.get('/pending',safe(async(_req,res)=>{const c=config();res.json({authorizations:await store.pending(c),publishing_enabled:false});}));
 router.post('/start',safe(async(req,res)=>{
  const c=config();if(req.get('Origin')!==c.origin||req.get('X-LyriBop-Scheduler')!=='1'||!req.is('application/json'))return res.status(403).json({error:'Start the connection from your signed-in LyriBop scheduler.'});
  const attempt=await store.begin(c);res.cookie(COOKIE,attempt.binding,{httpOnly:true,secure:true,sameSite:'lax',path:'/api/admin/ad-scheduler/meta',maxAge:10*60000});
  res.json({login_url:loginUrl(c,attempt.state),publishing_enabled:false});
 }));
 router.get('/callback',safe(async(req,res)=>{
  const c=config(),state=req.query.state,binding=cookieValue(req);
  if(typeof state!=='string'||!await store.consume(state,binding,c))return res.status(400).json({error:'This login request expired or does not match this browser. Start a new connection.'});
  try{
  res.clearCookie(COOKIE,{httpOnly:true,secure:true,sameSite:'lax',path:'/api/admin/ad-scheduler/meta'});
  if(req.query.error){await store.recordOutcome(state,binding,c,'declined');return res.status(400).json({error:'Meta login was canceled or declined. Nothing was connected.'});}
  const code=req.query.code;if(typeof code!=='string'||!code||code.length>4096)throw new MetaConnectionError('Meta did not return a usable authorization code.');
  const result=await graph.exchange(c,code),identity=await graph.identity(result.token,c);
  const pending=await store.savePending(c,identity,result.token,result.expiresIn);
  await store.recordOutcome(state,binding,c,'pending_review');
  // No token, secret, authorization code or provider error is returned to the browser.
  if(req.accepts(['json','html'])==='html')return res.redirect(303,'/admin/ad-scheduler/#connections');
  res.json({status:'pending_review',authorization_id:pending.id,accounts:pending.accounts,publishing_enabled:false,message:'Meta login received safely. Account and permission review is required before activating a connection.'});
  }catch(error){try{await store.recordOutcome(state,binding,c,outcomeFor(error));}catch{}throw error;}
 }));
 return router;
}
