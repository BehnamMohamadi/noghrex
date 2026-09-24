import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { startIsolatedMongo } from './helpers/mongo.js';
import { readFile } from 'node:fs/promises';
import { runCollection } from './helpers/postman-runner.js';
let mongo, server, base, user, admin, other, token, adminToken, otherToken, models;
let product, product2, address, shipping;
async function api(path, method = 'GET', body, auth = token) {
  const response = await fetch(base + path, { method, headers: { ...(auth ? { Authorization: 'Bearer ' + auth } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json(), headers: response.headers };
}
async function ok(path, method, body, auth) {
  const response = await api(path, method, body, auth); assert.ok(response.status < 300, path + ': ' + JSON.stringify(response.body)); return response.body.data;
}
let sequence = 0;
const key = () => 'phase1-test-' + (++sequence);
before(async () => {
  mongo = await startIsolatedMongo();
  process.env.NODE_ENV = 'test'; process.env.MONGODB_URI = mongo.uri; process.env.JWT_SECRET = 'isolated-phase1-test-only-long-jwt-secret'; process.env.PAYMENT_GATEWAY = 'mock';
  const { app } = await import('../app.js');
  await mongoose.connect(mongo.uri); models = mongoose.models;
  for (const model of Object.values(models)) await model.init();
  const { createWalletForUser } = await import('../services/wallet/wallet-service.js');
  const { signAuthToken } = await import('../utils/auth-token.js');
  for (const [phoneNumber, role] of [['09121110001', 'admin'], ['09121110002', 'user'], ['09121110003', 'user']]) {
    const created = await models.User.create({ phoneNumber, role, firstname: 'Test', lastname: 'User', password: 'phase1-testing-password' });
    await createWalletForUser(created._id);
    if (role === 'admin') { admin = created; adminToken = signAuthToken(created); }
    else if (!user) { user = created; token = signAuthToken(created); } else { other = created; otherToken = signAuthToken(created); }
  }
  await models.PlatformBalance.create({ key: 'main' });
  await models.OnlineInventory.create({ key: 'x', availableX: 100000 });
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve)); base = 'http://127.0.0.1:' + server.address().port;
});
after(async () => { if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); await mongo?.stop(); });

test('authentication hides password and protects admin resources; malformed IDs return 400', async () => {
  const login = await api('/api/account/login', 'POST', { phoneNumber: user.phoneNumber, password: 'phase1-testing-password' }, null);
  assert.equal(login.status, 200); assert.equal(login.body.data.user.password, undefined); assert.match(login.headers.get('set-cookie'), /HttpOnly/i);
  assert.equal((await api('/api/admin/buyback-budget')).status, 403);
  assert.equal((await api('/api/orders/not-an-id')).status, 400);
  const response = await fetch(base + '/api/account', { method: 'PATCH', headers: { Cookie: 'noghrex_auth=' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ firstname: 'CSRF' }) });
  assert.equal(response.status, 403);
});
test('signup OTP is single use and user response never exposes hash', async () => {
  let code; const original = console.info;
  console.info = text => { const match = String(text).match(/\[DEV OTP\].*: (\d{6})/); if (match) code = match[1]; };
  try { await ok('/api/account/signup/otp', 'POST', { phoneNumber: '09121110004' }, null); } finally { console.info = original; }
  assert.match(code, /^\d{6}$/);
  const verified = await ok('/api/account/signup/otp/verify', 'POST', { phoneNumber: '09121110004', code }, null);
  assert.equal((await api('/api/account/signup/otp/verify', 'POST', { phoneNumber: '09121110004', code }, null)).status, 400);
  const payload = { signupToken: verified.signupToken, firstname: 'New', lastname: 'User', password: 'new-user-testing-password' };
  const data = await ok('/api/account/signup', 'POST', payload, null); assert.equal(data.user.password, undefined);
  assert.equal((await api('/api/account/signup', 'POST', payload, null)).status, 400);
});
test('gateway wallet deposit is verified once; initiation and callback are idempotent', async () => {
  const request = { method: 'gateway', amount: 5000000, idempotencyKey: key() };
  const { deposit } = await ok('/api/wallet/deposits', 'POST', request);
  assert.equal((await ok('/api/wallet/deposits', 'POST', request)).deposit._id, deposit._id);
  const { payment } = await ok('/api/payments', 'POST', { purpose: 'wallet_deposit', entityId: deposit._id });
  assert.equal((await ok('/api/payments', 'POST', { purpose: 'wallet_deposit', entityId: deposit._id })).payment._id, payment._id);
  const results = await Promise.all([api('/api/payments/' + payment._id + '/mock/verify', 'POST', { outcome: 'success' }), api('/api/payments/' + payment._id + '/mock/verify', 'POST', { outcome: 'success' })]);
  results.forEach(r => assert.equal(r.status, 200, JSON.stringify(r.body)));
  assert.equal((await models.Wallet.findOne({ userId: user._id })).toman.available, 5000000);
  assert.equal((await models.PlatformBalance.findOne()).buybackAvailableToman, 0);
  assert.equal((await api('/api/payments/' + payment._id, 'GET', undefined, otherToken)).status, 404);
});
test('catalog, stock, address, shipping and basket work through HTTP', async () => {
  await ok('/api/admin/silver/physical/price', 'PUT', { pricePerGram: 100000 }, adminToken);
  product = (await ok('/api/admin/silver/physical/products', 'POST', { name: 'Silver bar', slug: 'test-bar', sku: 'TEST-BAR', weightGrams: 1, pricingMode: 'custom', wageValue: 10, profitPercent: 5, taxPercent: 9 }, adminToken)).product;
  product2 = (await ok('/api/admin/silver/physical/products', 'POST', { name: 'Silver ring', slug: 'test-ring', sku: 'TEST-RING', weightGrams: 1 }, adminToken)).product;
  for (const p of [product, product2]) await ok('/api/admin/silver/physical/products/' + p._id + '/inventory/adjustments', 'POST', { type: 'increase', quantity: 20, reason: 'test stock', idempotencyKey: key() }, adminToken);
  const updated = (await ok('/api/admin/silver/physical/products/' + product._id, 'PATCH', { name: 'Updated bar' }, adminToken)).product;
  assert.equal(updated.wageValue, 10, 'PATCH must not reset pricing defaults');
  address = (await ok('/api/account/addresses', 'POST', { recipientName: 'Test', phoneNumber: user.phoneNumber, province: 'تهران', city: 'تهران', addressLine: 'خیابان تست', postalCode: '1234567890', isDefault: true })).address;
  shipping = (await ok('/api/admin/shipping-methods', 'POST', { name: 'Test post', cost: 10000 }, adminToken)).method;
  assert.ok(address?._id); assert.ok(shipping?._id);
  await ok('/api/silver/physical/cart/items', 'POST', { productId: product._id, quantity: 1 });
  const cart = (await ok('/api/silver/physical/cart')).cart;
  assert.equal(cart.items.length, 1); assert.ok(cart.items[0].unitPrice > 100000);
});
async function newOrder(paymentMethod = 'wallet', products = [product]) {
  await ok('/api/silver/physical/cart', 'DELETE');
  for (const p of products) await ok('/api/silver/physical/cart/items', 'POST', { productId: p._id, quantity: 1 });
  const checkout = (await ok('/api/checkout', 'POST', { addressId: address._id, shippingMethodId: shipping._id })).checkout;
  const order = (await ok('/api/orders', 'POST', { checkoutSessionId: checkout._id, paymentMethod })).order;
  return { order, checkout };
}
test('order snapshots, concurrent wallet payment and cart version protection', async () => {
  const { order, checkout } = await newOrder();
  assert.equal((await ok('/api/orders', 'POST', { checkoutSessionId: checkout._id, paymentMethod: 'wallet' })).order._id, order._id);
  assert.equal((await api('/api/orders/' + order._id, 'GET', undefined, otherToken)).status, 404);
  await ok('/api/silver/physical/cart/items', 'POST', { productId: product2._id, quantity: 1 });
  const before = (await models.Wallet.findOne({ userId: user._id })).toman.available;
  const payments = await Promise.all([api('/api/orders/' + order._id + '/pay/wallet', 'POST'), api('/api/orders/' + order._id + '/pay/wallet', 'POST')]);
  payments.forEach(r => assert.equal(r.status, 200, JSON.stringify(r.body)));
  assert.equal((await models.Wallet.findOne({ userId: user._id })).toman.available, before - order.totalAmount);
  assert.equal((await models.PhysicalCart.findOne({ userId: user._id })).items.length, 2);
  assert.equal((await api('/api/admin/orders/' + order._id + '/fulfillment', 'PATCH', { status: 'delivered' }, adminToken)).status, 409);
});
test('paid multi-item out-of-stock order consumes NONE of the stock; supply is guarded', async () => {
  const { order } = await newOrder('gateway', [product, product2]);
  const payment = (await ok('/api/payments', 'POST', { purpose: 'order_payment', entityId: order._id })).payment;
  const before = await models.PhysicalInventory.findOne({ productId: product._id });
  await models.PhysicalInventory.updateOne({ productId: product2._id }, { $set: { availableQuantity: 0 } });
  await ok('/api/payments/' + payment._id + '/mock/verify', 'POST', { outcome: 'success' });
  const stored = await models.Order.findById(order._id);
  assert.equal(stored.status, 'manual_review'); assert.equal(stored.stockConsumed, false);
  assert.equal((await models.PhysicalInventory.findOne({ productId: product._id })).availableQuantity, before.availableQuantity);
  assert.equal((await api('/api/admin/orders/' + order._id + '/resolve/supply', 'POST', {}, adminToken)).status, 409);
  await ok('/api/admin/silver/physical/products/' + product2._id + '/inventory/adjustments', 'POST', { type: 'increase', quantity: 10, reason: 'resupply', idempotencyKey: key() }, adminToken);
  await ok('/api/admin/orders/' + order._id + '/resolve/supply', 'POST', {}, adminToken);
  assert.equal((await models.Order.findById(order._id)).status, 'confirmed');
});
test('all refunds credit original total to wallet exactly once, including gateway purchase', async () => {
  for (const method of ['wallet', 'gateway']) {
    const { order } = await newOrder(method);
    if (method === 'wallet') await ok('/api/orders/' + order._id + '/pay/wallet', 'POST');
    else { const payment = (await ok('/api/payments', 'POST', { purpose: 'order_payment', entityId: order._id })).payment; await ok('/api/payments/' + payment._id + '/mock/verify', 'POST', { outcome: 'success' }); }
    const before = await models.Wallet.findOne({ userId: user._id });
    const budget = (await models.PlatformBalance.findOne()).buybackAvailableToman;
    const refund = (await ok('/api/refunds', 'POST', { orderId: order._id, reason: 'test full refund' })).refund;
    assert.equal((await api('/api/admin/refunds/' + refund._id + '/complete', 'POST', {}, adminToken)).status, 409);
    await ok('/api/admin/refunds/' + refund._id + '/review', 'PATCH', { decision: 'approved' }, adminToken);
    const results = await Promise.all([api('/api/admin/refunds/' + refund._id + '/complete', 'POST', {}, adminToken), api('/api/admin/refunds/' + refund._id + '/complete', 'POST', {}, adminToken)]);
    results.forEach(r => assert.equal(r.status, 200, JSON.stringify(r.body)));
    assert.equal((await models.Wallet.findOne({ userId: user._id })).toman.available, before.toman.available + order.totalAmount);
    assert.equal((await models.PlatformBalance.findOne()).buybackAvailableToman, budget);
    assert.equal((await models.Order.findById(order._id)).status, 'refunded');
  }
});
test('expired payment success goes to manual review and production mock is disabled', async () => {
  const { order } = await newOrder('gateway');
  const payment = (await ok('/api/payments', 'POST', { purpose: 'order_payment', entityId: order._id })).payment;
  await models.Payment.updateOne({ _id: payment._id }, { $set: { expiresAt: new Date(0), status: 'expired' } });
  await ok('/api/payments/' + payment._id + '/mock/verify', 'POST', { outcome: 'success' });
  assert.equal((await models.Order.findById(order._id)).manualReviewReason, 'late_payment');
  process.env.NODE_ENV = 'production';
  try { assert.equal((await api('/api/payments/' + payment._id + '/mock/verify', 'POST', { outcome: 'success' })).status, 503); }
  finally { process.env.NODE_ENV = 'test'; }
});
test('physical and X inventories are independent and decimal arithmetic is exact', async () => {
  const { floorProduct } = await import('../utils/money.js');
  assert.equal(floorProduct(0.29, 100), 29);
  assert.equal((await models.OnlineInventory.findOne()).availableX, 100000);
  const all = await models.LedgerEntry.find().lean();
  const totals = new Map();
  for (const entry of all) { const key = entry.transactionId + ':' + entry.asset; totals.set(key, (totals.get(key) || 0n) + BigInt(entry.amount) * (entry.direction === 'credit' ? 1n : -1n)); }
  for (const value of totals.values()) assert.equal(value, 0n);
});

test('the delivered Postman smoke collection executes every request against the API', async () => {
  const collection = JSON.parse(await readFile(new URL('../postman/NOGHREX-Smoke.postman_collection.json', import.meta.url), 'utf8'));
  const env = JSON.parse(await readFile(new URL('../postman/NOGHREX-Local.postman_environment.json', import.meta.url), 'utf8'));
  const environment = Object.fromEntries(env.values.map(v => [v.key, v.value]));
  Object.assign(environment, { baseUrl: base, adminPhone: admin.phoneNumber, userPhone: user.phoneNumber, password: 'phase1-testing-password' });
  const result = await runCollection(collection, environment);
  assert.equal(result.requests, collection.item.length);
  assert.ok(result.assertions >= collection.item.length);
});

test('parallel withdrawal requests respect the daily limit and reject unlocks only once', async () => {
  const bank = await models.BankAccount.findOne({ userId: user._id, status: 'verified', isActive: true });
  const withdrawals = await models.Withdrawal.find({ userId: user._id, status: { $in: ['pending', 'approved', 'processing', 'completed'] } });
  const alreadyUsed = withdrawals.reduce((sum, item) => sum + item.amount, 0);
  await models.SystemSetting.create({ key: 'financial', value: { withdrawal: { enabled: true, perTransactionLimit: 1000000, dailyLimit: alreadyUsed + 150, minimumAmount: 1, feeAmount: 0 } } });
  const before = await models.Wallet.findOne({ userId: user._id });
  const requests = [key(), key()].map(idempotencyKey => ({ amount: 100, bankAccountId: String(bank._id), idempotencyKey }));
  const responses = await Promise.all(requests.map(body => api('/api/wallet/withdrawals', 'POST', body)));
  assert.deepEqual(responses.map(r => r.status).sort(), [201, 400]);
  const successIndex = responses.findIndex(r => r.status === 201);
  const withdrawal = responses[successIndex].body.data.withdrawal;
  assert.equal((await ok('/api/wallet/withdrawals', 'POST', requests[successIndex])).withdrawal._id, withdrawal._id);
  assert.equal((await models.Wallet.findOne({ userId: user._id })).toman.available, before.toman.available - 100);
  await ok('/api/admin/withdrawals/' + withdrawal._id + '/reject', 'PATCH', { reason: 'تست بازگشت وجه' }, adminToken);
  assert.equal((await api('/api/admin/withdrawals/' + withdrawal._id + '/reject', 'PATCH', { reason: 'تکرار' }, adminToken)).status, 409);
  assert.equal((await models.Wallet.findOne({ userId: user._id })).toman.available, before.toman.available);
  await models.SystemSetting.deleteMany({});
});

test('parallel deposit requests cannot bypass the configurable daily cap', async () => {
  const deposits = await models.Deposit.find({ userId: other._id, method: 'gateway', status: { $in: ['pending', 'processing', 'completed'] } });
  const alreadyUsed = deposits.reduce((sum, item) => sum + item.amount, 0);
  await models.SystemSetting.create({ key: 'financial', value: { deposit: { gateway: { enabled: true, perTransactionLimit: 1000000, dailyLimit: alreadyUsed + 150 } } } });
  const results = await Promise.all([1, 2].map(() => api('/api/wallet/deposits', 'POST', { method: 'gateway', amount: 100, idempotencyKey: key() }, otherToken)));
  assert.deepEqual(results.map(r => r.status).sort(), [201, 400]);
  await models.SystemSetting.deleteMany({});
});

test('parallel bank account creation respects maximum and KYC approval is audited', async () => {
  const results = await Promise.all([1, 2, 3, 4].map(i => api('/api/account/bank-accounts', 'POST', {
    cardNumber: '603799111111111' + i, iban: 'IR00111111111111111111111' + i, bankName: 'بانک تست', isDefault: true
  }, otherToken)));
  assert.equal(results.filter(r => r.status === 201).length, 3, JSON.stringify(results));
  assert.equal(await models.BankAccount.countDocuments({ userId: other._id, isDefault: true }), 1);
  const submitted = await ok('/api/account/kyc', 'PUT', { nationalId: '0084575948', birthDate: '1995-01-01' }, otherToken);
  await ok('/api/admin/kyc/' + submitted.kyc._id + '/approve', 'PATCH', {}, adminToken);
  assert.equal(await models.AuditLog.countDocuments({ action: 'KYC_VERIFIED', entityId: submitted.kyc._id }), 1);
  assert.equal((await api('/api/account/kyc', 'PUT', { nationalId: '0084575948', birthDate: '1996-01-01' }, otherToken)).status, 409);
});

test('unpaid orders cannot ship; shipped refunds require receipt of returned goods', async () => {
  const { order } = await newOrder();
  assert.equal((await api('/api/admin/orders/' + order._id + '/fulfillment', 'PATCH', { status: 'processing' }, adminToken)).status, 409);
  await ok('/api/orders/' + order._id + '/pay/wallet', 'POST');
  for (const status of ['processing', 'shipped']) await ok('/api/admin/orders/' + order._id + '/fulfillment', 'PATCH', { status }, adminToken);
  const refund = (await ok('/api/refunds', 'POST', { orderId: order._id, reason: 'مرجوعی تست' })).refund;
  await ok('/api/admin/refunds/' + refund._id + '/review', 'PATCH', { decision: 'approved' }, adminToken);
  assert.equal((await api('/api/admin/refunds/' + refund._id + '/complete', 'POST', { stockReturned: false }, adminToken)).status, 409);
  await ok('/api/admin/refunds/' + refund._id + '/complete', 'POST', { stockReturned: true }, adminToken);
});

test('customer landing, scripts, media and admin shell remain independently available', async () => {
  const root = await fetch(base + '/'); assert.equal(root.status, 200); assert.match(await root.text(), /customer.js/);
  assert.match(root.headers.get('content-security-policy'), /script-src 'self'/);
  for (const path of ['/customer.js','/ui.js','/store.js','/assets/brand.png','/assets/silver-hero.png','/assets/silver-motion.webm','/assets/silver-motion.gif','/admin/']) {
    const r = await fetch(base + path); assert.equal(r.status, 200, path); await r.arrayBuffer();
  }
  const conf = await ok('/api/storefront/config','GET',undefined,null);
  assert.deepEqual(Object.keys(conf).sort(),['paymentGateway','withdrawalFee']);
  assert.equal(conf.paymentGateway,'mock'); assert.equal(typeof conf.withdrawalFee,'number');
});

test('catalog search treats user text literally and excludes inactive products', async () => {
  const searchable = await models.PhysicalProduct.create({ name:'Fine [Silver] Unique QA',slug:'qa-search-fine',sku:'QA-SEARCH-FINE',weightGrams:2,active:true,category:'minimal' });
  await models.PhysicalProduct.create({ name:'Hidden [Silver] Unique QA',slug:'qa-search-hidden',sku:'QA-SEARCH-HIDDEN',weightGrams:2,active:false });
  await models.PhysicalInventory.create({productId:searchable._id,availableQuantity:4});
  const d = await ok('/api/silver/physical/products?q='+encodeURIComponent('[Silver] Unique QA'),'GET',undefined,null);
  assert.equal(d.products.total,1); assert.equal(d.products.items[0]._id,String(searchable._id)); assert.equal(d.products.items[0].inventory,4);
  const allPattern = await ok('/api/silver/physical/products?q='+encodeURIComponent('.*'),'GET',undefined,null);
  assert.equal(allPattern.products.total,0);
  const category = await ok('/api/silver/physical/products?q=minimal&limit=1','GET',undefined,null); assert.ok(category.products.total>=1); assert.equal(category.products.items.length,1);
});

test('admin panel reads require admin role and never expose password or auth version',async()=>{
  assert.equal((await api('/api/admin/panel/users','GET',undefined,null)).status,401);
  assert.equal((await api('/api/admin/panel/users','GET',undefined,otherToken)).status,403);
  const d=await ok('/api/admin/panel/users?q=09121110001','GET',undefined,adminToken);
  assert.equal(d.total,1); assert.equal(d.items[0].password,undefined);assert.equal(d.items[0].tokenVersion,undefined);
  const detail=await ok('/api/admin/panel/users/'+admin._id,'GET',undefined,adminToken); assert.ok(detail.wallet);assert.equal(detail.item.password,undefined);
  const overview=await ok('/api/admin/panel/overview','GET',undefined,adminToken);assert.ok(overview.counts);assert.equal(typeof overview.buybackToman,'number');
});
