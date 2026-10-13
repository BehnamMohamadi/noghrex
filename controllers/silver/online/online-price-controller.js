import { asyncHandler } from "../../../utils/async-handler.js";
import {
  getCurrentOnlinePrice,
  listOnlinePriceHistory,
  setManualOnlinePrice,
} from "../../../services/silver/online/online-price-service.js";
import { getSilverFeedStatus, listSilverMarketChart, rescheduleSilverPriceFeed, updateSilverFeedSettings } from '../../../services/silver/online/silver-price-feed-service.js';
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
export const getMarketChart = asyncHandler(async (req, res) => res.json({ status: 'success', data: { items: await listSilverMarketChart(req.query) } }));
export const getPriceFeedSettings = asyncHandler(async (req, res) => res.json({ status: 'success', data: await getSilverFeedStatus() }));
export const putPriceFeedSettings = asyncHandler(async (req, res) => {
  const { expectedRevision, ...value } = req.body;
  const doc = await updateSilverFeedSettings(value, req.user.id, expectedRevision);
  rescheduleSilverPriceFeed();
  res.json({ status: 'success', data: { settings: doc.value, revision: doc.revision } });
});
