import pg from 'pg';
import { DELIVERY_SCHEMA, validateDeliveryInstallation } from '../lib/ad-delivery-records.mjs';
import { PINTEREST_APPROVAL_SCHEMA } from '../lib/pinterest-scheduler-approvals.mjs';
import { WORKER_SCHEMA } from '../lib/pinterest-hosted-worker.mjs';

if (process.argv.length !== 3 || process.argv[2] !== '--install-with-posting-off') {
  throw new Error('Use the explicitly approved --install-with-posting-off setup command.');
}
validateDeliveryInstallation(process.env);
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query(DELIVERY_SCHEMA);
    await db.query(`ALTER TABLE ad_scheduler_deliveries
      DROP CONSTRAINT IF EXISTS ad_scheduler_deliveries_platform_check,
      ADD CONSTRAINT ad_scheduler_deliveries_platform_check
      CHECK (platform IN ('facebook','instagram','pinterest'))`);
    await db.query(PINTEREST_APPROVAL_SCHEMA);
    await db.query(WORKER_SCHEMA);
    await db.query('UPDATE ad_scheduler_pinterest_worker SET enabled=FALSE WHERE id=1');
    await db.query('COMMIT');
    console.log('Pinterest scheduler storage installed. Automatic Pinterest posting is off.');
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
  }
} finally {
  await pool.end();
}
