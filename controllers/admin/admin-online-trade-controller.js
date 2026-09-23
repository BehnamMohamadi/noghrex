import { asyncHandler } from "../../utils/async-handler.js";
import {
  listAllTrades,
  getTradeSummary,
} from "../../services/silver/online/trade-service.js";
export const listTrades = asyncHandler(async (req, res) =>
  res.json({ status: "success", data: await listAllTrades(req.query) }),
);
export const tradeSummary = asyncHandler(async (req, res) =>
  res.json({ status: "success", data: { summary: await getTradeSummary() } }),
);
