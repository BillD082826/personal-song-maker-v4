import {PinterestVideoUploads} from './pinterest-video-uploads.mjs';
import {isVideo} from './scheduled-videos.mjs';
import { DeliveryRecords, validateDelivery } from './ad-delivery-records.mjs';
import { prepareScheduledPinterestDelivery } from './pinterest-scheduled-delivery.mjs';

export class PinterestDeliveryRecords extends DeliveryRecords {
  async rememberVideo(planId,claimId,id){if(!/^\d+$/.test(id||''))throw Error('Pinterest media ID invalid.');const r=await this.pool.query("UPDATE ad_scheduler_deliveries SET container_id=$3,updated_at=$4 WHERE plan_id=$1 AND claim_id=$2 AND platform='pinterest' AND state='publishing' AND container_id IS NULL RETURNING plan_id",[planId,claimId,id,this.clock().toISOString()]);if(r.rowCount!==1)throw Error('Pinterest media record needs review.');}

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
  clock = () => new Date(), records = new PinterestDeliveryRecords(pool, { clock }),videoUploads=new PinterestVideoUploads(pool,{env,clock}), prepare = prepareScheduledPinterestDelivery
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

  const preparedMediaId=isVideo(plan.snapshot)?await videoUploads.ready(plan,approval.snapshot_sha256):null;
  const delivery = await prepare({ pool, snapshot: plan.snapshot, artwork, env, publicBase,preparedMediaId });
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
    const remoteId = await delivery.create({rememberMedia:id=>records.rememberVideo(plan.id,claim.claim_id,id),checkPublishing:()=>records.checkPublishing({planId:plan.id,claimId:claim.claim_id,requireWorkerEnabled:true})});
    await advance('verifying', { remoteId });
    const permalink = await delivery.verify(remoteId);
    await advance('verified', { permalink });
    return { plan_id: plan.id, status: 'verified', permalink };
  } catch {
    await advance('needs_review').catch(() => {});
    throw new Error('Pinterest delivery requires review.');
  }
}
