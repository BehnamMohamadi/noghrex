import { asyncHandler } from "../../utils/async-handler.js";
import {
  getBuybackBudget,
  adjustBuybackBudget,
  listBuybackAdjustments,
} from "../../services/platform/buyback-budget-service.js";

export const getBudget = asyncHandler(async (req, res) =>
  res.json({ status: "success", data: await getBuybackBudget() }),
);
export const listAdjustments = asyncHandler(async (req, res) =>
  res.json({ status: "success", data: await listBuybackAdjustments(req.query) }),
);
export const adjustBudget = asyncHandler(async (req, res) =>
  res.json({
    status: "success",
    data: await adjustBuybackBudget(req.user.id, req.body, req.ip),
  }),
);
