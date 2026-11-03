import {readFile} from 'node:fs/promises';import pg from 'pg';
import {pinterestConfiguration,PinterestStore} from '../lib/pinterest-connection.mjs';
import {validateTrialPin,TrialPinStore,TrialPinGraph,runTrialPin,TrialPinError} from '../lib/pinterest-test-pin.mjs';
const spec=JSON.parse(await readFile(new URL('./pinterest-test-pin.json',import.meta.url),'utf8'));
const image=await readFile(new URL('../marketing/advertising-dashboard/assets/images/platform-variants/LyriBop-Turn-Your-Story-into-a-Song-Pinterest-Complete-Offer-v1.png',import.meta.url));
validateTrialPin(spec,image);const args=process.argv.slice(2);
if(args.length===1&&args[0]==='--check')console.log('PASS: exact Trial artwork, wording, destination and board validated offline. No network, database or Pin action.');
else if(args.length===1&&args[0]==='--create-one-approved-trial-pin'){
 if(process.env.AD_SCHEDULER_PINTEREST_CONNECTIONS_ENABLED!=='true'||process.env.AD_SCHEDULER_PINTEREST_PIN_REVIEW_ENABLED!=='true')throw new TrialPinError('Trial review is not enabled.');
 const c=pinterestConfiguration(process.env,process.env.PUBLIC_BASE_URL||'https://personal-song-maker-v5-test.onrender.com');if(c.origin!=='https://personal-song-maker-v5-test.onrender.com')throw new TrialPinError('Site configuration needs review.');
 const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
 try{const token=await new PinterestStore(pool).boardAuthorization(c);console.log(JSON.stringify(await runTrialPin({spec,image,store:new TrialPinStore(pool),graph:new TrialPinGraph(token),approved:true})));}catch(e){console.error(e instanceof TrialPinError?e.message:'Trial Pin stopped. Do not retry creation; review its saved record.');process.exitCode=1;}finally{await pool.end();}
}else{console.error('Use --check. Creating one Trial Pin requires separate explicit approval.');process.exitCode=1;}
