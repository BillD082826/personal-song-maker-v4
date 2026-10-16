const fs = require('fs'), vm = require('vm'), assert = require('assert');
const path = require('path');
const nodes = {};
const node = id => nodes[id] ||= { value: '', disabled: false, hidden: true, textContent: '', replaceChildren() {}, appendChild() {} };
let data;
const context = {
  document: { getElementById: node, createElement: () => ({}) },
  stubDialog: { dataset: {}, showModal() {} },
  fetch: async (_url, options) => { assert(!options, 'Opening editor must not write'); return { ok: true, json: async () => data }; }
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'album-cover-editor.js'), 'utf8'), context);
vm.runInContext('albumCoverDialog = stubDialog;', context);
(async () => {
  const defaults = { template: 'anniversary', title: 'The King of Saturday Night', names: 'Danny', message: '' };
  for (const [cover, expectedTitle] of [
    [null, defaults.title],
    [{ ...defaults, template: 'other', title: 'Your Personal Song' }, defaults.title],
    [{ ...defaults, title: 'Keep my custom wording' }, 'Keep my custom wording'],
    [{ ...defaults, title: 'Happy Anniversary' }, 'Happy Anniversary']
  ]) {
    data = { cover, defaults, templates: [] };
    await context.openAlbumCoverEditor({ dataset: { orderId: 'test' } });
    assert.equal(node('albumEditor-title').value, expectedTitle);
    assert.equal(node('albumEditor-names').value, 'Danny');
    assert(node('albumEditorSaveButton').disabled);
  }
  context.useAlbumCoverSongTitle();
  assert.equal(node('albumEditor-title').value, defaults.title);
  assert(node('albumEditorImage').hidden);
  assert(node('albumEditorSaveButton').disabled);
  console.log('PASS: actual title/name defaults, legacy generic draft, saved custom/anniversary preservation, explicit reset and no writes on open. Mocked editor DOM/API.');
})().catch(error => { console.error(error); process.exitCode = 1; });
