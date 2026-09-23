import { asyncHandler } from '../../utils/async-handler.js';
import * as accountService from '../../services/account/account-service.js';

export const getMe = asyncHandler(async (req, res) => {
  const user = await accountService.getAccount(req.user.id);
  res.status(200).json({ status: 'success', data: { user } });
});

export const updateMe = asyncHandler(async (req, res) => {
  const user = await accountService.updateAccount(req.user.id, req.body);
  res.status(200).json({ status: 'success', data: { user } });
});
