const fs = require('fs'), vm = require('vm'), assert = require('assert'), crypto = require('crypto');
const source = fs.readFileSync(require('path').join(__dirname, '..', 'server.mjs'), 'utf8');
let state, sends, captures, failure, captureStatus, amount, order, handler, retryHandler;
function reset() {
  state = null; sends = 0; captures = 0; failure = ''; captureStatus = 'COMPLETED'; amount = '10.00';
  order = { id: 'test', customer_name: '<b>Alex</b>', email: 'test@example.com', song_title: 'Title\r\nInjected', paypal_order_id: 'pp', price_amount: '10.00', status: 'New', paid_at: null, paypal_capture_id: null };
}
const context = {
  crypto, AbortSignal, process: { env: { RESEND_API_KEY: 'fake' } },
  console: { log() {}, error() {} }, logError() {}, paymentLimiter() {}, requireAdmin() {},
  PAYPAL_BASE_URL: 'https://paypal.test', getPayPalAccessToken: async () => 'fake',
  app: { post: (path, _limiter, fn) => {
    if (path.includes("retry-confirmation")) retryHandler = fn;
    else handler = fn;
  } },
  pool: { query: async (sql, args) => {
    if (sql.startsWith('SELECT id, status')) return { rowCount: 1, rows: [{ ...order }] };
    if (sql.includes('WITH paid AS')) {
      assert(sql.includes('paid_at IS NULL')); assert(sql.includes('ON CONFLICT (order_id) DO NOTHING'));
      if (!order.paid_at) { order.paid_at = 'now'; order.paypal_capture_id = args[0]; order.status = 'Ready'; state = 'pending'; }
      return { rows: [] };
    }
    if (sql.includes("SET state = 'pending'")) {
      if (state === 'failed') state = 'pending';
      return { rows: [] };
    }
    if (sql.startsWith('SELECT state')) return { rowCount: state ? 1 : 0, rows: state ? [{ state }] : [] };
    if (sql.includes('SELECT id, customer_name')) return { rows: [{ ...order }] };
    if (sql.includes('FROM store_settings')) return { rows: [
      { setting_key: 'order_confirmation_subject', setting_value: 'Confirmed {song_title}' },
      { setting_key: 'order_confirmation_message', setting_value: 'Hi {customer_name}\nOrder {order_number}. {turnaround_message}' },
      { setting_key: 'turnaround_message', setting_value: '24 hours' }
    ] };
    if (sql.includes("SET state = 'sending'")) {
      if (state !== 'pending') return { rowCount: 0, rows: [] };
      state = 'sending'; return { rowCount: 1, rows: [{ order_id: order.id }] };
    }
    if (sql.includes("SET state = 'sent'")) { state = 'sent'; return { rows: [] }; }
    if (sql.includes('SET state = $2')) { if (state === 'sending') state = args[1]; return { rows: [] }; }
    throw Error('Unexpected query: ' + sql);
  } },
  fetch: async (url, options) => {
    if (url.includes('paypal.test')) {
      captures++;
      return { ok: true, json: async () => ({ status: 'COMPLETED', purchase_units: [{ payments: { captures: [{ id: 'cap', status: captureStatus, amount: { value: amount, currency_code: 'USD' } }] } }] }) };
    }
    sends++;
    assert.equal(state, 'sending');
    const email = JSON.parse(options.body);
    assert.equal(email.subject, 'Confirmed Title Injected');
    assert(email.html.includes('&lt;b&gt;Alex&lt;/b&gt;')); assert(!email.html.includes('<b>Alex'));
    assert(email.html.includes('<br>')); assert(email.text.includes('24 hours'));
    assert(options.headers['Idempotency-Key'].startsWith('confirmation-'));
    if (failure === 'timeout') throw Error('timeout');
    return { ok: !failure, status: failure ? Number(failure) : 200, json: async () => ({ id: 'mail-test' }) };
  }
};
vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('function escapeHtml(value)'), source.indexOf('function createMarketingUnsubscribeToken')), context);
vm.runInContext(source.slice(source.indexOf('function renderCustomerEmailTemplate('), source.indexOf('async function sendDeliveryEmail(')), context);
vm.runInContext(source.slice(source.indexOf('app.post("/api/paypal/capture-order/'), source.indexOf('app.post("/api/song"')), context);
vm.runInContext(source.slice(source.indexOf('app.post("/api/admin/orders/:id/retry-confirmation"'), source.indexOf('app.post("/api/admin/orders/:id/send-email"')), context);
async function retry() {
  const response = { code: 200, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
  await retryHandler({ params: { id: 'test' } }, response);
  return response;
}
async function checkout() {
  const response = { code: 200, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
  await handler({ params: { paypalOrderId: 'pp' }, body: { localOrderId: 'test' } }, response);
  return response;
}
(async () => {
  reset(); let response = await checkout(); assert.equal(response.code, 200); assert.equal(state, 'sent'); assert.equal(sends, 1);
  order.status = 'Delivered'; await checkout(); assert.equal(sends, 1); assert.equal(captures, 1); assert.equal(order.status, 'Delivered');
  reset(); await Promise.all([checkout(), checkout()]); assert.equal(sends, 1); assert.equal(state, 'sent');
  for (const problem of ['400', '500', 'timeout']) {
    reset(); failure = problem; response = await checkout(); assert.equal(response.code, 200); assert(response.data.ok); assert(order.paid_at);
    assert.equal(state, problem === '400' ? 'failed' : 'uncertain'); await checkout(); assert.equal(sends, 1);
  }
  reset(); captureStatus = 'PENDING'; response = await checkout(); assert.equal(response.code, 400); assert.equal(sends, 0); assert.equal(state, null);
  reset(); amount = '9.00'; response = await checkout(); assert.equal(response.code, 400); assert.equal(sends, 0);
  reset(); order.paid_at = 'historical'; order.status = 'Delivered'; response = await checkout(); assert.equal(response.code, 200); assert.equal(sends, 0); assert.equal(captures, 0);
  reset(); state = 'sending'; order.paid_at = 'now'; response = await checkout(); assert.equal(sends, 0);
  for (const initial of ['pending', 'failed', 'sent', 'sending', 'uncertain', null]) {
    reset(); state = initial; order.paid_at = 'now'; order.paypal_capture_id = 'cap';
    response = await retry();
    assert.equal(sends, ['pending', 'failed'].includes(initial) ? 1 : 0);
    assert.equal(response.code, ['pending', 'failed', 'sent'].includes(initial) ? 200 : 409);
    assert.equal(captures, 0);
  }
  reset(); state = 'failed'; order.paid_at = 'now'; order.paypal_capture_id = 'cap';
  await Promise.all([retry(), retry()]); assert.equal(sends, 1); assert.equal(state, 'sent');
  for (const problem of ['400', '409', '500', 'timeout']) {
    reset(); state = 'failed'; order.paid_at = 'now'; order.paypal_capture_id = 'cap'; failure = problem;
    response = await retry(); assert.equal(response.code, 502); assert(!response.data.ok);
    assert.equal(state, problem === '400' ? 'failed' : 'uncertain');
    if (state === 'uncertain') { await retry(); assert.equal(sends, 1); }
  }
  reset(); state = 'pending'; order.paid_at = 'now'; order.paypal_capture_id = 'cap';
  delete context.process.env.RESEND_API_KEY;
  response = await retry(); assert.equal(response.code, 502); assert.equal(state, 'pending'); assert.equal(sends, 0);
  context.process.env.RESEND_API_KEY = 'fake';
  const pool = context.pool; context.pool = null;
  response = await retry(); assert.equal(response.code, 503); context.pool = pool;
  const admin = fs.readFileSync(require('path').join(__dirname, '..', 'public', 'admin.html'), 'utf8');
  const ui = { escapeHtml: value => String(value).replaceAll('"', '&quot;'), formatDate: value => value };
  vm.createContext(ui);
  vm.runInContext(admin.slice(admin.indexOf('function renderConfirmationEmailStatus('), admin.indexOf('async function retryConfirmationEmail(')), ui);
  for (const initial of ['pending', 'failed', 'sent', 'sending', 'uncertain', null, 'constructor']) {
    const output = ui.renderConfirmationEmailStatus({ id: 'test', confirmation_email_state: initial });
    assert.equal(output.includes('Retry Confirmation'), ['pending', 'failed'].includes(initial));
  }
  console.log('PASS: payment/capture and rendering checks; retry eligibility, concurrent retries, provider rejection/conflict/timeout, missing configuration, protected states, no extra captures, and Admin button visibility. All services mocked.');
})().catch(error => { console.error(error); process.exitCode = 1; });
