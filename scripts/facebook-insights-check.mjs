import pg from 'pg';
import {MetaGraph, metaConfiguration, openToken} from '../lib/meta-connection.mjs';
import {verifiedFacebookTests} from '../lib/facebook-test-post.mjs';

const origin = 'https://personal-song-maker-v5-test.onrender.com';
const pageId = '1271936012676830';
const metric = 'post_media_view';
const api = 'https://graph.facebook.com/v26.0';
const env = process.env;
const pool = new pg.Pool({connectionString: env.DATABASE_URL});
let stage = 'configuration';
try {
  const config = metaConfiguration(env, env.PUBLIC_BASE_URL || origin);
  const reportingId = env.META_FACEBOOK_REPORTING_CONFIG_ID;
  if (!env.DATABASE_URL || config.origin !== origin || config.appId !== '1689275265898013' ||
      config.expectedBusinessId !== '1050270251226174' || config.expectedInstagramId !== '17841431950776323' ||
      reportingId !== '2031677487523375' || reportingId === config.configId) throw Error();
  stage = 'saved_authorization';
  const {rows: [row]} = await pool.query(
    `SELECT id, protected_token FROM ad_scheduler_meta_authorizations
     WHERE app_id=$1 AND config_id=$2 AND business_id=$3 AND status='pending_review'
       AND (token_expires_at IS NULL OR token_expires_at>now())
     ORDER BY created_at DESC LIMIT 1`,
    [config.appId, reportingId, config.expectedBusinessId]
  );
  if (!row) throw Error();
  const token = openToken(row.protected_token, config.key, `lyribop-meta-v1:${row.id}:${config.appId}:${reportingId}`);
  stage = 'page_access';
  const graph = new MetaGraph();
  const pageToken = await graph.verifyFacebookReporting(token, config.expectedInstagramId);
  const headers = {Authorization: 'Bearer '+pageToken};
  stage = 'verified_post';
  const [post] = await verifiedFacebookTests(pool);
  if (!post) throw Error();
  const identity = await graph.json(`${api}/${post.post_id}?fields=id,from`, {headers});
  if (identity.id !== post.post_id || identity.from?.id !== pageId) throw Error();
  stage = 'post_insights';
  const response = await graph.json(`${api}/${post.post_id}/insights?metric=${metric}&period=lifetime`, {headers});
  const item = response.data?.[0];
  const views = item?.values?.[0]?.value;
  if (response.data?.length !== 1 || item.name !== metric || item.period !== 'lifetime' ||
      item.values?.length !== 1 || !Number.isSafeInteger(views) || views < 0) throw Error();
  console.log(JSON.stringify({status: 'verified', post: post.name, lifetime_views: views}));
} catch {
  console.error(JSON.stringify({status: 'unverified', stage}));
  process.exitCode = 1;
} finally {
  await pool.end();
}
