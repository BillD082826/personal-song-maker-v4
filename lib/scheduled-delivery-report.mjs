import {projectInstagramDelivery} from './instagram-scheduled-report.mjs';
// Stored delivery receipts only: no provider requests, credentials or mutations.
import {deliverySnapshotHash} from './ad-delivery-records.mjs';
const labels={reserved:'Delivery reserved — awaiting result',creating:'Preparing delivery — confirmation pending',container_ready:'Media prepared — confirmation pending',publishing:'Sending — confirmation pending',verifying:'Post returned — verification pending',verified:'Verified scheduled pilot',needs_review:'Needs review — do not resend'};
export function projectScheduledDelivery(row){
 if(row.platform!=='facebook')return null;
 const planId=row.plan_id;if(typeof planId!=='string'||! /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(planId))return null;
 let valid=false;try{valid=row.platform==='facebook'&&row.destination_id==='1271936012676830'&&row.snapshot?.platform==='facebook'&&typeof row.snapshot.caption==='string'&&row.snapshot.caption.length<=2200&&row.snapshot_sha256===deliverySnapshotHash(row.snapshot)&&Number.isFinite(+new Date(row.scheduled_at))&&+new Date(row.scheduled_at)===+new Date(row.plan_time);}catch{}
 const result={plan_id:planId,platform:'facebook',state:valid&&Object.hasOwn(labels,row.state)?row.state:'needs_review',display_status:'Needs review — do not resend',verified_at:null,permalink:null};
 result.display_status=labels[result.state];
 if(result.state==='verified'){
  const suffix=typeof row.remote_id==='string'&&row.remote_id.match(/^1271936012676830_(\d+)$/)?.[1];let u;try{u=new URL(row.permalink);}catch{}
  if(!suffix||!u||u.protocol!=='https:'||!['facebook.com','www.facebook.com'].includes(u.hostname)||u.username||u.password||u.port||u.search||u.hash||!new RegExp('^/\\d+/posts/'+suffix+'/?$').test(u.pathname)||!row.updated_at||!Number.isFinite(+new Date(row.updated_at))){result.state='needs_review';result.display_status=labels.needs_review;return result;}
  result.verified_at=new Date(row.updated_at).toISOString();result.permalink=u.href;
 }
 return result;
}
export function projectPinterestDelivery(row){
 if(row.platform!=='pinterest'||! /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(row.plan_id||''))return null;
 const result={plan_id:row.plan_id,platform:'pinterest',state:'needs_review',display_status:labels.needs_review,verified_at:null,permalink:null};
 const board=row.snapshot?.pinterest_board;
 if(row.snapshot?.platform!=='pinterest'||board?.account!=='lyribop'||!/^\d+$/.test(board.id||'')||
    row.destination_id!==board.id||row.snapshot_sha256!==deliverySnapshotHash(row.snapshot)||
    !Number.isFinite(Date.parse(row.scheduled_at))||+new Date(row.scheduled_at)!==+new Date(row.plan_time)||
    !['reserved','publishing','verifying','verified','needs_review'].includes(row.state))return result;
 if(row.state!=='verified')return {...result,state:row.state,display_status:labels[row.state]};
 if(!/^\d+$/.test(row.remote_id||'')||row.permalink!=='https://www.pinterest.com/pin/'+row.remote_id+'/'||
    !Number.isFinite(Date.parse(row.updated_at)))return result;
 return {...result,state:'verified',display_status:'Verified scheduled Pin',permalink:row.permalink,verified_at:new Date(row.updated_at).toISOString()};
}
export async function scheduledDeliveryReport(pool){
 const exists=(await pool.query("SELECT to_regclass('ad_scheduler_deliveries') AS relation")).rows[0];if(!exists?.relation)return [];
 const rows=(await pool.query(`SELECT d.plan_id,d.platform,d.destination_id,d.snapshot_sha256,d.scheduled_at,d.state,d.remote_id,d.permalink,d.updated_at,p.snapshot,p.scheduled_at AS plan_time FROM ad_scheduler_deliveries d JOIN ad_scheduler_plans p ON p.id=d.plan_id ORDER BY d.updated_at DESC LIMIT 1001`)).rows;
 if(rows.length>1000)throw Error('Delivery report needs review.');return rows.map(row=>row.platform==='instagram'?projectInstagramDelivery(row):row.platform==='pinterest'?projectPinterestDelivery(row):projectScheduledDelivery(row)).filter(Boolean);
}
