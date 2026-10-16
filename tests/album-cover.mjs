import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { albumCoverTemplates, getAlbumCoverTemplate, validateAlbumCover, renderAlbumCover } from '../lib/album-cover.mjs';
assert.equal(getAlbumCoverTemplate('birthday').background, 'birthday-background.png');
assert(renderAlbumCover({ template: 'birthday', title: 'The King of Saturday Night', names: 'Danny', message: '' }, 'YWJj').includes('>Danny</text>'));
assert.equal(getAlbumCoverTemplate('wedding').background, 'wedding-background.png');
assert(renderAlbumCover({ template: 'wedding', title: 'Our Wedding Song', names: 'Alex & Jamie', message: 'Forever together' }, 'YWJj').includes('Alex &amp; Jamie'));
assert.equal(getAlbumCoverTemplate('retirement').background, 'retirement-background.png');
assert(renderAlbumCover({ template: 'retirement', title: 'A New Beginning', names: 'Alex', message: 'The adventure starts here' }, 'YWJj').includes('>A New Beginning</text>'));
assert.equal(getAlbumCoverTemplate('graduation').background, 'graduation-background.png');
assert(renderAlbumCover({ template: 'graduation', title: 'Congratulations Graduate', names: 'Alex', message: '' }, 'YWJj').includes('>Alex</text>'));
assert.equal(getAlbumCoverTemplate('mothers-day').background, 'mothers-day-background.png');
assert(renderAlbumCover({ template: 'mothers-day', title: "Happy Mother's Day", names: 'Mom', message: 'With love' }, 'YWJj').includes('Happy Mother&apos;s Day'));
assert.equal(getAlbumCoverTemplate('fathers-day').background, 'fathers-day-background.png');
assert(renderAlbumCover({ template: 'fathers-day', title: "Happy Father's Day", names: 'Dad', message: 'With love' }, 'YWJj').includes('Happy Father&apos;s Day'));
assert.equal(getAlbumCoverTemplate('christmas').background, 'christmas-background.png');
assert(renderAlbumCover({ template: 'christmas', title: 'Merry Christmas', names: 'The Smith Family', message: 'With love' }, 'YWJj').includes('>Merry Christmas</text>'));
assert.equal(getAlbumCoverTemplate('valentines-day').background, 'valentines-day-background.png');
assert(renderAlbumCover({ template: 'valentines-day', title: "Happy Valentine's Day", names: 'Alex & Jamie', message: 'With love' }, 'YWJj').includes('Valentine&apos;s'));
assert.equal(getAlbumCoverTemplate('congratulations').background, 'congratulations-background.png');
assert(renderAlbumCover({ template: 'congratulations', title: 'Congratulations', names: 'Alex', message: 'So proud of you' }, 'YWJj').includes('>Congratulations</text>'));
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
