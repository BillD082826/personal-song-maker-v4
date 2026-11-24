// Reviewed operational batch. Saving drafts does not approve or publish.
import pg from 'pg';
import {HostedScheduler,loadSchedulerCatalog,validatePlan} from '../lib/ad-scheduler.mjs';
import {deliverySnapshotHash} from '../lib/ad-delivery-records.mjs';
import {FacebookPilotApprovals} from '../lib/facebook-pilot-approvals.mjs';
import {InstagramApprovals} from '../lib/instagram-scheduler-approvals.mjs';
import {PinterestApprovals} from '../lib/pinterest-scheduler-approvals.mjs';
import {pinterestSchedulerBoards} from '../lib/pinterest-scheduler-boards.mjs';
const mode=process.argv[2];
if(process.argv.length!==3||!['--review','--save-drafts','--approve-existing'].includes(mode))throw Error('Choose review, save-drafts or approve-existing.');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
const statics={facebook:[66,43,5,15,53,1,66],instagram:[67,44,33,36,54,29,67],pinterest:[68,45,12,16,55,14,68]};
const stories={facebook:[19,18,17,20,19,18,17],instagram:[39,38,37,40,39,38,37],pinterest:[23,22,21,24,23,22,21]};
const videos=[1,2,6,7,3,4,8];
const classes={facebook:FacebookPilotApprovals,instagram:InstagramApprovals,pinterest:PinterestApprovals};
const tables={facebook:'ad_scheduler_facebook_pilot_approvals',instagram:'ad_scheduler_instagram_approvals',pinterest:'ad_scheduler_pinterest_approvals'};
try{
 const catalog=await loadSchedulerCatalog();
 const boardReader=pinterestSchedulerBoards({pool,publicBase:process.env.PUBLIC_BASE_URL});
 const {boards}=await boardReader();const board=boards.find(x=>x.id==='1138144205771307778');if(!board)throw Error('Reviewed Pinterest board unavailable.');
 const scheduler=new HostedScheduler(pool,{pinterestBoards:boardReader});const items=[];
 for(const platform of Object.keys(statics))for(let i=0;i<7;i++){
  const day=new Date(Date.UTC(2026,10,27+i)).toISOString().slice(0,10);
  for(const [format,id,time] of [['single_image',statics[platform][i],'09:00'],['video',videos[i],'13:00'],['story_collection',stories[platform][i],'18:00']]){
   const ad=catalog.find(a=>a.id===id&&a.platform===platform&&a.format===format&&a.ready);if(!ad)throw Error('Missing ready artwork');
   if(!ad.caption.includes('lyribop.com')||/30[- ]second|personal-song-maker-v5-test|lyribop\.onrender\.com/i.test(ad.caption))throw Error('Caption needs review');
   const input={platform,ad_id:id,format,slots:[{day,time}],...(platform==='pinterest'?{board_id:board.id}:{})};
   validatePlan(input,catalog);
   const existing=(await pool.query("SELECT p.*,a.status AS approval_status,d.state AS delivery_state FROM ad_scheduler_plans p LEFT JOIN "+tables[platform]+" a ON a.plan_id=p.id LEFT JOIN ad_scheduler_deliveries d ON d.plan_id=p.id WHERE p.platform=$1 AND p.local_day=$2 AND p.local_time=$3 AND p.status='planned'",[platform,day,time])).rows;
   if(existing.length>1||existing.some(p=>p.snapshot.ad_id!==id||(p.snapshot.format||'single_image')!==format||p.snapshot.caption!==ad.caption||p.delivery_state||p.approval_status==='revoked'))throw Error('Slot conflict; no existing plan overwritten');
   items.push({platform,day,time,format,id,name:ad.name,caption:ad.caption,input,existing:existing[0]||null});
  }
 }
 console.log(JSON.stringify({mode,total:items.length,board:board.name,posts:items.map(({input,existing,...x})=>({...x,saved:!!existing,approved:existing?.approval_status==='approved'}))}));
 if(mode==='--review')process.exitCode=0;
 else if(mode==='--save-drafts'){
  for(const x of items)if(!x.existing)await scheduler.add(x.input);
  console.log(JSON.stringify({saved:items.length,approved:0,published:0}));
 }else{
  if(items.some(x=>!x.existing))throw Error('Save and review every draft first');
  for(const platform of Object.keys(statics)){
   const posts=items.filter(x=>x.platform===platform&&x.existing.approval_status!=='approved').map(x=>({plan_id:x.existing.id,snapshot_sha256:deliverySnapshotHash(x.existing.snapshot),scheduled_at:new Date(x.existing.scheduled_at).toISOString()}));
   if(posts.length)await new classes[platform](pool).approveBatch({confirm:true,posts});
   console.log(JSON.stringify({platform,approved:21}));
  }
 }
}finally{await pool.end();}
