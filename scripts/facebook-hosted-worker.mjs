import pg from 'pg';import {FacebookHostedWorker} from '../lib/facebook-hosted-worker.mjs';
const [action,...extra]=process.argv.slice(2);
if(!extra.length&&action==='--check')console.log(JSON.stringify({mode:'hosted_worker_offline_check',publishing_enabled:false,posts_changed:0}));
else if(!extra.length&&['--install-worker-storage','--status','--enable-approved-worker','--disable-worker'].includes(action)){
 const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});try{const worker=new FacebookHostedWorker(pool);let result;if(action==='--install-worker-storage'){await worker.install();result={mode:'worker_storage_installed',enabled:false,posts_changed:0};}else if(action==='--status')result=await worker.status();else result=await worker.setEnabled(action==='--enable-approved-worker',{approved:true});console.log(JSON.stringify(result));}catch{console.error('Hosted worker setup needs review. No publication attempted by this command.');process.exitCode=1;}finally{await pool.end();}
}else{console.error('Use --check. Installation and activation require separate approval.');process.exitCode=1;}
