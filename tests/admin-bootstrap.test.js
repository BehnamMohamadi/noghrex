import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { startIsolatedMongo } from './helpers/mongo.js';
import { createInitialAdmin } from '../scripts/admin-bootstrap.js';
import { User } from '../models/account/user-model.js';
import { Wallet } from '../models/wallet/wallet-model.js';

test('admin bootstrap hashes passwords, creates wallet and preserves existing accounts', async () => {
  const mongo = await startIsolatedMongo();
  try {
    await mongoose.connect(mongo.uri);
    for (const model of Object.values(mongoose.models)) await model.init();
    const input = { phoneNumber: '۰۹۱۲۳۴۵۶۷۸۹', password: 'Bootstrap-test!2026' };
    assert.equal((await createInitialAdmin(input)).created, true);
    const admin = await User.findOne({ phoneNumber: '09123456789' }).select('+password');
    assert.equal(admin.role, 'admin');
    assert.notEqual(admin.password, input.password);
    assert.equal(await admin.comparePassword(input.password), true);
    assert.equal(await Wallet.countDocuments({ userId: admin._id }), 1);
    assert.equal((await createInitialAdmin({ ...input, password: 'Different-test!2026' })).created, false);
    assert.equal((await User.findById(admin._id).select('+password')).password, admin.password);
    assert.equal(await Wallet.countDocuments({ userId: admin._id }), 1);
    const user = await User.create({ firstname: 'نمونه', lastname: 'کاربر', phoneNumber: '09123456788', password: input.password });
    await assert.rejects(createInitialAdmin({ ...input, phoneNumber: user.phoneNumber }), /حساب دیگری/);
    assert.equal((await User.findById(user._id)).role, 'user');
    await User.updateOne({ _id: admin._id }, { accountStatus: 'suspended' });
    await assert.rejects(createInitialAdmin(input), /غیرفعال/);
    await assert.rejects(createInitialAdmin({ ...input, phoneNumber: '123' }), /شماره همراه/);
    await assert.rejects(createInitialAdmin({ ...input, password: 'short' }), /رمز/);
  } finally { await mongoose.disconnect(); await mongo.stop(); }
});
