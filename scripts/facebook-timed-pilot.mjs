import pg from 'pg';
import {DeliveryRecords} from '../lib/ad-delivery-records.mjs';
import {MetaPublishingConnections} from '../lib/meta-publishing-connections.mjs';
import {runScheduledFacebookPilot} from '../lib/facebook-scheduled-pilot.mjs';
import {validateTimedPilot,waitForApprovedFacebookPilot} from '../lib/facebook-timed-pilot.mjs';
const args=process.argv.slice(2);
if(args.length===1&&args[0]==='--check')console.log(JSON.stringify({mode:'timed_facebook_pilot_offline_check',automatic_worker_enabled:false,provider_requests:0,posts_changed:0}));
else if(args.length===2&&args[0]==='--wait-for-approved-pilot'){
 let pool;try{
  validateTimedPilot(process.env,args[1]);pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
  const result=await waitForApprovedFacebookPilot({env:process.env,planId:args[1],pool,dispatch:approval=>runScheduledFacebookPilot({pool,records:new DeliveryRecords(pool),connections:new MetaPublishingConnections(pool),approval})});
  console.log(JSON.stringify(result));
 }catch{console.error('Pilot stopped. A post may exist if sending had begun. Review the delivery record; never retry an uncertain delivery.');process.exitCode=1;}finally{if(pool)await pool.end();}
}else{console.error('Use --check. A live pilot requires its exact saved approval, explicit enablement and --wait-for-approved-pilot PLAN_ID.');process.exitCode=1;}
