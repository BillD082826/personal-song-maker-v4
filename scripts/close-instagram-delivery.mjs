import pg from 'pg';
import { DeliveryRecords, validateDeliveryInstallation } from '../lib/ad-delivery-records.mjs';

const [flag, planId] = process.argv.slice(2);
if (process.argv.length !== 4 || flag !== '--confirm-not-visible' ||
    !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(planId)) {
  throw Error('Provide --confirm-not-visible and the reviewed Instagram plan ID.');
}
validateDeliveryInstallation(process.env);
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  await new DeliveryRecords(pool).transaction(async db => {
    const lock = await db.query("SELECT pg_try_advisory_xact_lock(hashtext('lyribop-instagram-hosted-worker-v1')) AS locked");
    if (!lock.rows[0]?.locked) throw Error('Instagram worker is busy.');
    const worker = await db.query('SELECT enabled FROM ad_scheduler_instagram_worker WHERE id=1 FOR UPDATE');
    if (worker.rows[0]?.enabled !== false) throw Error('Instagram scheduling must be off.');
    await db.query(`ALTER TABLE ad_scheduler_deliveries
      DROP CONSTRAINT ad_scheduler_deliveries_state_check,
      ADD CONSTRAINT ad_scheduler_deliveries_state_check
      CHECK (state IN ('reserved','creating','container_ready','publishing','verifying','verified','needs_review','closed_unverified'))`);
    const result = await db.query(`UPDATE ad_scheduler_deliveries SET state='closed_unverified',updated_at=now()
      WHERE plan_id=$1 AND platform='instagram' AND state='needs_review' AND scheduled_at < now()
        AND permalink IS NULL RETURNING plan_id`, [planId]);
    if (result.rowCount !== 1) throw Error('Expected one unresolved past Instagram delivery.');
    await db.query(`UPDATE ad_scheduler_instagram_worker SET last_outcome='idle'
      WHERE id=1 AND last_plan_id=$1 AND last_outcome='needs_review'`, [planId]);
  });
  console.log('Closed without verified publication. Original delivery claim retained. Instagram scheduling is off.');
} finally {
  await pool.end();
}
