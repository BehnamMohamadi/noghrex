import { asyncHandler } from "../../../utils/async-handler.js";
import {
  adjustOnlineInventory,
  getOnlineInventory,
  listInventoryTransactions,
} from "../../../services/silver/online/online-inventory-service.js";
export const getInventory = asyncHandler(async (req, res) =>
  res.json({ status: "success", data: { inventory: await getOnlineInventory() } }),
);
export const adjustInventory = asyncHandler(async (req, res) => {
  const transaction = await adjustOnlineInventory({ adminId: req.user.id, ...req.body });
  res.status(201).json({ status: "success", data: { transaction } });
});
export const getInventoryHistory = asyncHandler(async (req, res) =>
  res.json({ status: "success", data: await listInventoryTransactions(req.query) }),
);
