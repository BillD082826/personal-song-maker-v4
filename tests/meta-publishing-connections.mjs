import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID,randomBytes} from 'node:crypto';
import {MetaPublishingConnections,META_DESTINATIONS} from '../lib/meta-publishing-connections.mjs';import {sealToken} from '../lib/meta-connection.mjs';
const key=randomBytes(32),env={AD_SCHEDULER_ENABLED:'true',AD_SCHEDULER_META_CONNECTIONS_ENABLED:'true',DATABASE_URL:'TEST_ONLY',META_APP_ID:'1689275265898013',META_APP_SECRET:'FAKE',META_LOGIN_CONFIG_ID:'2105143776809540',META_EXPECTED_BUSINESS_ID:'1050270251226174',META_EXPECTED_INSTAGRAM_ID:META_DESTINATIONS.instagram,AD_SCHEDULER_TOKEN_KEY:key.toString('base64')};
const now=new Date('2026-11-05T22:00:00Z');
function auth(patch={}){const id=randomUUID();return {id,app_id:env.META_APP_ID,config_id:env.META_LOGIN_CONFIG_ID,business_id:env.META_EXPECTED_BUSINESS_ID,status:'pending_review',accounts:[{id:META_DESTINATIONS.instagram,username:'lyribop'}],token_expires_at:null,protected_token:sealToken('SECRET',key,`lyribop-meta-v1:${id}:${env.META_APP_ID}:${env.META_LOGIN_CONFIG_ID}`),...patch};}
function readiness(){return {mode:'meta_publishing_readiness',publishing_enabled:false,posts_changed:0,connections_activated:0,facebook:{identity_verified:true,publishing_permission_granted:true,page_id:META_DESTINATIONS.facebook},instagram:{identity_verified:true,publishing_permission_granted:true,account_id:META_DESTINATIONS.instagram}};}
test('approval and exact configuration gates refuse before database/provider access',async()=>{
 const pool={query:()=>assert.fail('query'),connect:()=>assert.fail('connect')};await assert.rejects(new MetaPublishingConnections(pool,{env}).activate());
 for(const patch of [{AD_SCHEDULER_ENABLED:'false'},{META_LOGIN_CONFIG_ID:'other'},{PUBLIC_BASE_URL:'https://wrong.test'}])await assert.rejects(new MetaPublishingConnections(pool,{env:{...env,...patch}}).install());
});
test('wrong expired superseded or mismatched saved authorizations stop before provider reads',async()=>{
 for(const patch of [{business_id:'other'},{token_expires_at:'invalid'},{token_expires_at:'2020-01-01'},{status:'superseded'},{accounts:[{id:'other',username:'lyribop'}]}]){
 const store=new MetaPublishingConnections({query:async()=>({rows:[auth(patch)]})},{env,clock:()=>now,review:()=>assert.fail('provider')});await assert.rejects(store.activate({approved:true}));}
});
test('failed Page readiness prevents registry mutation',async()=>{
 const store=new MetaPublishingConnections({query:async()=>({rows:[auth()]}),connect:()=>assert.fail('transaction')},{env,clock:()=>now,review:async()=>({...readiness(),facebook:{identity_verified:false}})});await assert.rejects(store.activate({approved:true}));
});
test('pre-send refuses inactive binding and revoked grant before callback; rechecks deactivation after provider read',async()=>{
 const row=auth(),connection={platform:'instagram',account_id:META_DESTINATIONS.instagram,authorization_id:row.id,status:'active'};
 for(const scenario of ['inactive','revoked','deactivated']){
 let queries=0;const pool={query:async()=>{queries++;return {rows:queries===1?[{...connection,status:scenario==='inactive'?'inactive':'active'}]:queries===2?[row]:[]};}};
 const store=new MetaPublishingConnections(pool,{env,clock:()=>now,review:async()=>scenario==='revoked'?{...readiness(),instagram:{identity_verified:true,publishing_permission_granted:false,account_id:META_DESTINATIONS.instagram}}:readiness()});await assert.rejects(store.withCheckedConnection('instagram',()=>assert.fail('send')));
 }
});
test('real isolated PostgreSQL: atomic two-account activation, concurrent idempotency, audit and deactivation survive reopen',{skip:!process.env.SCHEDULER_TEST_DATABASE_URL},async()=>{
 const {default:pg}=await import('pg');const {META_SCHEMA}=await import('../lib/meta-connection.mjs');const pool=new pg.Pool({connectionString:process.env.SCHEDULER_TEST_DATABASE_URL,options:'-c search_path=lyribop_test_activation'});
 try{
 await pool.query('CREATE SCHEMA IF NOT EXISTS lyribop_test_activation');await pool.query(META_SCHEMA);const a=auth();
 await pool.query('INSERT INTO ad_scheduler_meta_authorizations(id,app_id,config_id,system_user_id,business_id,accounts,protected_token,status,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[a.id,a.app_id,a.config_id,'123',a.business_id,JSON.stringify(a.accounts),JSON.stringify(a.protected_token),a.status,now]);
 const options={env,clock:()=>now,review:async({token})=>{assert.equal(token,'SECRET');return readiness();}},store=new MetaPublishingConnections(pool,options);await store.install();
 const results=await Promise.all([store.activate({approved:true}),store.activate({approved:true})]);assert.equal(results.reduce((n,r)=>n+r.connections_added,0),2);assert(!JSON.stringify(results).includes('SECRET'));
 const reopened=new MetaPublishingConnections(pool,options);let sends=0;await reopened.withCheckedConnection('instagram',async({token,accountId})=>{assert.equal(token,'SECRET');assert.equal(accountId,META_DESTINATIONS.instagram);sends++;});assert.equal(sends,1);
 assert.equal((await pool.query('SELECT * FROM ad_scheduler_publishing_connections')).rows.length,2);assert.equal((await pool.query('SELECT * FROM ad_scheduler_connection_events')).rows.length,2);
 await reopened.deactivate({approved:true});assert.equal((await pool.query('SELECT * FROM ad_scheduler_connection_events')).rows.length,4);await assert.rejects(reopened.activate({approved:true}));await assert.rejects(reopened.withCheckedConnection('instagram',()=>assert.fail('send')));
 }finally{await pool.end();}
});
