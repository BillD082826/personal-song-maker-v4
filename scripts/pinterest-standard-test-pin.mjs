import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pinterestConfiguration, PinterestStore } from '../lib/pinterest-connection.mjs';
import { TrialPinGraph, TrialPinStore } from '../lib/pinterest-test-pin.mjs';

const origin = 'https://personal-song-maker-v5-test.onrender.com';
const spec = {
  test_id: 'lyribop-pinterest-soundtrack-standard-v1',
  account_id: '1138144274488601260',
  username: 'lyribop',
  board_id: '1138144205771307778',
  title: 'Every Story Has a Soundtrack | Personalized Song Gift',
  description: 'Turn a favorite memory into a personalized song. Hear a free 30-second preview, then get the full song, MP3 download, printable lyrics, and a free album cover with every order.',
  link: origin + '/',
  image_sha256: 'e142d41a1d3a60768aa52755382422c58be1a162ea59449a5ed7de86cfe3253e'
};
const hash = value => createHash('sha256').update(value).digest('hex');
spec.content_sha256 = hash(JSON.stringify([spec.title, spec.description, spec.link, spec.board_id]));
const image = await readFile(new URL('../marketing/advertising-dashboard/assets/images/platform-variants/LyriBop-Every-Story-Has-a-Soundtrack-Pinterest-Complete-Offer-v1.png', import.meta.url));

async function checkBoard(graph) {
  await graph.preflight(spec);
  let bookmark;
  for (let page = 0; page < 10; page++) {
    const query = new URLSearchParams({ page_size: '100' });
    if (bookmark) query.set('bookmark', bookmark);
    const result = await graph.call('/boards/' + spec.board_id + '/pins?' + query);
    if (!Array.isArray(result.items)) throw new Error('Board inspection was incomplete.');
    if (result.items.some(pin => typeof pin.title === 'string' &&
        pin.title.toLowerCase().includes('every story has a soundtrack'))) {
      throw new Error('Matching Pin title already exists on the board. Review it before publishing.');
    }
    if (result.bookmark == null || result.bookmark === '') return;
    if (typeof result.bookmark !== 'string' || result.bookmark === bookmark) break;
    bookmark = result.bookmark;
  }
  throw new Error('Board inspection was incomplete.');
}

async function publish(graph, store) {
  if (!await store.reserve(spec)) throw new Error('This test already has a saved record.');
  let stage = 'creating';
  let pinId = null;
  try {
    await store.mark(spec.test_id, stage);
    const pin = await graph.create(spec, image);
    if (typeof pin.id !== 'string' || !/^\d+$/.test(pin.id)) throw new Error('Missing Pin ID.');
    pinId = pin.id;
    stage = 'verifying';
    await store.mark(spec.test_id, stage, pinId);
    const verified = await graph.verify(pinId);
    if (verified.id !== pinId || verified.board_id !== spec.board_id ||
        verified.title !== spec.title || verified.description !== spec.description ||
        verified.link !== spec.link || verified.is_owner !== true) {
      throw new Error('Pinterest Pin details did not match.');
    }
    await store.mark(spec.test_id, 'verified_standard', pinId);
    console.log(JSON.stringify({ status: 'verified_standard', pin_url: 'https://www.pinterest.com/pin/' + pinId + '/' }));
  } catch (error) {
    await store.mark(spec.test_id, 'needs_review_' + stage, pinId, error.diagnostic).catch(() => {});
    throw new Error('Pinterest test stopped during ' + stage + '. Review the saved record before any further attempt.');
  }
}

const [mode, ...extra] = process.argv.slice(2);
if (hash(image) !== spec.image_sha256) throw new Error('The reviewed artwork has changed.');
if (extra.length || !['--check', '--preflight', '--publish-approved-standard-pin'].includes(mode)) {
  throw new Error('Use --check or --preflight. Publishing requires approval for this exact Pin.');
}
if (mode === '--check') {
  console.log(JSON.stringify({ status: 'draft_validated', ...spec }));
} else {
  const env = process.env;
  if (env.AD_SCHEDULER_PINTEREST_CONNECTIONS_ENABLED !== 'true' ||
      env.AD_SCHEDULER_PINTEREST_PIN_REVIEW_ENABLED !== 'true' || !env.DATABASE_URL) {
    throw new Error('Production Pinterest review configuration is incomplete.');
  }
  const config = pinterestConfiguration(env, env.PUBLIC_BASE_URL || origin);
  if (config.origin !== origin) throw new Error('Unexpected storefront.');
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
  try {
    const token = await new PinterestStore(pool).boardAuthorization(config, { readOnly: true });
    const graph = new TrialPinGraph(token);
    await checkBoard(graph);
    if (mode === '--preflight') console.log('Production account and public board verified. No matching title found.');
    else await publish(graph, new TrialPinStore(pool));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
