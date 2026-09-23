import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { getMyWallet } from '../../controllers/wallet/wallet-controller.js';

const router = Router();
router.get('/', authenticate, asyncHandler(getMyWallet));
export default router;
