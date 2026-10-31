import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateCoverPhoto,coverForOrder} from '../lib/cover-photo.mjs';
import {renderAlbumCover} from '../lib/album-cover.mjs';
const png=await readFile(new URL('../assets/album-covers/other-background.png',import.meta.url));
// Small real test PNG, no customer data.
const photo='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6WQAAAAASUVORK5CYII=';
assert.equal(validateCoverPhoto(photo),photo);assert.equal(validateCoverPhoto(null),null);
for(const bad of ['https://example.com/a.png','data:image/svg+xml;base64,PHN2Zz4=',{},photo+'!', 'data:image/png;base64,'+png.toString('base64')])assert.throws(()=>validateCoverPhoto(bad));
const order={person:'Jamie',song_title:'Our Memories',cover_photo:photo};
const cover=coverForOrder(order);assert.equal(cover.photo,photo);assert.equal(cover.title,'Our Memories');
const svg=renderAlbumCover(cover,png.toString('base64'));assert(svg.includes('preserveAspectRatio="xMidYMid meet"'));assert(svg.includes(photo));
assert(!svg.includes(png.toString('base64')), 'A photo cover must not include library artwork');
assert.equal((svg.match(/<image /g)||[]).length,1);
assert.equal(renderAlbumCover(cover),svg,'Photo covers work without a library background');
assert.equal(coverForOrder({...order,album_cover:{...cover,photo_data:''}}).photo,'');
assert.equal(coverForOrder({...order,album_cover:{...cover,photo_data:null}}).photo,photo);
assert(!renderAlbumCover({...cover,photo:null},png.toString('base64')).includes(photo));
console.log('PASS: raster validation/limits, private photo inheritance/removal, actual-title default and aspect-preserving photo rendering.');
