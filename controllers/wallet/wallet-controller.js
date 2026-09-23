import * as walletService from '../../services/wallet/wallet-service.js';

export async function getMyWallet(req, res) {
  const wallet = await walletService.getWalletForUser(req.user._id);
  res.status(200).json({ status: 'success', data: { wallet } });
}
