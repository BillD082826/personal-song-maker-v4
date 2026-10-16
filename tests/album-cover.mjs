import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { albumCoverTemplates, getAlbumCoverTemplate, validateAlbumCover, renderAlbumCover } from '../lib/album-cover.mjs';
assert.equal(getAlbumCoverTemplate('birthday').background, 'birthday-background.png');
assert(renderAlbumCover({ template: 'birthday', title: 'The King of Saturday Night', names: 'Danny', message: '' }, 'YWJj').includes('>Danny</text>'));
const other = { template: 'other', title: 'Your Personal Song', names: 'Alex & Jamie', message: 'Made just for you' };
assert.equal(getAlbumCoverTemplate('other').background, 'other-background.png');
for (const description of ['Birthday', 'Anniversary', 'Wedding', 'An entirely different story']) {
  assert.deepEqual(validateAlbumCover({ ...other, description }), other);
  assert.equal(renderAlbumCover({ ...other, description }, 'YWJj'), renderAlbumCover(other, 'YWJj'));
}
for (const id of ['../other', 'constructor', 'missing', undefined]) assert.throws(() => getAlbumCoverTemplate(id));
assert.throws(() => validateAlbumCover({ ...other, names: '' }));
assert.throws(() => validateAlbumCover({ ...other, title: 'X'.repeat(41) }));
assert.throws(() => validateAlbumCover({ ...other, message: 'X'.repeat(91) }));
assert(renderAlbumCover({ ...other, names: '<script>&' }, 'YWJj').includes('&lt;script&gt;&amp;'));
assert(renderAlbumCover(other, 'YWJj').includes('>Your Personal</text>'));
assert(renderAlbumCover({ ...other, template: 'anniversary', title: 'Happy Anniversary' }, 'YWJj').includes('>Anniversary</text>'));
for (const template of albumCoverTemplates) {
  const bytes = await readFile(new URL(`../assets/album-covers/${template.background}`, import.meta.url));
  assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
}
console.log('PASS: fixed Other background regardless of description, all templates/assets, limits, escaped wording and unknown/path-like ID rejection.');
