const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync(require('node:path').join(__dirname, '../public/admin.html'), 'utf8');
const fn = html.slice(html.indexOf('async function loadBackupStatus()'), html.indexOf('async function saveStoreSettings()'));
(async () => {
  for (const [status, badge] of [['success', 'SUCCESSFUL'], ['success_retention_warning', 'BACKUP SAVED — CLEANUP WARNING'], ['failed', 'CHECK BACKUP'], ['unknown', 'CHECK BACKUP']]) {
    const elements = {};
    const context = vm.createContext({ console, document: { getElementById: id => elements[id] ||= { style: {} } }, fetch: async () => ({ ok: true, json: async () => ({lastBackup: {backup_status: status, created_at: '2026-10-25T06:06:13Z'}, automaticRetention: true}) }) });
    await vm.runInContext(fn+';loadBackupStatus()', context);
    assert.equal(elements.backupStatusBadge.textContent, badge);
    if (status === 'success_retention_warning') assert.match(elements.backupStatusMessage.textContent, /backups were validated.*cleanup failed/);
    console.log(status+': PASS');
  }
})();
