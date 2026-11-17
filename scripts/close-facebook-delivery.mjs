import pg from 'pg';
import { DeliveryRecords, validateDeliveryInstallation } from '../lib/ad-delivery-records.mjs';

const [flag, planId, ...extra] = process.argv.slice(2);
const inspect = flag === '--inspect' && !planId;
const close = flag === '--confirm-not-visible' &&
  /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(planId);
if (extra.length || (!inspect && !close)) {
  throw Error('Use --inspect or --confirm-not-visible with the reviewed Facebook plan ID.');
}

validateDeliveryInstallation(process.env);
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const query = `SELECT w.enabled, w.last_outcome, w.last_plan_id,
    p.snapshot->>'name' AS name, p.scheduled_at, d.state AS delivery_state
    FROM ad_scheduler_facebook_worker w
    LEFT JOIN ad_scheduler_plans p ON p.id=w.last_plan_id AND p.platform='facebook'
    LEFT JOIN ad_scheduler_deliveries d ON d.plan_id=p.id AND d.platform='facebook'
    WHERE w.id=1`;
  if (inspect) {
    const result = await pool.query(query);
    console.log(JSON.stringify(result.rows[0] ?? null));
  } else {
    await new DeliveryRecords(pool).transaction(async db => {
      const lock = await db.query("SELECT pg_try_advisory_xact_lock(hashtext('lyribop-facebook-hosted-worker-v1')) AS locked");
      if (!lock.rows[0]?.locked) throw Error('Facebook worker is busy.');
      const worker = (await db.query(query + ' FOR UPDATE OF w')).rows[0];
      if (worker?.enabled !== false || worker.last_outcome !== 'needs_review' ||
          worker.last_plan_id !== planId) throw Error('The stopped worker must point to the reviewed plan.');
      const result = await db.query(`UPDATE ad_scheduler_deliveries SET state='closed_unverified',updated_at=now()
        WHERE plan_id=$1 AND platform='facebook' AND state='needs_review' AND scheduled_at < now()
          AND permalink IS NULL RETURNING plan_id`, [planId]);
      if (result.rowCount !== 1) throw Error('Expected one unresolved past Facebook delivery with no verified link.');
      await db.query("UPDATE ad_scheduler_facebook_worker SET last_outcome='idle' WHERE id=1");
    });
    console.log('Closed without verified publication. Original Facebook delivery claim retained.');
  }
} finally {
  await pool.end();
}
