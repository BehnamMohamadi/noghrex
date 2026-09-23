import { mkdirSync, writeFileSync } from 'node:fs';
import crypto from 'node:crypto';
const folder = 'postman'; mkdirSync(folder, { recursive: true });
const schema = 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json';
// Each descriptor is also used by the isolated HTTP collection test.
function request(name, method, path, body, role = 'user', captures = {}, expected = [200, 201], extra = '') {
  const tests = [
    `pm.test('HTTP status', function () { pm.expect(pm.response.code).to.be.oneOf(${JSON.stringify(expected)}); });`,
    `const result = pm.response.json();`,
    ...Object.entries(captures).map(([key, value]) => `if (result.data) { const value = ${'result.data.' + value}; if (value !== undefined && value !== null) pm.environment.set('${key}', String(value)); }`),
    extra
  ].filter(Boolean);
  return { name, protocolProfileBehavior: { disableCookies: true }, request: {
    method, header: [{ key: 'Content-Type', value: 'application/json' }, { key: 'X-Requested-With', value: 'NOGHREX' }],
    auth: role ? { type: 'bearer', bearer: [{ key: 'token', value: '{{' + role + 'Token}}', type: 'string' }] } : { type: 'noauth' },
    url: '{{baseUrl}}' + path, ...(body === undefined ? {} : { body: { mode: 'raw', raw: JSON.stringify(body, null, 2), options: { raw: { language: 'json' } } } })
  }, event: [{ listen: 'test', script: { type: 'text/javascript', exec: tests } }] };
}
const login = role => request('Login ' + role, 'POST', '/api/account/login', { phoneNumber: '{{' + role + 'Phone}}', password: '{{password}}' }, null,
  { [role + 'Id']: 'user._id' }, [200], `const cookie = pm.response.headers.get('Set-Cookie') || ''; const token = cookie.match(/noghrex_auth=([^;]+)/); if (token) pm.environment.set('${role}Token', decodeURIComponent(token[1])); pm.test('Token returned', function () { pm.expect(Boolean(token)).to.equal(true); });`);
const deposit = (method = 'gateway') => request('Create ' + method + ' deposit', 'POST', '/api/wallet/deposits', { method, amount: 5000000, idempotencyKey: 'deposit-' + method + '-{{runId}}', ...(method === 'gateway' ? {} : { transferReference: 'receipt-{{runId}}' }) }, 'user', { depositId: 'deposit._id' });
const payment = purpose => request('Start ' + purpose + ' payment', 'POST', '/api/payments', { purpose, entityId: purpose === 'wallet_deposit' ? '{{depositId}}' : '{{orderId}}' }, 'user', { paymentId: 'payment._id' });
const verify = request('Verify mock success', 'POST', '/api/payments/{{paymentId}}/mock/verify', { outcome: 'success' });
const product = request('Create physical product', 'POST', '/api/admin/silver/physical/products', { name: 'شمش آزمایشی یک گرمی', slug: 'bar-{{runId}}', sku: 'BAR-{{runId}}', weightGrams: 1, pricingMode: 'custom', wageType: 'percent', wageValue: 10, profitPercent: 5, taxPercent: 9, accessoriesAmount: 0 }, 'admin', { productId: 'product._id' });
const stock = request('Increase physical stock', 'POST', '/api/admin/silver/physical/products/{{productId}}/inventory/adjustments', { type: 'increase', quantity: 10, reason: 'موجودی تست', idempotencyKey: 'physical-stock-{{runId}}' }, 'admin');
const address = request('Create address', 'POST', '/api/account/addresses', { title: 'تست', recipientName: 'کاربر آزمایشی', phoneNumber: '{{userPhone}}', province: 'تهران', city: 'تهران', addressLine: 'خیابان آزمایشی', postalCode: '1234567890', isDefault: true }, 'user', { addressId: 'address._id' });
const shipping = request('Create shipping method', 'POST', '/api/admin/shipping-methods', { name: 'ارسال آزمایشی', cost: 10000, active: true, provinceRestrictions: [] }, 'admin', { shippingId: 'method._id' });
const cart = request('Add product to cart', 'POST', '/api/silver/physical/cart/items', { productId: '{{productId}}', quantity: 1 });
const checkout = request('Create checkout snapshot', 'POST', '/api/checkout', { addressId: '{{addressId}}', shippingMethodId: '{{shippingId}}' }, 'user', { checkoutId: 'checkout._id' });
const order = method => request('Create ' + method + ' order', 'POST', '/api/orders', { checkoutSessionId: '{{checkoutId}}', paymentMethod: method }, 'user', { orderId: 'order._id', orderTotal: 'order.totalAmount' });
const refund = request('Request full refund to wallet', 'POST', '/api/refunds', { orderId: '{{orderId}}', reason: 'درخواست بازپرداخت آزمایشی' }, 'user', { refundId: 'refund._id' });
const approveRefund = request('Approve refund', 'PATCH', '/api/admin/refunds/{{refundId}}/review', { decision: 'approved' }, 'admin');
const completeRefund = request('Complete refund to wallet', 'POST', '/api/admin/refunds/{{refundId}}/complete', { stockReturned: true }, 'admin');
const onlinePrice = request('Set online price', 'PUT', '/api/admin/silver/online/price/manual', { buyPricePer1000X: 100000, sellPricePer1000X: 105000 }, 'admin');
const onlineStock = request('Increase online X inventory', 'POST', '/api/admin/silver/online/inventory/adjustments', { type: 'increase', amountX: 100000, reason: 'موجودی آنلاین آزمایشی', idempotencyKey: 'online-stock-{{runId}}' }, 'admin');
const budget = request('Allocate independent buyback budget', 'POST', '/api/admin/buyback-budget/adjustments', { type: 'increase', amountToman: 1000000, reason: 'تخصیص آزمایشی مستقل', idempotencyKey: 'buyback-{{runId}}' }, 'admin');
const quote = side => request('Create ' + side + ' quote', 'POST', '/api/silver/online/quotes', { side, xAmount: 1000 }, 'user', { quoteId: 'quote._id' });
const trade = request('Execute quoted trade', 'POST', '/api/silver/online/trades', { quoteId: '{{quoteId}}' }, 'user', { tradeId: 'trade._id' });
const bank = request('Add bank account', 'POST', '/api/account/bank-accounts', { cardNumber: '{{cardNumber}}', iban: '{{iban}}', bankName: 'بانک تست', isDefault: true }, 'user', { bankId: 'bankAccount._id' });
const withdrawal = request('Request withdrawal', 'POST', '/api/wallet/withdrawals', { amount: 200000, bankAccountId: '{{bankId}}', idempotencyKey: 'withdrawal-{{runId}}' }, 'user', { withdrawalId: 'withdrawal._id' });
const group = (name, item, description) => ({ name, item, ...(description ? { description } : {}) });
const setup = [login('admin'), login('user')];
const smoke = [
  request('Health', 'GET', '/api/health', undefined, null), ...setup,
  deposit(), payment('wallet_deposit'), verify, { ...verify, name: 'Replay callback - no duplicate credit' },
  request('Wallet after deposit', 'GET', '/api/wallet'), onlinePrice, onlineStock, budget,
  quote('buy'), trade, { ...trade, name: 'Replay trade - same trade ID' }, quote('sell'), trade,
  request('Separate sales and commission report', 'GET', '/api/admin/silver/online/trades/summary', undefined, 'admin'),
  request('Set physical price', 'PUT', '/api/admin/silver/physical/price', { pricePerGram: 100000 }, 'admin'),
  product, stock, address, shipping, request('Clear cart', 'DELETE', '/api/silver/physical/cart'), cart, checkout, order('wallet'),
  request('Pay order from wallet', 'POST', '/api/orders/{{orderId}}/pay/wallet'),
  request('Replay wallet payment', 'POST', '/api/orders/{{orderId}}/pay/wallet'), refund, approveRefund, completeRefund,
  { ...completeRefund, name: 'Replay refund - no duplicate credit' }, cart, checkout, order('gateway'), payment('order_payment'), verify,
  refund, approveRefund, completeRefund,
  bank, request('Verify bank account', 'PATCH', '/api/admin/bank-accounts/{{bankId}}/verify', {}, 'admin'), withdrawal,
  request('Approve withdrawal', 'PATCH', '/api/admin/withdrawals/{{withdrawalId}}/approve', {}, 'admin'),
  request('Mark withdrawal processing', 'PATCH', '/api/admin/withdrawals/{{withdrawalId}}/processing', {}, 'admin'),
  request('Record completed bank transfer', 'PATCH', '/api/admin/withdrawals/{{withdrawalId}}/complete', { bankReference: 'test-bank-{{runId}}' }, 'admin'),
  request('Final wallet', 'GET', '/api/wallet'),
  request('Final buyback budget', 'GET', '/api/admin/buyback-budget', undefined, 'admin'),
  request('Audit report', 'GET', '/api/admin/reports/audit?page=1&limit=20', undefined, 'admin')
];
const reference = [
 group('00 - Login', setup),
 group('01 - Account and OTP', [
  request('Request signup OTP (read code in server terminal)', 'POST', '/api/account/signup/otp', { phoneNumber: '{{signupPhone}}' }, null),
  request('Verify signup OTP', 'POST', '/api/account/signup/otp/verify', { phoneNumber: '{{signupPhone}}', code: '{{otpCode}}' }, null, { signupToken: 'signupToken' }),
  request('Signup', 'POST', '/api/account/signup', { signupToken: '{{signupToken}}', firstname: 'کاربر', lastname: 'تست', password: '{{password}}' }, null),
  request('My account', 'GET', '/api/account'), request('Update profile', 'PATCH', '/api/account', { firstname: 'کاربر' }),
  request('Deactivate empty account', 'DELETE', '/api/account'), request('Logout all sessions', 'POST', '/api/account/logout')
 ], 'Alternative operations. Deactivate/logout invalidate your session; run login again.'),
 group('02 - Wallet and deposits', [request('Wallet', 'GET', '/api/wallet'), deposit(), payment('wallet_deposit'), verify,
  request('My deposits', 'GET', '/api/wallet/deposits'), deposit('card_to_card'),
  request('Pending manual deposits', 'GET', '/api/admin/deposits', undefined, 'admin'),
  request('Approve manual deposit', 'PATCH', '/api/admin/deposits/{{depositId}}/approve', {}, 'admin'),
  request('Reject manual deposit', 'PATCH', '/api/admin/deposits/{{depositId}}/reject', { reason: 'رسید نامعتبر' }, 'admin')]),
 group('03 - KYC and bank accounts', [
  request('Submit KYC', 'PUT', '/api/account/kyc', { nationalId: '{{nationalId}}', birthDate: '1995-01-01' }, 'user', { kycId: 'kyc._id' }),
  request('My KYC', 'GET', '/api/account/kyc'), request('Pending KYC', 'GET', '/api/admin/kyc', undefined, 'admin'),
  request('Approve KYC', 'PATCH', '/api/admin/kyc/{{kycId}}/approve', {}, 'admin'),
  request('Reject KYC', 'PATCH', '/api/admin/kyc/{{kycId}}/reject', { rejectionReason: 'اطلاعات نامعتبر است' }, 'admin'), bank,
  request('My bank accounts', 'GET', '/api/account/bank-accounts'), request('Set default bank', 'PATCH', '/api/account/bank-accounts/{{bankId}}/default'),
  request('Pending bank accounts', 'GET', '/api/admin/bank-accounts', undefined, 'admin'),
  request('Verify bank account', 'PATCH', '/api/admin/bank-accounts/{{bankId}}/verify', {}, 'admin'),
  request('Reject bank account', 'PATCH', '/api/admin/bank-accounts/{{bankId}}/reject', { rejectionReason: 'مالکیت تأیید نشد' }, 'admin'),
  request('Deactivate bank account', 'DELETE', '/api/account/bank-accounts/{{bankId}}')]),
 group('04 - Withdrawals', [withdrawal, request('My withdrawals', 'GET', '/api/wallet/withdrawals'),
  request('Pending withdrawals', 'GET', '/api/admin/withdrawals', undefined, 'admin'),
  request('Approve withdrawal', 'PATCH', '/api/admin/withdrawals/{{withdrawalId}}/approve', {}, 'admin'),
  request('Processing withdrawal', 'PATCH', '/api/admin/withdrawals/{{withdrawalId}}/processing', {}, 'admin'),
  request('Complete withdrawal', 'PATCH', '/api/admin/withdrawals/{{withdrawalId}}/complete', { bankReference: 'bank-{{runId}}' }, 'admin'),
  request('Reject withdrawal and unlock money', 'PATCH', '/api/admin/withdrawals/{{withdrawalId}}/reject', { reason: 'اطلاعات نیازمند بررسی' }, 'admin')]),
 group('05 - Online silver', [onlinePrice, onlineStock, budget,
  request('Public online price', 'GET', '/api/silver/online/price', undefined, null), quote('buy'), trade, quote('sell'), trade,
  request('Get quote', 'GET', '/api/silver/online/quotes/{{quoteId}}'), request('My trades', 'GET', '/api/silver/online/trades?page=1&limit=20'),
  request('Admin trades', 'GET', '/api/admin/silver/online/trades?page=1&limit=20', undefined, 'admin'),
  request('Trade summary', 'GET', '/api/admin/silver/online/trades/summary', undefined, 'admin'),
  request('X inventory', 'GET', '/api/admin/silver/online/inventory', undefined, 'admin'),
  request('Inventory history', 'GET', '/api/admin/silver/online/inventory/transactions', undefined, 'admin'),
  request('Online price history', 'GET', '/api/admin/silver/online/price/history', undefined, 'admin'),
  request('Buyback budget', 'GET', '/api/admin/buyback-budget', undefined, 'admin'),
  request('Buyback adjustments', 'GET', '/api/admin/buyback-budget/adjustments', undefined, 'admin')]),
 group('06 - Physical catalog and basket', [request('Set physical price', 'PUT', '/api/admin/silver/physical/price', { pricePerGram: 100000 }, 'admin'), product, stock,
  request('Update product', 'PATCH', '/api/admin/silver/physical/products/{{productId}}', { name: 'شمش نقره' }, 'admin'),
  request('Physical price', 'GET', '/api/silver/physical/price', undefined, null), request('Products', 'GET', '/api/silver/physical/products', undefined, null),
  request('Product details', 'GET', '/api/silver/physical/products/{{productId}}', undefined, null), cart,
  request('Get cart', 'GET', '/api/silver/physical/cart'), request('Set cart quantity', 'PATCH', '/api/silver/physical/cart/items/{{productId}}', { quantity: 2 }),
  request('Clear cart', 'DELETE', '/api/silver/physical/cart')]),
 group('07 - Address and shipping', [address, request('Addresses', 'GET', '/api/account/addresses'),
  request('Update address', 'PATCH', '/api/account/addresses/{{addressId}}', { title: 'خانه' }), request('Deactivate address', 'DELETE', '/api/account/addresses/{{addressId}}'), shipping,
  request('Shipping methods', 'GET', '/api/shipping-methods', undefined, null),
  request('Update shipping', 'PATCH', '/api/admin/shipping-methods/{{shippingId}}', { name: 'پست', cost: 10000 }, 'admin')]),
 group('08 - Checkout orders and payments', [checkout, request('Checkout details', 'GET', '/api/checkout/{{checkoutId}}'), order('wallet'),
  request('Wallet payment', 'POST', '/api/orders/{{orderId}}/pay/wallet'), order('gateway'), payment('order_payment'), verify,
  request('Payment details', 'GET', '/api/payments/{{paymentId}}'), request('Mock cancellation', 'POST', '/api/payments/{{paymentId}}/mock/verify', { outcome: 'cancel' }),
  request('My orders', 'GET', '/api/orders?page=1&limit=20'), request('Order details', 'GET', '/api/orders/{{orderId}}'),
  request('Cancel unpaid order', 'POST', '/api/orders/{{orderId}}/cancel'),
  request('Admin orders', 'GET', '/api/admin/orders?page=1&limit=20', undefined, 'admin'),
  request('Supply manual-review order', 'POST', '/api/admin/orders/{{orderId}}/resolve/supply', {}, 'admin'),
  ...['processing','shipped','delivered'].map(status => request('Fulfillment: ' + status, 'PATCH', '/api/admin/orders/{{orderId}}/fulfillment', { status, trackingCode: 'TEST-POST-001' }, 'admin'))]),
 group('09 - Full refund to wallet', [refund, request('My refunds', 'GET', '/api/refunds'), request('Admin refunds', 'GET', '/api/admin/refunds', undefined, 'admin'), approveRefund,
  request('Reject refund', 'PATCH', '/api/admin/refunds/{{refundId}}/review', { decision: 'rejected', reason: 'درخواست تأیید نشد' }, 'admin'), completeRefund]),
 group('10 - Administration and reports', [request('Users', 'GET', '/api/users', undefined, 'admin'), request('User wallet', 'GET', '/api/users/{{userId}}/wallet', undefined, 'admin'),
  request('Suspend user', 'PATCH', '/api/users/{{userId}}/status', { accountStatus: 'suspended', reason: 'بررسی آزمایشی' }, 'admin'),
  request('Reactivate user (then login again)', 'PATCH', '/api/users/{{userId}}/status', { accountStatus: 'active', reason: 'رفع تعلیق آزمایشی' }, 'admin'),
  request('Financial settings', 'GET', '/api/admin/settings/financial', undefined, 'admin', {}, [200], "pm.environment.set('financialSettings', JSON.stringify(result.data.settings));"),
  request('Update settings using previous GET', 'PUT', '/api/admin/settings/financial', '__SETTINGS__', 'admin'),
  request('Audit log', 'GET', '/api/admin/reports/audit', undefined, 'admin'), request('Ledger transactions', 'GET', '/api/admin/reports/ledger', undefined, 'admin'),
  request('Ledger entries', 'GET', '/api/admin/reports/ledger/{{ledgerId}}/entries', undefined, 'admin'),
  request('System alerts', 'GET', '/api/admin/system/alerts', undefined, 'admin'), request('Resolve alert', 'PATCH', '/api/admin/system/alerts/{{alertId}}/resolve', {}, 'admin')])
];
for (const group of reference) for (const item of group.item) if (item.request.body?.raw === '"__SETTINGS__"') item.request.body.raw = '{{financialSettings}}';
const initialScript = ["if (!pm.environment.get('runId')) pm.environment.set('runId', pm.variables.replaceIn('{{$guid}}'));",
 "if (!pm.environment.get('cardNumber')) pm.environment.set('cardNumber', '603799' + String(Date.now()).slice(-10));",
 "if (!pm.environment.get('iban')) pm.environment.set('iban', 'IR00' + '0000000000' + String(Date.now()).slice(-12));"];
function collection(name, item, description) { return { info: { _postman_id: crypto.randomUUID(), name, schema, description }, event: [{ listen: 'prerequest', script: { type: 'text/javascript', exec: initialScript } }], item }; }
reference.push(group('11 - Additional admin operations', [request('Record confirmed failed bank transfer', 'POST', '/api/admin/withdrawals/{{withdrawalId}}/fail', {bankTransferFailed:true,reason:'بانک عدم انتقال را تأیید کرد'}, 'admin'),request('All physical products including inactive', 'GET', '/api/admin/silver/physical/products', undefined, 'admin'),request('Admin product and inventory', 'GET', '/api/admin/silver/physical/products/{{productId}}', undefined, 'admin'),request('Physical inventory history', 'GET', '/api/admin/silver/physical/products/{{productId}}/inventory/transactions', undefined, 'admin'),request('Physical price history', 'GET', '/api/admin/silver/physical/price/history', undefined, 'admin'),request('All shipping methods', 'GET', '/api/admin/shipping-methods', undefined, 'admin')]));
const referenceCollection = collection('NOGHREX Phase 1 - API Reference', reference, 'همه مسیرهای فاز ۱. درخواست‌های تأیید/رد و روش‌های پرداخت جایگزین هم هستند؛ کل این مجموعه را پشت سر هم اجرا نکنید. برای اجرای ترتیبی از Smoke استفاده کنید.');
const smokeCollection = collection('NOGHREX Phase 1 - Runnable Smoke', smoke, 'پس از npm run seed:local و npm start به ترتیب اجرا شود. تمام تراکنش‌ها آزمایشی هستند. برای اجرای دوباره runId، cardNumber و iban را خالی کنید.');
writeFileSync(folder + '/NOGHREX-Phase1.postman_collection.json', JSON.stringify(referenceCollection, null, 2));
writeFileSync(folder + '/NOGHREX-Smoke.postman_collection.json', JSON.stringify(smokeCollection, null, 2));
const values = { baseUrl: 'http://127.0.0.1:3000', adminPhone: '09120000001', userPhone: '09120000002', password: 'NoghrexLocal!2026', signupPhone: '09120000003', otpCode: '', signupToken: '', adminToken: '', userToken: '', runId: '', cardNumber: '', iban: '', nationalId: '0084575948', ledgerId: '', alertId: '' };
writeFileSync(folder + '/NOGHREX-Local.postman_environment.json', JSON.stringify({ id: crypto.randomUUID(), name: 'NOGHREX Local (test only)', values: Object.entries(values).map(([key, value]) => ({ key, value, enabled: true, type: /password|Token/.test(key) ? 'secret' : 'default' })), _postman_variable_scope: 'environment' }, null, 2));
console.log('Postman files generated. Reference requests: ' + reference.reduce((n, group) => n + group.item.length, 0) + '; smoke requests: ' + smoke.length);
