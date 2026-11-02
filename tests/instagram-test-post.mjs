import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {TestRunStore,InstagramTestGraph,runApprovedTest,validateTest,TestPostError} from '../lib/instagram-test-post.mjs';
const spec=JSON.parse(await readFile(new URL('../scripts/instagram-test-post.json',import.meta.url),'utf8'));
const image=await readFile(new URL('../public/social-test/lyribop-instagram-ad29-v1.jpg',import.meta.url));
const config={expectedInstagramId:spec.account_id,expectedBusinessId:spec.business_id,origin:'https://personal-song-maker-v5-test.onrender.com'};
function fixture(){
 const marks=[],calls=[];let reserved=false;
 const store={reserve:async()=>{if(reserved)return false;reserved=true;return true;},mark:async(...args)=>marks.push(args)};
 const graph={create:async()=>{calls.push('create');return {id:'11'};},status:async()=>{calls.push('status');return {status_code:'FINISHED'};},publish:async()=>{calls.push('publish');return {id:'22'};},verify:async()=>{calls.push('verify');return {id:'22',caption:spec.caption,username:spec.username,media_type:'IMAGE',permalink:'https://www.instagram.com/p/TEST/'};}};
 return {spec,config,image,store,graph,marks,calls,approved:true,wait:async()=>{}};
}
test('one-test validation rejects unapproved execution, changed media/caption and wrong destinations before any request',async()=>{
 const f=fixture();await assert.rejects(runApprovedTest({...f,approved:false}),TestPostError);assert.equal(f.calls.length,0);
 for(const change of [{caption:spec.caption+'x'},{account_id:'123'},{image_url:'https://evil.example/image.jpg'},{image_url:spec.image_url+'?changed=1'}])assert.throws(()=>validateTest({...spec,...change},config,image),TestPostError);
 assert.throws(()=>validateTest(spec,config,Buffer.from('notjpeg')),TestPostError);
});
test('single approved test creates once, publishes once and verifies exact caption/account/post link',async()=>{
 const f=fixture(),result=await runApprovedTest(f);assert.deepEqual(f.calls,['create','status','publish','verify']);assert.equal(result.status,'verified');assert.equal(result.publishing_enabled,false);assert.equal(f.marks.at(-1)[1],'verified');
 await assert.rejects(runApprovedTest(f),/already has a record/);assert.equal(f.calls.filter(x=>x==='publish').length,1);
});
test('uncertain publish response is retained for review and never retried',async()=>{
 const f=fixture();let publishes=0;f.graph.publish=async()=>{publishes++;throw new Error('PRIVATE_TOKEN');};await assert.rejects(runApprovedTest(f),e=>!e.message.includes('PRIVATE_TOKEN')&&/Do not retry/.test(e.message));assert.equal(f.marks.at(-1)[1],'needs_review_publishing');await assert.rejects(runApprovedTest(f));assert.equal(publishes,1);
});
test('unfinished container is polled within a bound and cannot be published',async()=>{
 const f=fixture();f.graph.status=async()=>{f.calls.push('status');return {status_code:'IN_PROGRESS'};};await assert.rejects(runApprovedTest(f));assert.equal(f.calls.filter(x=>x==='status').length,5);assert(!f.calls.includes('publish'));
});
test('post-verification mismatch does not claim success or submit again',async()=>{
 const f=fixture();f.graph.verify=async()=>({id:'22',username:'wrong',caption:spec.caption,media_type:'IMAGE',permalink:'https://evil.example/p/test/'});await assert.rejects(runApprovedTest(f));assert.equal(f.marks.at(-1)[1],'needs_review_verifying');assert.equal(f.calls.filter(x=>x==='publish').length,1);
});
test('Meta test adapter sends only fixed hosts and bearer headers, encodes exact body and sanitizes errors',async()=>{
 const seen=[];const graph=new InstagramTestGraph('PRIVATE_FAKE_TOKEN',async(url,options)=>{seen.push([url,options]);return {ok:true,json:async()=>({id:'11'})};});await graph.create(spec);await graph.publish(spec.account_id,'11');
 assert(seen.every(([url,o])=>new URL(url).origin==='https://graph.facebook.com'&&!url.includes('PRIVATE_FAKE_TOKEN')&&o.redirect==='error'&&o.headers.Authorization==='Bearer PRIVATE_FAKE_TOKEN'));
 assert.equal(seen[0][1].body.get('caption'),spec.caption);assert.equal(seen[0][1].body.get('image_url'),spec.image_url);assert.equal(seen[1][1].body.get('creation_id'),'11');
 const bad=new InstagramTestGraph('PRIVATE_FAKE_TOKEN',async()=>{throw Error('PRIVATE_FAKE_TOKEN');});await assert.rejects(bad.create(spec),e=>!e.message.includes('PRIVATE_FAKE_TOKEN'));
});
test('real isolated PostgreSQL test record prevents concurrent duplicates and survives reopening',{skip:!process.env.SCHEDULER_TEST_DATABASE_URL},async()=>{
 const {default:pg}=await import('pg');const pool=new pg.Pool({connectionString:process.env.SCHEDULER_TEST_DATABASE_URL});
 try{
  const store=new TestRunStore(pool);assert.equal(await store.reserve(spec),true);await store.mark(spec.test_id,'publishing',{container_id:'11'});
  const reopened=new TestRunStore(pool);const results=await Promise.all([store.reserve(spec),reopened.reserve(spec)]);assert.deepEqual(results,[false,false]);
  const row=(await pool.query('SELECT * FROM ad_scheduler_instagram_test_runs WHERE test_id=$1',[spec.test_id])).rows[0];assert.equal(row.state,'publishing');assert.equal(row.container_id,'11');assert.equal(row.media_id,null);assert.equal(row.image_sha256,spec.image_sha256);
 }finally{await pool.end();}
});
