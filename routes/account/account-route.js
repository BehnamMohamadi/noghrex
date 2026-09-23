import { Router } from 'express';
import { getMe, updateMe } from '../../controllers/account/account-controller.js';
import { validate } from '../../middlewares/validate.js';
import { updateAccountSchema } from '../../validations/account/account-validation.js';
import { authenticate } from '../../middlewares/auth.js';
import { deactivateAccount } from '../../services/account/account-service.js';

const router = Router();

router.use(authenticate);
router.get('/', getMe);
router.delete('/', async (req, res) => res.json({ status: 'success', data: { user: await deactivateAccount(req.user.id) } }));
router.patch('/', validate(updateAccountSchema), updateMe);

export default router;
