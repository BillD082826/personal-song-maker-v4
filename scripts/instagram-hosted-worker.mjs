import pg from 'pg';
import {InstagramHostedWorker,WORKER_SCHEMA} from '../lib/instagram-hosted-worker.mjs';
import {INSTAGRAM_APPROVAL_SCHEMA} from '../lib/instagram-scheduler-approvals.mjs';
import {validateDeliveryInstallation} from '../lib/ad-delivery-records.mjs';
const [action,...extra]=process.argv.slice(2);
if(extra.length||!['--install-approved-storage','--status','--enable-approved-worker','--disable-worker'].includes(action))throw Error('Choose an explicit Instagram storage or worker action.');
validateDeliveryInstallation(process.env);
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
try{
 const worker=new InstagramHostedWorker(pool);
 if(action==='--install-approved-storage'){
  const db=await pool.connect();try{await db.query('BEGIN');await db.query(WORKER_SCHEMA);if((await db.query('SELECT enabled FROM ad_scheduler_instagram_worker WHERE id=1 FOR UPDATE')).rows[0]?.enabled!==false)throw Error('Switch Instagram scheduling off first.');await db.query(INSTAGRAM_APPROVAL_SCHEMA);await db.query('COMMIT');console.log(JSON.stringify({mode:'instagram_storage_installed',enabled:false,posts_changed:0}));}catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
 }else console.log(JSON.stringify(action==='--status'?await worker.status():await worker.setEnabled(action==='--enable-approved-worker',{approved:true})));
}catch{console.error('Instagram scheduler setup needs review. This command does not publish posts.');process.exitCode=1;}finally{await pool.end();}
