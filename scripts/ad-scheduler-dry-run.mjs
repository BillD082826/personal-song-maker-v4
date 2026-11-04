import pg from 'pg';import {inspectSchedulerPlans,readSchedulerDryRun} from '../lib/ad-scheduler-dry-run.mjs';
const args=process.argv.slice(2);
if(args.length===1&&args[0]==='--check')console.log(JSON.stringify(inspectSchedulerPlans({plans:[],paused:true})));
else if(args.length===1&&args[0]==='--report'){
 if(!process.env.DATABASE_URL)throw Error('Database configuration missing.');
 const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});try{console.log(JSON.stringify(await readSchedulerDryRun(pool)));}catch{console.error('Dry-run inspection could not complete. Nothing was published or changed.');process.exitCode=1;}finally{await pool.end();}
}else{console.error('Use --check (offline) or --report (read-only database inspection).');process.exitCode=1;}
