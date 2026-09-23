import { before, beforeEach, after, test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { startIsolatedMongo } from "./helpers/mongo.js";
import { PlatformBalance } from "../models/platform/platform-balance-model.js";
import { BuybackAdjustment } from "../models/platform/buyback-adjustment-model.js";
import { Wallet } from "../models/wallet/wallet-model.js";
import { OnlineInventory } from "../models/silver/online/online-inventory-model.js";
import { Quote } from "../models/silver/online/quote-model.js";
import { Trade } from "../models/silver/online/trade-model.js";
import { LedgerAccount } from "../models/ledger/ledger-account-model.js";
import { LedgerEntry } from "../models/ledger/ledger-entry-model.js";
import { LedgerTransaction } from "../models/ledger/ledger-transaction-model.js";
import { AuditLog } from "../models/audit/audit-log-model.js";
import { BankAccount } from "../models/account/bank-account-model.js";
import { User } from "../models/account/user-model.js";
import {
  adjustBuybackBudget,
  getBuybackBudget,
} from "../services/platform/buyback-budget-service.js";
import { createWalletForUser } from "../services/wallet/wallet-service.js";
import {
  executeTrade,
  getTradeSummary,
} from "../services/silver/online/trade-service.js";
import {
  createDepositRequest,
  approveManualDeposit,
} from "../services/deposit/deposit-service.js";
import {
  createWithdrawal,
  approveWithdrawal,
  markWithdrawalProcessing,
  completeWithdrawal,
} from "../services/withdrawal/withdrawal-service.js";

let mongo, server, base, signAuthToken, userId, adminId;
before(async () => {
  mongo = await startIsolatedMongo();
  process.env.NODE_ENV = "test";
  process.env.MONGODB_URI = mongo.uri;
  process.env.JWT_SECRET = "isolated-noghrex-buyback-tests-only-secret";
  const { app } = await import("../app.js");
  ({ signAuthToken } = await import("../utils/auth-token.js"));
  await mongoose.connect(mongo.uri);
  for (const model of Object.values(mongoose.models)) await model.init();
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  await mongo?.stop();
});
beforeEach(async () => {
  for (const model of Object.values(mongoose.models)) await model.deleteMany({});
  userId = new mongoose.Types.ObjectId();
  adminId = new mongoose.Types.ObjectId();
  await createWalletForUser(userId);
  await OnlineInventory.create({ key: "x", availableX: 100000 });
});

const balance = () => PlatformBalance.findOne({ key: "main" }).lean();
const wallet = () => Wallet.findOne({ userId }).lean();
const fund = (amountToman, idempotencyKey = "allocation-test-0001") =>
  adjustBuybackBudget(adminId, {
    type: "increase",
    amountToman,
    reason: "تأمین سرمایه بازخرید آزمایشی",
    idempotencyKey,
  });
async function deposit(amount = 1000000) {
  const request = await createDepositRequest(userId, { method: "card_to_card", amount });
  return approveManualDeposit(request._id, adminId);
}
async function quote(
  side,
  { xAmount = 1000, grossToman = 100000, commissionToman = 1000 } = {},
) {
  return Quote.create({
    userId,
    side,
    xAmount,
    pricePer1000X: (grossToman * 1000) / xAmount,
    grossToman,
    commissionPercent: (commissionToman / grossToman) * 100,
    commissionToman,
    finalToman:
      side === "buy" ? grossToman + commissionToman : grossToman - commissionToman,
    priceSource: "manual",
    priceEffectiveAt: new Date(),
    expiresAt: new Date(Date.now() + 120000),
  });
}
async function accountEntries(transactionId) {
  const entries = await LedgerEntry.find({ transactionId }).populate("accountId").lean();
  const sums = {};
  for (const row of entries) {
    sums[row.asset] =
      (sums[row.asset] || 0) + (row.direction === "credit" ? row.amount : -row.amount);
  }
  for (const value of Object.values(sums))
    assert.equal(value, 0, "Ledger must balance per asset");
  return entries;
}

test("admin allocation is auditable, idempotent and cannot remove unavailable funds", async () => {
  const first = await fund(200000);
  const repeated = await fund(200000);
  assert.equal(String(first._id), String(repeated._id));
  assert.equal((await balance()).buybackAvailableToman, 200000);
  assert.equal((await balance()).tomanAvailable, 0);
  assert.equal(await BuybackAdjustment.countDocuments(), 1);
  assert.equal(
    await AuditLog.countDocuments({ action: "ADMIN_ADJUSTED_BUYBACK_BUDGET" }),
    1,
  );
  await accountEntries(first.ledgerTransactionId);
  await assert.rejects(fund(300000), { code: "IDEMPOTENCY_CONFLICT" });
  await assert.rejects(
    adjustBuybackBudget(adminId, {
      type: "decrease",
      amountToman: 200001,
      reason: "کاهش آزمایشی",
      idempotencyKey: "decrease-test-0001",
    }),
    { code: "INSUFFICIENT_BUYBACK_BUDGET" },
  );
  await adjustBuybackBudget(adminId, {
    type: "decrease",
    amountToman: 50000,
    reason: "کاهش آزمایشی",
    idempotencyKey: "decrease-test-0002",
  });
  assert.deepEqual(await getBuybackBudget(), { availableToman: 150000 });
  assert.equal(await BuybackAdjustment.countDocuments(), 2);
});

test("deposit and purchase never fund buybacks; principal and buy commission have separate accounts", async () => {
  await fund(250000);
  await deposit();
  const q = await quote("buy");
  const trade = await executeTrade(userId, q._id);
  assert.equal((await wallet()).toman.available, 899000);
  assert.equal((await wallet()).x.available, 1000);
  assert.equal((await balance()).buybackAvailableToman, 250000);
  assert.equal(
    (await balance()).tomanAvailable,
    1000000,
    "A wallet purchase must not count the deposit a second time",
  );
  const entries = await accountEntries(trade.ledgerTransactionId);
  assert.equal(
    entries.find((e) => e.accountId.balanceType === "silver_sales").amount,
    100000,
  );
  assert.equal(
    entries.find((e) => e.accountId.balanceType === "buy_commission").amount,
    1000,
  );
  assert.equal(
    entries.some((e) => e.accountId.balanceType === "buyback_budget"),
    false,
  );
  assert.equal(String((await executeTrade(userId, q._id))._id), String(trade._id));
  assert.equal((await wallet()).toman.available, 899000);
});

test("settlement cash alone cannot finance a sell, including legacy documents without a budget", async () => {
  await PlatformBalance.collection.insertOne({ key: "main", tomanAvailable: 10000000 });
  await Wallet.updateOne({ userId }, { $set: { "x.available": 1000 } });
  const q = await quote("sell");
  await assert.rejects(executeTrade(userId, q._id), {
    code: "INSUFFICIENT_BUYBACK_BUDGET",
  });
  assert.equal((await wallet()).x.available, 1000);
  assert.equal(await Trade.countDocuments(), 0);
  assert.equal(await LedgerEntry.countDocuments(), 0);
  assert.equal((await Quote.findById(q._id)).status, "active");
  assert.deepEqual(await getBuybackBudget(), { availableToman: 0 });
});

test("sell spends only net buyback funds; withdrawal does not spend the budget twice", async () => {
  await fund(99000);
  await Wallet.updateOne({ userId }, { $set: { "x.available": 1000 } });
  const q = await quote("sell");
  const trade = await executeTrade(userId, q._id);
  assert.equal((await wallet()).toman.available, 99000);
  assert.equal((await wallet()).x.available, 0);
  assert.equal((await balance()).buybackAvailableToman, 0);
  assert.equal((await balance()).tomanAvailable, 99000);
  const entries = await accountEntries(trade.ledgerTransactionId);
  assert.equal(
    entries.find((e) => e.accountId.balanceType === "silver_purchases").amount,
    100000,
  );
  assert.equal(
    entries.find((e) => e.accountId.balanceType === "sell_commission").amount,
    1000,
  );
  assert.equal(
    entries.find((e) => e.accountId.balanceType === "buyback_budget").amount,
    99000,
  );
  const bank = await BankAccount.create({
    userId,
    cardNumber: "6037990000000000",
    iban: "IR000000000000000000000000",
    bankName: "Test",
    status: "verified",
  });
  const withdrawal = await createWithdrawal(userId, {
    amount: 99000,
    bankAccountId: bank._id,
  });
  await approveWithdrawal(withdrawal._id, adminId);
  await markWithdrawalProcessing(withdrawal._id, adminId);
  await completeWithdrawal(withdrawal._id, adminId, "test-bank-reference");
  assert.equal((await wallet()).toman.locked, 0);
  assert.equal((await balance()).tomanAvailable, 0);
  assert.equal((await balance()).buybackAvailableToman, 0);
});

test("concurrent sells cannot overspend the independent budget", async () => {
  await fund(99000);
  await Wallet.updateOne({ userId }, { $set: { "x.available": 2000 } });
  const a = await quote("sell"),
    b = await quote("sell");
  const results = await Promise.allSettled([
    executeTrade(userId, a._id),
    executeTrade(userId, b._id),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    results.find((r) => r.status === "rejected").reason.code,
    "INSUFFICIENT_BUYBACK_BUDGET",
  );
  assert.equal((await wallet()).x.available, 1000);
  assert.equal((await wallet()).toman.available, 99000);
  assert.equal((await balance()).buybackAvailableToman, 0);
  assert.equal(await Trade.countDocuments({ status: "completed" }), 1);
});

test("concurrent replay of a sell returns one trade and one budget deduction", async () => {
  await fund(198000);
  await Wallet.updateOne({ userId }, { $set: { "x.available": 2000 } });
  const q = await quote("sell");
  const trades = await Promise.all([
    executeTrade(userId, q._id),
    executeTrade(userId, q._id),
  ]);
  assert.equal(String(trades[0]._id), String(trades[1]._id));
  assert.equal((await balance()).buybackAvailableToman, 99000);
  assert.equal((await wallet()).toman.available, 99000);
  assert.equal(await LedgerTransaction.countDocuments({ type: "x_sell" }), 1);
});

test("concurrent allocation replay records one change", async () => {
  const results = await Promise.all([fund(500000), fund(500000)]);
  assert.equal(String(results[0]._id), String(results[1]._id));
  assert.equal((await balance()).buybackAvailableToman, 500000);
  assert.equal(await BuybackAdjustment.countDocuments(), 1);
});

test("ledger failure rolls back budget, wallet, inventory, trade and quote", async () => {
  await fund(99000);
  await Wallet.updateOne({ userId }, { $set: { "x.available": 1000 } });
  await LedgerAccount.updateOne(
    { balanceType: "buyback_budget" },
    { $set: { status: "frozen" } },
  );
  const q = await quote("sell");
  await assert.rejects(executeTrade(userId, q._id), {
    code: "LEDGER_ACCOUNT_UNAVAILABLE",
  });
  assert.equal((await balance()).buybackAvailableToman, 99000);
  assert.equal((await balance()).tomanAvailable, 0);
  assert.equal((await wallet()).x.available, 1000);
  assert.equal((await wallet()).toman.available, 0);
  assert.equal((await OnlineInventory.findOne()).availableX, 100000);
  assert.equal((await Quote.findById(q._id)).status, "active");
  assert.equal(await Trade.countDocuments(), 0);
});

test("reports separate both directions, grams, principal and commissions; zero fees remain valid", async () => {
  const empty = await getTradeSummary();
  assert.equal(empty.buy.count, 0);
  assert.equal(empty.sell.count, 0);
  await deposit();
  await fund(200000);
  await executeTrade(userId, (await quote("buy"))._id);
  await executeTrade(userId, (await quote("sell"))._id);
  const zeroFee = await executeTrade(
    userId,
    (await quote("buy", { commissionToman: 0 }))._id,
  );
  const entries = await accountEntries(zeroFee.ledgerTransactionId);
  assert.equal(
    entries.some((e) => e.accountId.balanceType === "buy_commission"),
    false,
  );
  const summary = await getTradeSummary();
  assert.deepEqual(summary.buy, {
    platformSide: "sale_to_user",
    count: 2,
    xAmount: 2000,
    grams: 2,
    grossToman: 200000,
    commissionToman: 1000,
    finalToman: 201000,
  });
  assert.deepEqual(summary.sell, {
    platformSide: "purchase_from_user",
    count: 1,
    xAmount: 1000,
    grams: 1,
    grossToman: 100000,
    commissionToman: 1000,
    finalToman: 99000,
  });
});

test("admin API rejects guests, normal users and invalid amounts", async () => {
  const user = await User.create({
    _id: userId,
    firstname: "Test",
    lastname: "User",
    phoneNumber: "09120000001",
    password: "test-password-only",
  });
  const admin = await User.create({
    _id: adminId,
    firstname: "Test",
    lastname: "Admin",
    phoneNumber: "09120000002",
    password: "test-password-only",
    role: "admin",
  });
  const path = `${base}/api/admin/buyback-budget`;
  const headers = (u) => ({
    Authorization: `Bearer ${signAuthToken(u)}`,
    "Content-Type": "application/json",
  });
  assert.equal((await fetch(path)).status, 401);
  assert.equal((await fetch(path, { headers: headers(user) })).status, 403);
  assert.equal((await fetch(path, { headers: headers(admin) })).status, 200);
  for (const amountToman of [-1, 0, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    const response = await fetch(`${path}/adjustments`, {
      method: "POST",
      headers: headers(admin),
      body: JSON.stringify({
        type: "increase",
        amountToman,
        reason: "API test",
        idempotencyKey: "api-test-allocation",
      }),
    });
    assert.equal(response.status, 400);
  }
  const response = await fetch(`${path}/adjustments`, {
    method: "POST",
    headers: headers(admin),
    body: JSON.stringify({
      type: "increase",
      amountToman: 1000,
      reason: "API test",
      idempotencyKey: "api-test-allocation",
    }),
  });
  assert.equal(response.status, 200, JSON.stringify(await response.json()));
  assert.equal((await getBuybackBudget()).availableToman, 1000);
  const history = await fetch(`${path}/adjustments`, { headers: headers(admin) });
  assert.equal((await history.json()).data.total, 1);
});
