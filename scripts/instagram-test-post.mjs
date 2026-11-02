import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import pg from 'pg';
import {metaConfiguration,openToken} from '../lib/meta-connection.mjs';
import {validateTest,TestRunStore,InstagramTestGraph,runApprovedTest,TestPostError,digest} from '../lib/instagram-test-post.mjs';
const spec=JSON.parse(await readFile(new URL('./instagram-test-post.json',import.meta.url),'utf8'));
const image=await readFile(new URL('../public/social-test/lyribop-instagram-ad29-v1.jpg',import.meta.url));
const args=process.argv.slice(2);
if(args.length===1&&args[0]==='--check'){
 validateTest(spec,{expectedInstagramId:spec.account_id,expectedBusinessId:spec.business_id,origin:new URL(spec.image_url).origin},image);
 console.log('PASS: exact approved image/caption and destination validated. No network, database or publication action.');
}else if(args.length===1&&args[0]==='--publish-one-approved-test'){
 const config=metaConfiguration(process.env,process.env.PUBLIC_BASE_URL||'https://personal-song-maker-v5-test.onrender.com');
 validateTest(spec,config,image);
 if(process.env.AD_SCHEDULER_META_CONNECTIONS_ENABLED!=='true')throw new TestPostError('Connection setup is disabled.');
 const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
 try{
  const row=(await pool.query("SELECT id,app_id,config_id,business_id,accounts,protected_token FROM ad_scheduler_meta_authorizations WHERE app_id=$1 AND config_id=$2 AND status='pending_review' AND (token_expires_at IS NULL OR token_expires_at>now()) ORDER BY created_at DESC LIMIT 1",[config.appId,config.configId])).rows[0];
  if(!row||row.business_id!==spec.business_id||row.accounts.length!==1||row.accounts[0].id!==spec.account_id||row.accounts[0].username!==spec.username)throw new TestPostError('Saved authorization does not match this approved test.');
  const response=await fetch(spec.image_url,{redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!response.ok||!response.headers.get('content-type')?.includes('image/jpeg')||digest(Buffer.from(await response.arrayBuffer()))!==spec.image_sha256)throw new TestPostError('Public JPEG is unavailable or changed. No publication attempted.');
  const token=openToken(row.protected_token,config.key,`lyribop-meta-v1:${row.id}:${row.app_id}:${row.config_id}`);
  console.log(JSON.stringify(await runApprovedTest({spec,config,image,store:new TestRunStore(pool),graph:new InstagramTestGraph(token),approved:true})));
 }catch(error){console.error(error instanceof TestPostError?error.message:'Test could not complete. Do not repeat publication; review its record.');process.exitCode=1;}finally{await pool.end();}
}else{console.log('Use --check for offline validation. Publication requires a separately approved one-post command.');process.exitCode=1;}
