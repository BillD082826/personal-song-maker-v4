import {isCollection,validateCollection,readCollectionArtwork} from './story-collections.mjs';
import { createHash } from 'node:crypto';
import { TrialPinGraph } from './pinterest-test-pin.mjs';
import { PinterestStore, pinterestConfiguration } from './pinterest-connection.mjs';

const storefront = 'https://personal-song-maker-v5-test.onrender.com';
const customerStorefronts = new Set([storefront, 'https://lyribop.onrender.com']);
const accountId = '1138144274488601260';
const username = 'lyribop';
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const numericId = id => typeof id === 'string' && /^\d+$/.test(id);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

export function pinterestDeliverySpec(snapshot, artwork) {
  validateCollection(snapshot);
  const board = snapshot?.pinterest_board;
  const title = snapshot?.pin_title;
  const description = snapshot?.caption;
  let link;
  try {
    link = new URL(snapshot?.destination);
  } catch {
    throw new Error('Pinterest needs a valid destination link.');
  }
  if (snapshot.platform !== 'pinterest' || board?.account !== username ||
      !numericId(board.id) || typeof title !== 'string' || !title.trim() ||
      title.length > 100 || typeof description !== 'string' ||
      !description.trim() || description.length > 800 || !customerStorefronts.has(link.origin) ||
      link.username || link.password) {
    throw new Error('Review the Pinterest board, title, description, and storefront link.');
  }
  if (!Buffer.isBuffer(artwork) || artwork.length > 8 * 1024 * 1024 ||
      !artwork.subarray(0, 8).equals(pngSignature) ||
      hash(artwork) !== snapshot.image_sha256) {
    throw new Error('The saved Pinterest artwork could not be verified.');
  }
  return { account_id: accountId, username, board_id: board.id, title, description, link: link.href };
}

// The caller owns the durable claim and must record a returned Pin ID before verification.
export async function prepareScheduledPinterestDelivery({
  pool, snapshot, artwork, env = process.env, publicBase,
  store = new PinterestStore(pool), graphFactory = token => new TrialPinGraph(token)
}) {
  const spec = pinterestDeliverySpec(snapshot, artwork);
  const panels=isCollection(snapshot)?await readCollectionArtwork(pool,snapshot):null;
  if (env.AD_SCHEDULER_ENABLED !== 'true' ||
      env.AD_SCHEDULER_PINTEREST_CONNECTIONS_ENABLED !== 'true' ||
      env.AD_SCHEDULER_PINTEREST_PIN_REVIEW_ENABLED !== 'true') {
    throw new Error('Pinterest scheduling is unavailable.');
  }
  const config = pinterestConfiguration(env, publicBase, 'production');
  if (config.origin !== storefront) throw new Error('Pinterest storefront needs review.');
  const token = await store.boardAuthorization(config, { readOnly: true });
  const graph = graphFactory(token);
  await graph.preflight(spec);

  return {
    async create() {
      const result = panels?await graph.call('/pins',{board_id:spec.board_id,title:spec.title,description:spec.description,link:spec.link,media_source:{source_type:'multiple_image_base64',items:panels.map((b,i)=>({content_type:'image/png',data:b.toString('base64'),title:`${spec.title.slice(0,83)} — panel ${i+1} of 4`,description:`Panel ${i+1} of 4`,link:spec.link})),index:0}}):await graph.create(spec, artwork);
      if (!numericId(result?.id)) throw new Error('Pinterest did not return a Pin ID.');
      return result.id;
    },
    async verify(pinId) {
      if (!numericId(pinId)) throw new Error('Pinterest Pin ID is invalid.');
      const pin = await graph.verify(pinId);
      if (pin?.id !== pinId || pin.board_id !== spec.board_id ||
          pin.title !== spec.title || pin.description !== spec.description ||
          pin.link !== spec.link || pin.is_owner !== true) {
        throw new Error('Pinterest Pin details did not match the saved plan.');
      }
      if(panels&&(pin.media?.media_type!=='multiple_images'||!Array.isArray(pin.media.items)||pin.media.items.length!==4||pin.media.items.some((item,i)=>item.item_type!=='image'||item.description!==`Panel ${i+1} of 4`||item.link!==spec.link)))throw Error('Pinterest story panels did not match the saved collection.');
      return 'https://www.pinterest.com/pin/' + pinId + '/';
    }
  };
}
