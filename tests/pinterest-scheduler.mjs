import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { SCHEMA } from '../lib/ad-scheduler.mjs';
import { DELIVERY_SCHEMA, deliverySnapshotHash } from '../lib/ad-delivery-records.mjs';
import { PINTEREST_APPROVAL_SCHEMA, PinterestApprovals } from '../lib/pinterest-scheduler-approvals.mjs';
import { readPinterestReview } from '../lib/pinterest-scheduler-review.mjs';
import { PinterestHostedWorker, WORKER_SCHEMA } from '../lib/pinterest-hosted-worker.mjs';
import { dispatchScheduledPinterest } from '../lib/pinterest-scheduler-dispatch.mjs';
import { SchedulerControls } from '../lib/scheduler-controls.mjs';
import { scheduledDeliveryReport } from '../lib/scheduled-delivery-report.mjs';

test('approved Pinterest plan starts off, sends once across workers, and reports its Pin', {
  skip: !process.env.SCHEDULER_TEST_DATABASE_URL
}, async () => {
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({
    connectionString: process.env.SCHEDULER_TEST_DATABASE_URL,
    options: '-c search_path=lyribop_pinterest_scheduler'
  });
  const env = {
    DATABASE_URL: process.env.SCHEDULER_TEST_DATABASE_URL,
    AD_SCHEDULER_ENABLED: 'true',
    AD_SCHEDULER_PINTEREST_WORKER_ENABLED: 'true',
    AD_SCHEDULER_PINTEREST_CONNECTIONS_ENABLED: 'true',
    AD_SCHEDULER_PINTEREST_PIN_REVIEW_ENABLED: 'true'
  };
  let now = new Date('2026-11-12T19:59:30Z');
  const clock = () => now;
  const scheduled = '2026-11-12T20:00:00.000Z';
  const id = '18be8c8a-73da-4187-91c1-b5aa0d62bdeb';
  const image = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
  const snapshot = {
    platform: 'pinterest', name: 'Test Pin', caption: 'Caption', pin_title: 'Title',
    destination: 'https://personal-song-maker-v5-test.onrender.com/',
    pinterest_board: { account: 'lyribop', id: '123', name: 'Test Board' },
    image_sha256: createHash('sha256').update(image).digest('hex')
  };
  let sends = 0;
  const dispatch = approval => dispatchScheduledPinterest({
    pool, approval, env,
    prepare: async () => ({
      create: async () => { sends++; return '456'; },
      verify: async () => 'https://www.pinterest.com/pin/456/'
    }),
    clock
  });
  try {
    await pool.query('CREATE SCHEMA lyribop_pinterest_scheduler');
    for (const schema of [SCHEMA, DELIVERY_SCHEMA, PINTEREST_APPROVAL_SCHEMA, WORKER_SCHEMA]) {
      await pool.query(schema);
    }
    await pool.query('INSERT INTO ad_scheduler_media(sha256,image) VALUES($1,$2)', [snapshot.image_sha256, image]);
    await pool.query(`INSERT INTO ad_scheduler_plans(id,platform,scheduled_at,local_day,local_time,snapshot,created_at)
      VALUES($1,'pinterest',$2,'2026-11-12','15:00',$3,$4)`, [id, scheduled, snapshot, now]);
    const worker = new PinterestHostedWorker(pool, { env, clock, dispatch });
    assert.equal((await worker.runOnce()).outcome, 'disabled');
    assert.equal((await readPinterestReview(pool, now)).items[0].can_approve, true);
    const approvals = new PinterestApprovals(pool, { clock });
    await approvals.approveBatch({confirm:true,posts:[{plan_id:id,snapshot_sha256:deliverySnapshotHash(snapshot),scheduled_at:scheduled}]});
    const controls = new SchedulerControls(pool, { env, clock, checkConnection: async () => {} });
    const review = await controls.inspect('pinterest');
    assert.equal(review.can_start, true);
    await controls.change({platform:'pinterest',enabled:true,confirm:true,queue_sha256:review.queue_sha256});
    assert.equal((await worker.runOnce()).outcome, 'waiting');
    now = new Date(scheduled);
    const second = new PinterestHostedWorker(pool, { env, clock, dispatch });
    const results = await Promise.all([worker.runOnce(), second.runOnce()]);
    assert.equal(results.filter(result => result.outcome === 'verified').length, 1);
    assert.equal(sends, 1);
    await worker.runOnce();
    assert.equal(sends, 1);
    assert.equal((await scheduledDeliveryReport(pool))[0].permalink, 'https://www.pinterest.com/pin/456/');
    await controls.change({platform:'pinterest',enabled:false,confirm:true});
    assert.equal((await second.runOnce()).outcome, 'disabled');
  } finally {
    await pool.end();
  }
});
