// Explicit storage migration only. Never starts the worker or sends a post.
import pg from 'pg';
import {FacebookPilotApprovals} from '../lib/facebook-pilot-approvals.mjs';
import {validateDeliveryInstallation} from '../lib/ad-delivery-records.mjs';
if(process.argv.length!==3||process.argv[2]!=='--install-approved-storage')throw Error('Explicit weekly storage approval required.');
validateDeliveryInstallation(process.env);
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
try{console.log(JSON.stringify(await new FacebookPilotApprovals(pool).installWeekly()));}finally{await pool.end();}
