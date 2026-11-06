import pg from 'pg';
import {FacebookPilotApprovals} from '../lib/facebook-pilot-approvals.mjs';
import {validateDeliveryInstallation} from '../lib/ad-delivery-records.mjs';
const args=process.argv.slice(2);
if(args.length===1&&args[0]==='--check')console.log(JSON.stringify({mode:'facebook_pilot_approval_offline_check',publishing_enabled:false,posts_changed:0}));
else if(args.length===1&&args[0]==='--install-approval-storage'){
 let pool;try{validateDeliveryInstallation(process.env);pool=new pg.Pool({connectionString:process.env.DATABASE_URL});await new FacebookPilotApprovals(pool).install();console.log(JSON.stringify({mode:'facebook_pilot_approval_storage_installed',publishing_enabled:false,posts_changed:0,approvals_created:0}));}catch{console.error('Approval storage setup could not complete. No post was approved or sent.');process.exitCode=1;}finally{if(pool)await pool.end();}
}else{console.error('Use --check or the separately approved --install-approval-storage command.');process.exitCode=1;}
