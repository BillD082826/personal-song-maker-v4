import {readFile} from 'node:fs/promises';
import pg from 'pg';
import {metaConfiguration,openToken} from '../lib/meta-connection.mjs';
import {digest} from '../lib/instagram-test-post.mjs';
import {validateFacebookTest,FacebookTestStore,FacebookTestGraph,runFacebookTest,FacebookTestError} from '../lib/facebook-test-post.mjs';
const spec=JSON.parse(await readFile(new URL('./facebook-test-post.json',import.meta.url),'utf8'));
const image=await readFile(new URL('../public/social-test/lyribop-facebook-ad1-v1.png',import.meta.url));
const origin='https://personal-song-maker-v5-test.onrender.com';
validateFacebookTest(spec,image,origin);
const args=process.argv.slice(2);
if(args.length===1&&args[0]==='--check')console.log('PASS: Facebook artwork, caption and destination validated offline. No database, network or publication action.');
else if(args.length===1&&args[0]==='--publish-one-approved-test'){
 // A separate, explicit user approval is required before invoking this command.
 const config=metaConfiguration(process.env,process.env.PUBLIC_BASE_URL||origin);
 if(config.origin!==origin||process.env.AD_SCHEDULER_META_CONNECTIONS_ENABLED!=='true')throw new FacebookTestError('Configuration needs review.');
 const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
 try{
  const row=(await pool.query("SELECT id,app_id,config_id,business_id,accounts,protected_token FROM ad_scheduler_meta_authorizations WHERE app_id=$1 AND config_id=$2 AND status='pending_review' AND (token_expires_at IS NULL OR token_expires_at>now()) ORDER BY created_at DESC LIMIT 1",[config.appId,config.configId])).rows[0];
  if(!row||row.business_id!==spec.business_id||row.accounts.length!==1||row.accounts[0].id!==spec.instagram_id)throw Error();
  const response=await fetch(spec.image_url,{redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!response.ok||!response.headers.get('content-type')?.includes('image/png')||digest(Buffer.from(await response.arrayBuffer()))!==spec.image_sha256)throw Error();
  const token=openToken(row.protected_token,config.key,`lyribop-meta-v1:${row.id}:${row.app_id}:${row.config_id}`);
  console.log(JSON.stringify(await runFacebookTest({spec,image,origin,approved:true,store:new FacebookTestStore(pool),graph:new FacebookTestGraph(token)})));
 }catch(e){console.error(e instanceof FacebookTestError?e.message:'Facebook test stopped. Do not repeat; review its saved record.');process.exitCode=1;}finally{await pool.end();}
}else{console.error('Use --check. Publication requires separate explicit approval.');process.exitCode=1;}
