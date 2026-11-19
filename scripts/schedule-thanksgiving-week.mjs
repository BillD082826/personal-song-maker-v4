import pg from 'pg';
import {HostedScheduler, loadSchedulerCatalog} from '../lib/ad-scheduler.mjs';
import {deliverySnapshotHash} from '../lib/ad-delivery-records.mjs';
import {FacebookPilotApprovals} from '../lib/facebook-pilot-approvals.mjs';
import {InstagramApprovals} from '../lib/instagram-scheduler-approvals.mjs';
import {PinterestApprovals} from '../lib/pinterest-scheduler-approvals.mjs';
import {pinterestSchedulerBoards} from '../lib/pinterest-scheduler-boards.mjs';

const apply = process.argv[2] === '--save-and-approve';
if (process.argv.length !== 3 || !['--review','--save-and-approve'].includes(process.argv[2])) {
  throw Error('Use --review or --save-and-approve.');
}
const pool = new pg.Pool({connectionString:process.env.DATABASE_URL});
const rotations = {
  facebook:[1,2,3,4,5,6,7,15,25,26,43,50,53,56,59,62,66],
  instagram:[27,28,33,30,31,34,32,29,35,36,44,51,54,57,60,63,67],
  pinterest:[8,9,10,11,12,13,14,16,41,42,45,52,55,58,61,64,68]
};
const tables = {
 facebook:'ad_scheduler_facebook_pilot_approvals',
 instagram:'ad_scheduler_instagram_approvals',
 pinterest:'ad_scheduler_pinterest_approvals'
};
try {
 const catalog = await loadSchedulerCatalog();
 const boardReader = pinterestSchedulerBoards({pool,publicBase:process.env.PUBLIC_BASE_URL});
 const {boards} = await boardReader();
 const board = boards.find(b=>b.id==='1138144205771307778');
 if(!board)throw Error('Personalized Song Gifts board is unavailable.');
 const scheduler = new HostedScheduler(pool,{pinterestBoards:boardReader});
 const classes={facebook:FacebookPilotApprovals,instagram:InstagramApprovals,pinterest:PinterestApprovals};
 for(const [platform,rotation] of Object.entries(rotations)){
  const schedule=[];
  for(let day=20;day<=26;day++){
   for(const [slot,time] of ['09:00','13:00','18:00'].entries()){
    const index=(day-20)*3+slot;
    const id=day===26&&slot===0?{facebook:101,instagram:102,pinterest:103}[platform]:rotation[index%rotation.length];
    const ad=catalog.find(a=>a.id===id&&a.platform===platform&&a.ready);
    if(!ad)throw Error('Approved ad missing: '+id);
    schedule.push({ad,day:'2026-11-'+day,time});
   }
  }
  for(const {ad,day,time} of schedule){
   const result=await pool.query("SELECT id,snapshot FROM ad_scheduler_plans WHERE platform=$1 AND local_day=$2 AND local_time=$3 AND status='planned'",[platform,day,time]);
   if(result.rows.length>1||result.rows[0]&&result.rows[0].snapshot.ad_id!==ad.id)throw Error('Existing schedule conflicts at '+platform+' '+day+' '+time);
  }
  if(!apply){
   console.log(JSON.stringify({platform,posts:schedule.map(s=>({day:s.day,time:s.time,name:s.ad.name}))}));
   continue;
  }
  for(const {ad,day,time} of schedule){
   const existing=await pool.query("SELECT id FROM ad_scheduler_plans WHERE platform=$1 AND local_day=$2 AND local_time=$3 AND status='planned'",[platform,day,time]);
   if(!existing.rows.length)await scheduler.add({platform,ad_id:ad.id,slots:[{day,time}],...(platform==='pinterest'?{board_id:board.id}:{})});
  }
  const rows=(await pool.query(`SELECT p.*,a.status AS approval_status,d.plan_id AS delivered
    FROM ad_scheduler_plans p LEFT JOIN ${tables[platform]} a ON a.plan_id=p.id
    LEFT JOIN ad_scheduler_deliveries d ON d.plan_id=p.id
    WHERE p.platform=$1 AND p.status='planned' AND p.local_day BETWEEN '2026-11-20' AND '2026-11-26'
    ORDER BY p.scheduled_at`,[platform])).rows;
  if(rows.length!==21||rows.some(row=>row.delivered||row.approval_status&&row.approval_status!=='approved'))throw Error('Review saved schedule before approving.');
  const posts=rows.filter(row=>!row.approval_status).map(row=>({plan_id:row.id,snapshot_sha256:deliverySnapshotHash(row.snapshot),scheduled_at:new Date(row.scheduled_at).toISOString()}));
  if(posts.length)await new classes[platform](pool).approveBatch({confirm:true,posts});
  console.log(JSON.stringify({platform,saved:rows.length,approved:21,thanksgiving_greeting:'2026-11-26 09:00 Eastern'}));
 }
} finally {await pool.end();}
