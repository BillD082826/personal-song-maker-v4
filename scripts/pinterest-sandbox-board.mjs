import pg from 'pg';
import {pinterestConfiguration,PinterestStore} from '../lib/pinterest-connection.mjs';
import {SANDBOX_BOARD,SandboxBoardStore,SandboxBoardGraph,runSandboxBoard} from '../lib/pinterest-sandbox-board.mjs';
import {TrialPinError} from '../lib/pinterest-test-pin.mjs';
const args=process.argv.slice(2);
if(args.length===1&&args[0]==='--check')console.log(JSON.stringify({status:'offline_check_passed',...SANDBOX_BOARD,publishing_enabled:false}));
else if(args.length===1&&args[0]==='--create-one-approved-sandbox-board'){
 if(process.env.AD_SCHEDULER_PINTEREST_SANDBOX_REVIEW_ENABLED!=='true')throw new Error('Sandbox review disabled.');
 const config=pinterestConfiguration(process.env,process.env.PUBLIC_BASE_URL||'https://personal-song-maker-v5-test.onrender.com','sandbox');
 const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});try{const token=await new PinterestStore(pool).boardAuthorization(config);console.log(JSON.stringify(await runSandboxBoard({config,store:new SandboxBoardStore(pool),graph:new SandboxBoardGraph(token),approved:true})));}catch(e){console.error(e instanceof TrialPinError?e.message:'Sandbox board needs review. Do not retry.');process.exitCode=1;}finally{await pool.end();}
}else{console.error('Use --check. Creating one Sandbox board requires separate exact approval.');process.exitCode=1;}
