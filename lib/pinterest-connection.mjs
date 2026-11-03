// Connection preparation only: no Pin creation, scheduler activation or refresh worker.
import express from 'express';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {tokenKey,sealToken,openToken} from './meta-connection.mjs';
const ROOT='/api/admin/ad-scheduler/pinterest',COOKIE='__Secure-lyribop-pinterest-state';
const hash=s=>createHash('sha256').update(s).digest('hex'),nonce=()=>randomBytes(32).toString('base64url');
export class PinterestConnectionError extends Error {}
export const PIN_REVIEW_SCOPES=['user_accounts:read','boards:read','boards:write','pins:read','pins:write'];
const fail=()=>{throw new PinterestConnectionError('Pinterest connection could not complete. No publishing was activated.');};
export function pinterestConfiguration(env,base){
 let u;try{u=new URL(base);}catch{fail();}
 if(u.protocol!=='https:'||u.username||u.password||env.PINTEREST_APP_ID!=='1628874'||!env.PINTEREST_APP_SECRET)fail();
 return {appId:env.PINTEREST_APP_ID,secret:env.PINTEREST_APP_SECRET,key:tokenKey(env.AD_SCHEDULER_TOKEN_KEY),origin:u.origin,redirectUri:u.origin+ROOT+'/callback',scope:env.AD_SCHEDULER_PINTEREST_PIN_REVIEW_ENABLED==='true'?PIN_REVIEW_SCOPES.join(','):'user_accounts:read',expectedUsername:'lyribop'};
}
export function pinterestLoginUrl(c,state){const u=new URL('https://www.pinterest.com/oauth/');for(const [k,v] of Object.entries({client_id:c.appId,redirect_uri:c.redirectUri,response_type:'code',scope:c.scope,state}))u.searchParams.set(k,v);return u.href;}
export class PinterestGraph {
 constructor(fetchImpl=fetch){this.fetch=fetchImpl;}
 async json(path,options){try{const r=await this.fetch('https://api.pinterest.com/v5'+path,{...options,redirect:'error',signal:AbortSignal.timeout(15000)});if(!r.ok)fail();return await r.json();}catch{fail();}}
 async exchange(c,code){
  const d=await this.json('/oauth/token',{method:'POST',headers:{Authorization:'Basic '+Buffer.from(c.appId+':'+c.secret).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:c.redirectUri})});
  const scopes=typeof d.scope==='string'?d.scope.split(/[ ,]+/):[];
  if(typeof d.access_token!=='string'||!d.access_token||typeof d.refresh_token!=='string'||!d.refresh_token||d.token_type?.toLowerCase()!=='bearer'||!c.scope.split(',').every(s=>scopes.includes(s))||!Number.isFinite(d.expires_in)||d.expires_in<=0||!Number.isFinite(d.refresh_token_expires_in)||d.refresh_token_expires_in<=0)fail();
  return {accessToken:d.access_token,refreshToken:d.refresh_token,expiresIn:d.expires_in,refreshExpiresIn:d.refresh_token_expires_in,scopes};
 }
 async identity(token,c){
  const d=await this.json('/user_account',{headers:{Authorization:'Bearer '+token}});
  if(typeof d.id!=='string'||!/^\d+$/.test(d.id)||typeof d.username!=='string'||d.username.toLowerCase()!==c.expectedUsername||d.account_type!=='BUSINESS')fail();
  return {id:d.id,username:d.username,account_type:d.account_type};
 }
 async boards(token,c){
  const result=[],seen=new Set();let bookmark='';
  for(let page=0;page<10;page++){
   const url=new URL('https://api.pinterest.com/v5/boards');url.searchParams.set('privacy','PUBLIC');url.searchParams.set('page_size','100');if(bookmark)url.searchParams.set('bookmark',bookmark);
   const d=await this.json(url.pathname.slice(3)+url.search,{headers:{Authorization:'Bearer '+token}});
   if(!Array.isArray(d.items))fail();
   for(const b of d.items){if(typeof b.id!=='string'||!/^\d+$/.test(b.id)||typeof b.name!=='string'||!b.name.trim()||b.privacy!=='PUBLIC'||typeof b.owner?.username!=='string')fail();if(b.owner.username.toLowerCase()!==c.expectedUsername)continue;if(result.some(x=>x.id===b.id))fail();result.push({id:b.id,name:b.name});}
   if(!d.bookmark)return result;
   if(typeof d.bookmark!=='string'||d.bookmark.length>4096||seen.has(d.bookmark))fail();seen.add(d.bookmark);bookmark=d.bookmark;
  }
  fail();
 }

}
export const PINTEREST_SCHEMA=`
CREATE TABLE IF NOT EXISTS ad_scheduler_pinterest_attempts(state_hash TEXT PRIMARY KEY,binding_hash TEXT NOT NULL,app_id TEXT NOT NULL,expires_at TIMESTAMPTZ NOT NULL,consumed_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS ad_scheduler_pinterest_authorizations(id UUID PRIMARY KEY,app_id TEXT NOT NULL,account_id TEXT NOT NULL,username TEXT NOT NULL,scopes JSONB NOT NULL,protected_tokens JSONB NOT NULL,token_expires_at TIMESTAMPTZ NOT NULL,refresh_expires_at TIMESTAMPTZ NOT NULL,status TEXT NOT NULL DEFAULT 'pending_review',created_at TIMESTAMPTZ NOT NULL);
`;
export class PinterestStore {
 constructor(pool,clock=()=>new Date()){this.pool=pool;this.clock=clock;this.initializing=null;}
 async ready(){if(!this.pool)fail();if(!this.initializing)this.initializing=this.pool.query(PINTEREST_SCHEMA).catch(e=>{this.initializing=null;throw e;});await this.initializing;}
 async begin(c){await this.ready();const state=nonce(),binding=nonce();await this.pool.query('INSERT INTO ad_scheduler_pinterest_attempts(state_hash,binding_hash,app_id,expires_at) VALUES($1,$2,$3,$4)',[hash(state),hash(binding),c.appId,new Date(+this.clock()+600000)]);return {state,binding};}
 async consume(state,binding,c){if(!/^[A-Za-z0-9_-]{43}$/.test(state||'')||!/^[A-Za-z0-9_-]{43}$/.test(binding||''))return false;await this.ready();return (await this.pool.query('UPDATE ad_scheduler_pinterest_attempts SET consumed_at=$1 WHERE state_hash=$2 AND binding_hash=$3 AND app_id=$4 AND expires_at>$1 AND consumed_at IS NULL RETURNING state_hash',[this.clock(),hash(state),hash(binding),c.appId])).rowCount===1;}
 async save(c,account,t){await this.ready();const id=randomUUID(),now=this.clock();const box=sealToken(JSON.stringify({access_token:t.accessToken,refresh_token:t.refreshToken}),c.key,`lyribop-pinterest-v1:${id}:${c.appId}:${account.id}`);await this.pool.query('INSERT INTO ad_scheduler_pinterest_authorizations(id,app_id,account_id,username,scopes,protected_tokens,token_expires_at,refresh_expires_at,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[id,c.appId,account.id,account.username,JSON.stringify(t.scopes),JSON.stringify(box),new Date(+now+t.expiresIn*1000),new Date(+now+t.refreshExpiresIn*1000),now]);return {id,account,status:'pending_review'};}
 async boardAuthorization(c){
  await this.ready();const rows=(await this.pool.query("SELECT id,app_id,account_id,username,scopes,protected_tokens FROM ad_scheduler_pinterest_authorizations WHERE app_id=$1 AND account_id=$2 AND lower(username)=$3 AND status='pending_review' AND token_expires_at>$4 ORDER BY created_at DESC LIMIT 1",[c.appId,'1138144274488601260',c.expectedUsername,this.clock()])).rows;
  const r=rows[0];if(!r||!Array.isArray(r.scopes)||!PIN_REVIEW_SCOPES.every(s=>r.scopes.includes(s)))throw new PinterestConnectionError('Board review needs the separately approved Pinterest permissions.');
  const t=JSON.parse(openToken(r.protected_tokens,c.key,`lyribop-pinterest-v1:${r.id}:${c.appId}:${r.account_id}`));if(typeof t.access_token!=='string'||!t.access_token)fail();return t.access_token;
 }

 async pending(c){await this.ready();const rows=(await this.pool.query("SELECT id,account_id,username,scopes,token_expires_at,created_at FROM ad_scheduler_pinterest_authorizations WHERE app_id=$1 AND lower(username)=$2 AND status='pending_review' AND token_expires_at>$3 ORDER BY created_at DESC LIMIT 10",[c.appId,c.expectedUsername,this.clock()])).rows;return rows.map(r=>({id:r.id,account:{id:r.account_id,username:r.username},token_expires_at:r.token_expires_at,created_at:r.created_at,status:'pending_review',permission_level:Array.isArray(r.scopes)&&PIN_REVIEW_SCOPES.every(s=>r.scopes.includes(s))?'public_board_pin_review':Array.isArray(r.scopes)&&r.scopes.includes('user_accounts:read')?'account_read':'needs_review'}));}
}
export function pinterestConnectionRouter({requireAdmin,store,graph=new PinterestGraph(),env=process.env,publicBase,planningEnabled=false}){
 const router=express.Router();router.use(requireAdmin);router.use((_req,res,next)=>{res.set({'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});if(!planningEnabled||env.AD_SCHEDULER_PINTEREST_CONNECTIONS_ENABLED!=='true')return res.status(503).json({error:'Pinterest connections are not enabled. Publishing remains off.'});next();});
 const safe=fn=>async(req,res)=>{try{await fn(req,res);}catch{res.status(400).json({error:'Pinterest connection needs review. No publishing was activated.'});}};
 router.get('/status',safe(async(_req,res)=>{pinterestConfiguration(env,publicBase);res.json({configured:true,publishing_enabled:false,connection_status:'not_activated',board_review_enabled:env.AD_SCHEDULER_PINTEREST_PIN_REVIEW_ENABLED==='true'});}));
 router.get('/pending',safe(async(_req,res)=>res.json({authorizations:await store.pending(pinterestConfiguration(env,publicBase)),publishing_enabled:false})));
 router.get('/boards',safe(async(_req,res)=>{if(env.AD_SCHEDULER_PINTEREST_PIN_REVIEW_ENABLED!=='true')return res.status(503).json({error:'Pinterest board review is not enabled. Publishing remains off.'});const c=pinterestConfiguration(env,publicBase),token=await store.boardAuthorization(c);await graph.identity(token,c);res.json({boards:await graph.boards(token,c),publishing_enabled:false});}));
 router.post('/start',safe(async(req,res)=>{const c=pinterestConfiguration(env,publicBase);if(req.get('Origin')!==c.origin||req.get('X-LyriBop-Scheduler')!=='1'||!req.is('application/json'))return res.sendStatus(403);const a=await store.begin(c);res.cookie(COOKIE,a.binding,{secure:true,httpOnly:true,sameSite:'lax',path:ROOT,maxAge:600000});res.json({login_url:pinterestLoginUrl(c,a.state),publishing_enabled:false});}));
 router.get('/callback',safe(async(req,res)=>{const c=pinterestConfiguration(env,publicBase);const cookies=(req.get('Cookie')||'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(COOKIE+'='));const binding=cookies.length===1?cookies[0].slice(COOKIE.length+1):'';if(typeof req.query.state!=='string'||!await store.consume(req.query.state,binding,c))return res.status(400).json({error:'Login expired or does not match this browser. No connection activated.'});res.clearCookie(COOKIE,{secure:true,httpOnly:true,sameSite:'lax',path:ROOT});if(req.query.error)fail();if(typeof req.query.code!=='string'||!req.query.code||req.query.code.length>4096)fail();const t=await graph.exchange(c,req.query.code),a=await graph.identity(t.accessToken,c);const p=await store.save(c,a,t);
 // Pinterest requires the registered callback not issue a secondary redirect.
 res.json({status:'pending_review',authorization_id:p.id,account:p.account,publishing_enabled:false,message:'Pinterest account received. Return to the scheduler for review. Publishing remains off.'});}));
 return router;
}
