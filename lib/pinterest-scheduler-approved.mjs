const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(x);
export async function readApprovedPinterest(pool,planId){
 if(!uuid(planId))throw Error('Invalid pilot reference.');
 const db=await pool.connect();let begun=false;
 try{
  await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');begun=true;
  const row=(await db.query(`SELECT a.plan_id,a.snapshot_sha256,a.destination_id,a.scheduled_at,a.status,p.platform,p.status AS plan_status,p.scheduled_at AS plan_time,s.paused,d.plan_id AS existing_delivery FROM ad_scheduler_pinterest_approvals a JOIN ad_scheduler_plans p ON p.id=a.plan_id CROSS JOIN ad_scheduler_settings s LEFT JOIN ad_scheduler_deliveries d ON d.plan_id=a.plan_id WHERE a.plan_id=$1 AND s.id=1`,[planId])).rows[0];
  if(!row||row.status!=='approved'||row.plan_status!=='planned'||row.platform!=='pinterest'||!/^\d+$/.test(row.destination_id||'')||row.paused!==false||row.existing_delivery||! /^[a-f0-9]{64}$/.test(row.snapshot_sha256)||!Number.isFinite(+new Date(row.scheduled_at))||+new Date(row.scheduled_at)!==+new Date(row.plan_time))throw Error('Pilot approval, plan or delivery needs review. Do not resend.');
  await db.query('COMMIT');begun=false;
  return {approved:true,plan_id:row.plan_id,platform:'pinterest',destination:row.destination_id,snapshot_sha256:row.snapshot_sha256,scheduled_at:new Date(row.scheduled_at).toISOString()};
 }finally{if(begun)try{await db.query('ROLLBACK');}catch{}db.release();}
}
