import { asyncHandler } from "../../../utils/async-handler.js";
import {
  getCurrentOnlinePrice,
  listOnlinePriceHistory,
  setManualOnlinePrice,
} from "../../../services/silver/online/online-price-service.js";
export const getPublicOnlinePrice = asyncHandler(async (req, res) =>
  res.json({ status: "success", data: { price: await getCurrentOnlinePrice() } }),
);
export const setManualPrice = asyncHandler(async (req, res) => {
  const price = await setManualOnlinePrice({ adminId: req.user.id, ...req.body });
  res.json({ status: "success", data: { price } });
});
export const getPriceHistory = asyncHandler(async (req, res) =>
  res.json({ status: "success", data: await listOnlinePriceHistory(req.query) }),
);
