import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { MetaStateStore, MetaGraph, MetaConnectionError, metaConfiguration, sealToken, openToken, tokenKey, loginUrl, metaConnectionRouter } from '../lib/meta-connection.mjs';
const env={META_APP_ID:'1689275265898013',META_APP_SECRET:'FAKE_SECRET_FOR_TESTS',META_LOGIN_CONFIG_ID:'123456789',AD_SCHEDULER_TOKEN_KEY:randomBytes(32).toString('base64'),AD_SCHEDULER_META_CONNECTIONS_ENABLED:'true'};
const config=metaConfiguration(env,'https://lyribop.example/');
const fakeToken='FAKE_META_TOKEN_DO_NOT_USE';

test('server configuration rejects insecure origins/missing secrets and keeps secret out of login URL',()=>{
 for(const base of ['http://lyribop.example','https://user:password@lyribop.example'])assert.throws(()=>metaConfiguration(env,base));
 assert.throws(()=>metaConfiguration({...env,META_APP_SECRET:''},'https://lyribop.example'));
 assert.throws(()=>tokenKey('short-key'));
 assert.deepEqual(tokenKey(' \n'+env.AD_SCHEDULER_TOKEN_KEY+'\n '),tokenKey(env.AD_SCHEDULER_TOKEN_KEY));
 assert.throws(()=>tokenKey('openssl rand -base64 32 | pbcopy'));
 assert.throws(()=>tokenKey(env.AD_SCHEDULER_TOKEN_KEY.slice(0,20)+'\n'+env.AD_SCHEDULER_TOKEN_KEY.slice(20)));
 const url=new URL(loginUrl(config,'state'));assert.equal(url.origin,'https://www.facebook.com');assert.equal(url.searchParams.get('redirect_uri'),'https://lyribop.example/api/admin/ad-scheduler/meta/callback');assert(!url.toString().includes(env.META_APP_SECRET));assert(!url.searchParams.has('scope'));
});
test('token encryption authenticates ciphertext and binds it to the correct authorization',()=>{
 const box=sealToken(fakeToken,config.key,'id:app:config');assert(!JSON.stringify(box).includes(fakeToken));assert.equal(openToken(box,config.key,'id:app:config'),fakeToken);
 assert.throws(()=>openToken(box,randomBytes(32),'id:app:config'));assert.throws(()=>openToken(box,config.key,'other-id:app:config'));
 const tampered={...box,content:Buffer.from('tampered').toString('base64')};assert.throws(()=>openToken(tampered,config.key,'id:app:config'));
});
test('Meta adapter uses only fixed Meta endpoints, bearer header for account reads, no redirects, and safe errors',async()=>{
 const seen=[];const replies=[{access_token:fakeToken,expires_in:3600},{id:'42'},{data:[{id:'99',username:'lyribop'}]}];
 const graph=new MetaGraph(async(url,options)=>{seen.push([String(url),options]);return {ok:true,json:async()=>replies.shift()};});
 const exchanged=await graph.exchange(config,'fake-code');assert.equal(exchanged.token,fakeToken);
 assert.deepEqual(await graph.identity(exchanged.token),{systemUserId:'42',accounts:[{id:'99',username:'lyribop'}]});
 assert(seen.every(([url,options])=>new URL(url).origin==='https://graph.facebook.com'&&options.redirect==='error'));
 assert.equal(seen[1][1].headers.Authorization,'Bearer '+fakeToken);assert(!seen[1][0].includes(fakeToken));
 const failing=new MetaGraph(async()=>{throw new Error('URL WITH '+env.META_APP_SECRET+fakeToken);});
 await assert.rejects(failing.exchange(config,'code'),e=>e instanceof MetaConnectionError&&!e.message.includes(fakeToken)&&!e.message.includes(env.META_APP_SECRET));
});
test('account discovery refuses empty, malformed or incomplete paginated selections',async()=>{
 for(const data of [{data:[]},{data:[{id:'not-a-number',username:'x'}]},{data:[{id:'99',username:'x'}],paging:{next:'https://evil.example'}}]){
  let count=0;const graph=new MetaGraph(async()=>({ok:true,json:async()=>++count===1?{id:'42'}:data}));await assert.rejects(graph.identity(fakeToken),MetaConnectionError);
 }
});

test('HTTP login flow checks Admin, flag, origin, cookie/state and replay; never returns a token or activates posting',async()=>{
 const attempts=new Map();let exchanges=0,saves=0,failDiscovery=false;
 const outcomes=[];const store={recordOutcome:async(_s,_b,_c,outcome)=>outcomes.push(outcome),lastAttempt:async()=>({outcome:'failed',message:'Login could not complete. Publishing remains off.'}),pending:async()=>[{id:'pending-id',accounts:[{id:'99',username:'lyribop'}],status:'pending_review'}],begin:async()=>{const state=randomBytes(32).toString('base64url'),binding=randomBytes(32).toString('base64url');attempts.set(state,binding);return {state,binding};},consume:async(state,binding)=>{if(!attempts.has(state)||attempts.get(state)!==binding)return false;attempts.delete(state);return true;},savePending:async(c,identity,token)=>{assert.equal(token,fakeToken);saves++;return {id:'authorization-id',accounts:identity.accounts};}};
 const graph={exchange:async()=>{exchanges++;return {token:fakeToken,expiresIn:3600};},identity:async()=>{if(failDiscovery)throw new MetaConnectionError('Meta approved login but returned no assigned Instagram accounts.');return {systemUserId:'42',accounts:[{id:'99',username:'lyribop'}]};}};
 const admin=(req,res,next)=>req.get('Authorization')==='Basic test'?next():res.sendStatus(401);
 const app=express();app.use(express.json());app.use('/api/admin/ad-scheduler/meta',metaConnectionRouter({requireAdmin:admin,store,graph,env,publicBase:'https://lyribop.example',planningEnabled:true}));
 app.use('/disabled',metaConnectionRouter({requireAdmin:admin,store,env:{...env,AD_SCHEDULER_META_CONNECTIONS_ENABLED:'false'},publicBase:'https://lyribop.example',planningEnabled:true}));
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+server.address().port;
 const headers={Authorization:'Basic test',Origin:'https://lyribop.example','Content-Type':'application/json','X-LyriBop-Scheduler':'1'};
 const route='/api/admin/ad-scheduler/meta';
 try{
  assert.equal((await fetch(base+route+'/pending')).status,401);
  const pendingResponse=await fetch(base+route+'/pending',{headers});assert.equal(pendingResponse.status,200);const pendingBody=await pendingResponse.json();assert.equal(pendingBody.publishing_enabled,false);assert.equal(pendingBody.authorizations[0].status,'pending_review');assert(!JSON.stringify(pendingBody).includes(fakeToken));
  assert.equal((await fetch(base+route+'/status')).status,401);assert.equal((await fetch(base+'/disabled/status',{headers})).status,503);
  assert.equal((await fetch(base+route+'/start',{method:'POST',headers:{...headers,Origin:'https://evil.example'},body:'{}'})).status,403);
  const start=await fetch(base+route+'/start',{method:'POST',headers,body:'{}'});const cookie=start.headers.get('set-cookie');assert.match(cookie,/HttpOnly/i);assert.match(cookie,/Secure/i);assert.match(cookie,/SameSite=Lax/i);assert.match(cookie,/Max-Age=600/);
  const url=new URL((await start.json()).login_url),state=url.searchParams.get('state');const callback=base+route+'/callback?state='+state+'&code=fake-code';
  assert.equal((await fetch(callback,{headers})).status,400);assert.equal(exchanges,0); // Bad cookie must not consume valid state.
  const validHeaders={...headers,Cookie:cookie.split(';')[0]};const success=await fetch(callback,{headers:validHeaders});assert.equal(success.status,200);const result=await success.json();assert.equal(result.status,'pending_review');assert.equal(result.publishing_enabled,false);assert(!JSON.stringify(result).includes(fakeToken));assert.equal(saves,1);
  assert.equal((await fetch(callback,{headers:validHeaders})).status,400);assert.equal(exchanges,1);assert.deepEqual(outcomes,['pending_review']);
  assert.equal((await fetch(base+route+'/last-attempt')).status,401);
  const last=await (await fetch(base+route+'/last-attempt',{headers})).json();assert.equal(last.publishing_enabled,false);assert(!JSON.stringify(last).includes(fakeToken));
  const again=await fetch(base+route+'/start',{method:'POST',headers,body:'{}'}),againCookie=again.headers.get('set-cookie').split(';')[0],againState=new URL((await again.json()).login_url).searchParams.get('state');
  const denied=await fetch(base+route+'/callback?state='+againState+'&error=access_denied',{headers:{...headers,Cookie:againCookie}});assert.equal(denied.status,400);assert.equal(exchanges,1);
  const browserStart=await fetch(base+route+'/start',{method:'POST',headers,body:'{}'});const browserState=new URL((await browserStart.json()).login_url).searchParams.get('state');
  const browserCallback=await fetch(base+route+'/callback?state='+browserState+'&code=fake-code',{headers:{...headers,Accept:'text/html',Cookie:browserStart.headers.get('set-cookie').split(';')[0]},redirect:'manual'});assert.equal(browserCallback.status,303);assert.equal(browserCallback.headers.get('location'),'/admin/ad-scheduler/#connections');
  failDiscovery=true;const failedStart=await fetch(base+route+'/start',{method:'POST',headers,body:'{}'});const failedState=new URL((await failedStart.json()).login_url).searchParams.get('state'),failedCookie=failedStart.headers.get('set-cookie').split(';')[0];
  const failedUrl=base+route+'/callback?state='+failedState+'&code=fake-code';assert.equal((await fetch(failedUrl,{headers:{...headers,Cookie:failedCookie}})).status,400);assert.equal(outcomes.at(-1),'account_empty');const outcomeCount=outcomes.length;assert.equal((await fetch(failedUrl,{headers})).status,400);assert.equal(outcomes.length,outcomeCount);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});

test('real isolated PostgreSQL: expiring single-use state and encrypted pending records survive reopen', {skip:!process.env.SCHEDULER_TEST_DATABASE_URL},async()=>{
 const {default:pg}=await import('pg');const pool=new pg.Pool({connectionString:process.env.SCHEDULER_TEST_DATABASE_URL});let clock=new Date('2026-11-02T12:00:00Z');
 try{
  const store=new MetaStateStore(pool,()=>clock),attempt=await store.begin(config);
  assert.equal(await store.consume(attempt.state,'invalid',config),false);
  assert.equal(await store.consume(attempt.state,attempt.binding,{...config,configId:'other'}),false);
  const two=await Promise.all([store.consume(attempt.state,attempt.binding,config),store.consume(attempt.state,attempt.binding,config)]);assert.equal(two.filter(Boolean).length,1);
  await store.recordOutcome(attempt.state,attempt.binding,config,'account_empty');await store.recordOutcome(attempt.state,attempt.binding,config,'failed');
  const firstOutcome=await store.lastAttempt(config);assert.equal(firstOutcome.outcome,'account_empty');assert(!JSON.stringify(firstOutcome).includes(attempt.state));assert(!JSON.stringify(firstOutcome).includes(attempt.binding));
  const expired=await store.begin(config);clock=new Date(+clock+11*60000);assert.equal(await store.consume(expired.state,expired.binding,config),false);
  const saved=await store.savePending(config,{systemUserId:'42',accounts:[{id:'99',username:'lyribop'}]},fakeToken,3600);
  const row=(await pool.query('SELECT * FROM ad_scheduler_meta_authorizations WHERE id=$1',[saved.id])).rows[0];assert.equal(row.status,'pending_review');assert.equal(row.business_id,null);
  const businessSaved=await store.savePending(config,{systemUserId:'42',businessId:'11',accounts:[{id:'99',username:'lyribop'}]},fakeToken,3600);assert.equal((await pool.query('SELECT business_id FROM ad_scheduler_meta_authorizations WHERE id=$1',[businessSaved.id])).rows[0].business_id,'11');assert(!JSON.stringify(row).includes(fakeToken));assert.equal(openToken(row.protected_token,config.key,`lyribop-meta-v1:${row.id}:${row.app_id}:${row.config_id}`),fakeToken);
  assert(!JSON.stringify((await pool.query('SELECT * FROM ad_scheduler_meta_attempts')).rows).includes(attempt.state));
  const reopened=new MetaStateStore(pool,()=>clock);assert.equal(await reopened.consume(attempt.state,attempt.binding,config),false);
  const pending=await reopened.pending(config);assert(pending.some(p=>p.id===saved.id));assert(!JSON.stringify(pending).includes('protected_token'));assert(!JSON.stringify(pending).includes(fakeToken));assert.equal((await reopened.pending({...config,configId:'different-config'})).length,0);clock=new Date(+clock+61*60000);assert.equal((await reopened.pending(config)).length,0);
 }finally{await pool.end();}
});

test('pending review reads only matching unexpired metadata and never projects credentials',async()=>{
 let query,params;const pool={query:async(sql,args)=>{if(!args)return {};query=sql;params=args;return {rows:[{id:'review-id',accounts:[{id:'99',username:'<untrusted-name>',unexpected:'secret'}],created_at:'now',token_expires_at:null,protected_token:'must-not-leak'}]};}};
 const store=new MetaStateStore(pool,()=>new Date('2026-11-02T12:00:00Z'));
 const result=await store.pending(config);assert.deepEqual(params,[config.appId,config.configId,'2026-11-02T12:00:00.000Z']);assert.match(query,/status='pending_review'/);assert.match(query,/token_expires_at>\$3/);assert.match(query,/LIMIT 10/);assert(!query.includes('protected_token'));assert(!JSON.stringify(result).includes('secret'));assert(!JSON.stringify(result).includes('must-not-leak'));assert.equal(result[0].accounts[0].username,'<untrusted-name>');
});

test('discovery diagnostics distinguish empty assignments, incomplete details and pagination without provider data',async()=>{
 for(const [reply,pattern] of [[{data:[]},/no assigned Instagram/],[{data:[{id:'99'}]},/incomplete Instagram account details/],[{data:[{id:'99',username:'x'}],paging:{next:'https://example.invalid/PRIVATE'}},/pagination review/]]){
  let calls=0;const graph=new MetaGraph(async()=>({ok:true,json:async()=>++calls===1?{id:'42'}:reply}));
  await assert.rejects(graph.identity(fakeToken),e=>pattern.test(e.message)&&!e.message.includes('PRIVATE')&&!e.message.includes(fakeToken));
 }
});

test('last-attempt summary excludes hashes and provider details and rejects unknown outcomes',async()=>{
 let captured;const pool={query:async(sql,args)=>{if(!args)return {};captured=sql;return {rows:[{outcome:'account_details',expires_at:'later',consumed_at:'now',state_hash:'PRIVATE_HASH'}]};}};
 const store=new MetaStateStore(pool);const result=await store.lastAttempt(config);assert.match(result.message,/incomplete Instagram/);assert(!JSON.stringify(result).includes('PRIVATE_HASH'));assert(!captured.includes('state_hash'));
 await assert.rejects(store.recordOutcome('state','binding',config,'RAW_PROVIDER_SECRET'));
});

test('expected-account lookup requires matching Meta business and an authorized exact account read',async()=>{
 const expected={expectedBusinessId:'1050270251226174',expectedInstagramId:'17841431950776323'};
 const seen=[];const replies=[{id:'42',client_business_id:expected.expectedBusinessId},{data:[]},{id:expected.expectedInstagramId,username:'lyribop'}];
 const graph=new MetaGraph(async(url,options)=>{seen.push([String(url),options]);return {ok:true,json:async()=>replies.shift()};});
 assert.deepEqual(await graph.identity(fakeToken,expected),{systemUserId:'42',businessId:expected.expectedBusinessId,accounts:[{id:expected.expectedInstagramId,username:'lyribop'}]});assert.equal(seen.length,3);assert.equal(new URL(seen[2][0]).pathname,'/v26.0/'+expected.expectedInstagramId);assert.equal(seen[2][1].headers.Authorization,'Bearer '+fakeToken);assert(seen.every(([url])=>!url.includes(fakeToken)));
});
test('known IDs never bypass wrong business, failed access, wrong account or unexpected selection',async()=>{
 const expected={expectedBusinessId:'11',expectedInstagramId:'99'};
 for(const [me,list,account] of [[{id:'42',client_business_id:'12'},{data:[]},{id:'99',username:'x'}],[{id:'42',client_business_id:'11'},{data:[]},{id:'98',username:'x'}],[{id:'42',client_business_id:'11'},{data:[{id:'98',username:'x'}]},{}],[{id:'42',client_business_id:'11'},{data:[]},null]]){
  const replies=[me,list,account];let calls=0;const graph=new MetaGraph(async()=>{calls++;const reply=replies.shift();return {ok:reply!==null,json:async()=>reply};});await assert.rejects(graph.identity(fakeToken,expected),MetaConnectionError);if(me.client_business_id==='12')assert.equal(calls,2);
 }
 assert.throws(()=>metaConfiguration({...env,META_EXPECTED_BUSINESS_ID:'11'},'https://lyribop.example'));
});
