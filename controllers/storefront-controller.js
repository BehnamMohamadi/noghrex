import { getFinancialSettings } from "../services/settings/settings-service.js";

export async function getStorefrontConfig(req, res) {
  const settings = await getFinancialSettings();
  res.json({
    status: "success",
    data: {
      paymentGateway: process.env.PAYMENT_GATEWAY || "mock",
      withdrawalFee: settings.withdrawal.feeAmount,
      buyCommissionPercent: settings.trading.buyCommissionPercent,
      sellCommissionPercent: settings.trading.sellCommissionPercent,
    },
  });
}
