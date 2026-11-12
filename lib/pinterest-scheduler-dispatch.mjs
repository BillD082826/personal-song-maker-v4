import { DeliveryRecords, validateDelivery } from './ad-delivery-records.mjs';
import { prepareScheduledPinterestDelivery } from './pinterest-scheduled-delivery.mjs';

class PinterestDeliveryRecords extends DeliveryRecords {
  async checkSavedApproval(db, planId, hash, scheduledAt, destination) {
    const result = await db.query(
      'SELECT * FROM ad_scheduler_pinterest_approvals WHERE plan_id=$1 FOR SHARE', [planId]
    );
    const approval = result.rows[0];
    if (approval?.status !== 'approved' || approval.snapshot_sha256 !== hash ||
        approval.destination_id !== destination || +new Date(approval.scheduled_at) !== +new Date(scheduledAt)) {
      throw new Error('Pinterest approval changed.');
    }
  }

  async checkWorker(db) {
    const result = await db.query('SELECT enabled FROM ad_scheduler_pinterest_worker WHERE id=1 FOR SHARE');
    if (result.rows[0]?.enabled !== true) throw new Error('Pinterest worker is off.');
  }
}

export async function dispatchScheduledPinterest({
  pool, approval, publicBase, env = process.env,
  clock = () => new Date(), records = new PinterestDeliveryRecords(pool, { clock }), prepare = prepareScheduledPinterestDelivery
}) {
  if (approval?.approved !== true || approval.platform !== 'pinterest') throw new Error('Pinterest approval required.');
  const plan = (await pool.query('SELECT * FROM ad_scheduler_plans WHERE id=$1', [approval.plan_id])).rows[0];
  if (plan?.platform !== 'pinterest') throw new Error('Pinterest plan unavailable.');
  const artwork = (await pool.query(
    'SELECT image FROM ad_scheduler_media WHERE sha256=$1', [plan.snapshot.image_sha256]
  )).rows[0]?.image;
  if (validateDelivery(plan, artwork, approval.destination) !== approval.snapshot_sha256 ||
      +new Date(plan.scheduled_at) !== +new Date(approval.scheduled_at)) {
    throw new Error('Approved Pinterest plan changed.');
  }

  const delivery = await prepare({ pool, snapshot: plan.snapshot, artwork, env, publicBase });
  const guard = { requireSavedApproval: true, requireWorkerEnabled: true };
  const claim = await records.reserve({
    ...guard, planId: plan.id, destination: approval.destination, approved: true,
    expectedHash: approval.snapshot_sha256, expectedScheduledAt: approval.scheduled_at
  });
  let state = 'reserved';
  async function advance(to, details = {}) {
    await records.advance({ ...guard, ...details, planId: plan.id, claimId: claim.claim_id, from: state, to });
    state = to;
  }

  try {
    await advance('publishing');
    const remoteId = await delivery.create();
    await advance('verifying', { remoteId });
    const permalink = await delivery.verify(remoteId);
    await advance('verified', { permalink });
    return { plan_id: plan.id, status: 'verified', permalink };
  } catch {
    await advance('needs_review').catch(() => {});
    throw new Error('Pinterest delivery requires review.');
  }
}
